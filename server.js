const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
require('dotenv').config();
const db = require('./db');
const { migrate } = require('./schema');
const { sendEmailNow, sendWhatsAppNow } = require('./automation');

migrate();

function ensureProductReviewsTable(){
  try{
    db.exec(`
CREATE TABLE IF NOT EXISTS product_reviews(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  review_text TEXT NOT NULL,
  approved INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved_created ON product_reviews(approved, created_at);
`);
    try{ db.exec(`ALTER TABLE product_reviews ADD COLUMN approved INTEGER DEFAULT 1;`); }catch(_e){}
    try{ db.exec(`ALTER TABLE product_reviews ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`); }catch(_e){}
  }catch(e){
    console.error('Product reviews table check failed:', e.message);
  }
}
ensureProductReviewsTable();

function safeReviewText(value, max){
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function publicReview(row){
  return {
    id: row.id,
    product_id: String(row.product_id || ''),
    customer_name: row.customer_name || 'Customer',
    rating: Number(row.rating || 0),
    review_text: row.review_text || '',
    created_at: row.created_at || new Date().toISOString()
  };
}
function groupedReviewPayload(rows){
  const reviews = {};
  const summaries = {};
  (rows || []).forEach(row => {
    const r = publicReview(row);
    const id = String(r.product_id || '');
    if(!id) return;
    reviews[id] = reviews[id] || [];
    reviews[id].push(r);
  });
  Object.keys(reviews).forEach(productId => {
    const list = reviews[productId];
    const avg = list.length ? list.reduce((sum, r) => sum + Number(r.rating || 0), 0) / list.length : 0;
    summaries[productId] = { avg, count: list.length };
  });
  return { reviews, summaries };
}


const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || '';

if (IS_PROD && (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET === 'dev-secret-change-before-live')) {
  console.error('SECURITY ERROR: Set a strong JWT_SECRET Railway variable with at least 32 characters.');
  process.exit(1);
}
const ACTIVE_JWT_SECRET = JWT_SECRET || 'local-dev-secret-change-before-live-only';

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (IS_PROD && allowedOrigins.length === 0) return cb(new Error('ALLOWED_ORIGINS must be set in production'));
    if (!origin || !IS_PROD || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", (_req, res) => `'nonce-${res.locals.cspNonce}'`],
      "script-src-attr": ["'none'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:", "https:"],
      "connect-src": ["'self'", "https://api.cloudinary.com"],
      "font-src": ["'self'", "data:"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "frame-ancestors": ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use((req, res, next) => {
  if (IS_PROD && req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=(self)');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(morgan(IS_PROD ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

function simpleRateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = hits.get(key) || { count: 0, reset: now + windowMs };
    if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    next();
  };
}

const generalLimiter = simpleRateLimit({ windowMs: 60_000, max: 300 });
const authLimiter = simpleRateLimit({ windowMs: 15 * 60_000, max: 20, message: 'Too many login attempts. Please wait and try again.' });
const writeLimiter = simpleRateLimit({ windowMs: 60_000, max: 60 });
app.use('/api', generalLimiter);

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '';
    cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) return cb(new Error('Only JPG, PNG, WEBP, and GIF images are allowed.'));
    cb(null, true);
  }
});

function isAllowedImageSignature(filePath){
  try{
    const b = fs.readFileSync(filePath);
    if(b.length < 12) return false;
    const isJpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
    const isGif = b.slice(0,6).toString('ascii') === 'GIF87a' || b.slice(0,6).toString('ascii') === 'GIF89a';
    const isWebp = b.slice(0,4).toString('ascii') === 'RIFF' && b.slice(8,12).toString('ascii') === 'WEBP';
    return isJpg || isPng || isGif || isWebp;
  }catch(e){ return false; }
}
function validateUploadedImage(req,res,next){
  if(!req.file) return res.status(400).json({error:'No image file uploaded'});
  if(!isAllowedImageSignature(req.file.path)){
    try{ fs.unlinkSync(req.file.path); }catch(e){}
    return res.status(400).json({error:'Uploaded file is not a valid image.'});
  }
  next();
}

function cloudinaryConfig(){
  if(process.env.CLOUDINARY_URL){
    const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(process.env.CLOUDINARY_URL);
    if(m) return {api_key:m[1], api_secret:m[2], cloud_name:m[3]};
  }
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  };
}
async function uploadToCloudinary(file){
  const cfg = cloudinaryConfig();
  if(!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) throw new Error('Cloudinary environment variables are not configured');
  const timestamp = Math.floor(Date.now()/1000);
  const folder = process.env.CLOUDINARY_FOLDER || 'crafted-visual/uploads';
  const publicId = path.basename(file.filename, path.extname(file.filename));
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${cfg.api_secret}`;
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file.path)], {type:file.mimetype}), file.originalname || file.filename);
  form.append('api_key', cfg.api_key);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);
  form.append('public_id', publicId);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud_name}/image/upload`, {method:'POST', body:form});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
  return {url:data.secure_url, provider:'cloudinary', provider_id:data.public_id, filename:file.filename};
}
function hmac(key, data, enc){ return crypto.createHmac('sha256', key).update(data).digest(enc); }
function sha256(data, enc='hex'){ return crypto.createHash('sha256').update(data).digest(enc); }
function awsSigningKey(secret, date, region, service){ return hmac(hmac(hmac(hmac('AWS4'+secret, date), region), service), 'aws4_request'); }
async function uploadToS3(file){
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  if(!bucket || !accessKey || !secretKey) throw new Error('S3 environment variables are not configured');
  const prefix = (process.env.AWS_S3_PREFIX || 'uploads').replace(/^\/+|\/+$/g,'');
  const key = `${prefix}/${file.filename}`;
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const body = fs.readFileSync(file.path);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g,'');
  const dateStamp = amzDate.slice(0,8);
  const payloadHash = sha256(body);
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', '/' + key.split('/').map(encodeURIComponent).join('/'), '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
  const signature = hmac(awsSigningKey(secretKey, dateStamp, region, 's3'), stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const res = await fetch(`https://${host}/${key}`, {method:'PUT', headers:{Authorization:authorization,'x-amz-date':amzDate,'x-amz-content-sha256':payloadHash,'Content-Type':file.mimetype}, body});
  if(!res.ok) throw new Error(`S3 upload failed: HTTP ${res.status}`);
  const base = (process.env.AWS_PUBLIC_BASE_URL || `https://${host}`).replace(/\/$/,'');
  return {url:`${base}/${key}`, provider:'s3', provider_id:key, filename:file.filename};
}
async function storeUploadedImage(file){
  const provider = String(process.env.UPLOAD_PROVIDER || '').toLowerCase();
  if(provider === 'cloudinary'){
    const out = await uploadToCloudinary(file);
    try{ fs.unlinkSync(file.path); }catch(e){}
    return out;
  }
  if(provider === 's3'){
    const out = await uploadToS3(file);
    try{ fs.unlinkSync(file.path); }catch(e){}
    return out;
  }
  return {url:'/uploads/' + file.filename, provider:'local', provider_id:file.filename, filename:file.filename};
}

function sanitizeText(v, max = 5000) {
  if (v === undefined || v === null) return v;
  return String(v).replace(/[<>]/g, '').trim().slice(0, max);
}
function sanitizeBody(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === 'string') obj[k] = sanitizeText(obj[k]);
    else if (obj[k] && typeof obj[k] === 'object') sanitizeBody(obj[k]);
  }
  return obj;
}
app.use((req, _res, next) => { if (req.body) sanitizeBody(req.body); next(); });

function isEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim()); }
function toNum(v, def=0, min=0, max=Number.MAX_SAFE_INTEGER){
  const n = Number(v);
  if(!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}
function cleanStr(v, max=500){ return sanitizeText(v || '', max); }
function publicSettings(settings){
  const deny = new Set(['smtp','smtp_password','email_password','api_key','api_secret','secret','jwt_secret','admin_password','password','private_settings']);
  const out = {};
  Object.entries(settings || {}).forEach(([k,v]) => { if(!deny.has(String(k).toLowerCase())) out[k] = v; });
  return out;
}

function deliveryBeforeVatForCity(city){
  const cityName = String(city||'').trim().toLowerCase();
  const rows = db.prepare('SELECT key,value FROM settings WHERE key IN (?,?)').all('riyadh_delivery','outside_riyadh_delivery');
  const map = Object.fromEntries(rows.map(r=>[r.key, r.value]));
  const riyadh = toNum(map.riyadh_delivery,0,0,100000);
  const outside = toNum(map.outside_riyadh_delivery,riyadh,0,100000);
  return cityName.includes('riyadh') || cityName.includes('الرياض') ? riyadh : outside;
}
function validateDiscountCode(code){
  const c = db.prepare('SELECT id,code,percent,active,expires_at,usage_limit,usage_count FROM discount_codes WHERE code=? AND active=1').get(String(code||'').trim().toUpperCase());
  if(!c) return {valid:false, error:'Invalid discount code'};
  if(c.expires_at && new Date(c.expires_at) < new Date()) return {valid:false, error:'Expired'};
  if(c.usage_limit && c.usage_count >= c.usage_limit) return {valid:false, error:'Usage limit reached'};
  c.percent = toNum(c.percent, 0, 0, 100);
  return {valid:true, discount:c};
}
function findProductForCartItem(item){
  const id = cleanStr(item.id || item.product_id || item.productId || item.sku || '', 120);
  let p = null;
  if(id) p = db.prepare('SELECT * FROM products WHERE active=1 AND (sku=? OR id=?)').get(id, Number(id)||-1);
  if(!p && item.name) p = db.prepare('SELECT * FROM products WHERE active=1 AND (lower(name_en)=lower(?) OR lower(name_ar)=lower(?))').get(item.name, item.name);
  return p;
}
function findVariantForCartItem(product, item){
  if(!product) return null;
  return db.prepare(`SELECT * FROM product_variants WHERE product_id=?
    AND (size IS NULL OR size='' OR lower(size)=lower(?))
    AND (fabric IS NULL OR fabric='' OR lower(fabric)=lower(?))
    AND (color IS NULL OR color='' OR lower(color)=lower(?))
    ORDER BY id DESC LIMIT 1`).get(product.id, cleanStr(item.size,120), cleanStr(item.fabric,120), cleanStr(item.color,120));
}

function json(v,d={}){ try{return JSON.parse(v||'')}catch{return d} }

function parseCookies(req){
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return i === -1 ? [v, ''] : [decodeURIComponent(v.slice(0,i)), decodeURIComponent(v.slice(i+1))];
  }));
}
function appendCookie(res, cookieValue){
  if (res.append) return res.append('Set-Cookie', cookieValue);
  const existing = res.getHeader && res.getHeader('Set-Cookie');
  if (!existing) return res.setHeader('Set-Cookie', cookieValue);
  const next = Array.isArray(existing) ? existing.concat(cookieValue) : [existing, cookieValue];
  return res.setHeader('Set-Cookie', next);
}
function setAuthCookie(res, name, value){
  const parts = [`${name}=${encodeURIComponent(value)}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=43200'];
  if (IS_PROD) parts.push('Secure');
  appendCookie(res, parts.join('; '));
}
function clearAuthCookie(res, name){
  const parts = [`${name}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (IS_PROD) parts.push('Secure');
  appendCookie(res, parts.join('; '));
}
const CSRF_COOKIE_NAME = 'cv_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
function isUnsafeHttpMethod(method=''){
  return ['POST','PUT','PATCH','DELETE'].includes(String(method || '').toUpperCase());
}
function hasSessionCookie(req){
  const cookies = parseCookies(req);
  return !!(cookies.cv_admin_auth || cookies.cv_customer_auth);
}
function makeCsrfToken(){
  return crypto.randomBytes(32).toString('hex');
}
function setCsrfCookie(res, tokenValue){
  const parts = [`${CSRF_COOKIE_NAME}=${encodeURIComponent(tokenValue)}`, 'SameSite=Lax', 'Path=/', 'Max-Age=43200'];
  if (IS_PROD) parts.push('Secure');
  appendCookie(res, parts.join('; '));
}
function ensureCsrfCookie(req, res){
  const cookies = parseCookies(req);
  const existing = cookies[CSRF_COOKIE_NAME];
  if(existing && /^[a-f0-9]{64}$/i.test(existing)) return existing;
  const tokenValue = makeCsrfToken();
  setCsrfCookie(res, tokenValue);
  return tokenValue;
}
function csrfProtection(req, res, next){
  ensureCsrfCookie(req, res);
  if(!req.path.startsWith('/api/') || !isUnsafeHttpMethod(req.method)) return next();
  if(!hasSessionCookie(req)) return next();
  const cookies = parseCookies(req);
  const cookieToken = cookies[CSRF_COOKIE_NAME] || '';
  const submittedToken = String(req.headers[CSRF_HEADER_NAME] || req.body?._csrf || '');
  if(cookieToken && submittedToken && cookieToken === submittedToken) return next();
  return res.status(403).json({error:'Invalid or missing CSRF token'});
}
function bearerOrCookieToken(req){
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    const bearer = h.slice(7);
    if(bearer && bearer !== 'cookie-auth' && bearer !== 'cv-cookie-auth') return bearer;
  }
  const cookies = parseCookies(req);
  return cookies.cv_admin_auth || cookies.cv_customer_auth || '';
}
function token(user,type){ return jwt.sign({id:user.id,email:user.email,role:user.role,type}, ACTIVE_JWT_SECRET, {expiresIn:'12h'}); }
function auth(req,res,next){ const raw = bearerOrCookieToken(req); try{ req.user=jwt.verify(raw,ACTIVE_JWT_SECRET); next(); } catch(e){ res.status(401).json({error:'Unauthorized'}); } }
function isDefaultSuperAdminEmail(email=''){
  const configured = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@craftedvisual.com').trim().toLowerCase();
  return String(email || '').trim().toLowerCase() === configured;
}
function fullPermissions(){
  const all = ['menu','pictures','products','categories','seo','discounts','orders','finance','crm','users','analytics','security','inventory','media','settings'];
  const out = {};
  all.forEach(k => out[k] = {read:true, write:true});
  return out;
}
function adminAuth(section, level='read'){
  return (req,res,next)=>{
    auth(req,res,()=>{
      if(req.user.type !== 'admin') return res.status(403).json({error:'Admin only'});
      const u = db.prepare('SELECT * FROM admin_users WHERE id=? AND active=1').get(req.user.id);
      if(!u) return res.status(403).json({error:'Inactive admin'});

      // Godmode rule: the configured DEFAULT_ADMIN_EMAIL is always treated as the system owner.
      // This is still secure because the user must authenticate successfully first.
      if(String(u.role || '').toLowerCase() === 'superadmin' || isDefaultSuperAdminEmail(u.email) || isDefaultSuperAdminEmail(req.user.email)){
        return next();
      }

      const p = json(u.permissions_json,{});
      if(p[section]?.[level]) return next();
      // Settings is a shared publishing endpoint used by menu, SEO, banners and content.
      // Any admin with write access to the relevant website-control modules may publish settings.
      if(section === 'settings' && level === 'write'){
        const allowed = ['menu','pictures','seo','categories','analytics','users'];
        if(allowed.some(k => p[k]?.write)) return next();
      }
      return res.status(403).json({error:`Missing ${level} permission for ${section}`});
    });
  };
}

function isSuperAdminUser(u){
  return !!u && (String(u.role || '').toLowerCase() === 'superadmin' || isDefaultSuperAdminEmail(u.email));
}
// Guard for actions that must be restricted to super admins only (e.g. managing admin
// accounts and assigning roles). This prevents a normal admin with users:write from
// escalating privileges by creating or promoting a superadmin.
function superAdminOnly(req,res,next){
  auth(req,res,()=>{
    if(req.user.type !== 'admin') return res.status(403).json({error:'Admin only'});
    const u = db.prepare('SELECT * FROM admin_users WHERE id=? AND active=1').get(req.user.id);
    if(!u) return res.status(403).json({error:'Inactive admin'});
    if(isSuperAdminUser(u)) return next();
    return res.status(403).json({error:'Super Admin privilege required'});
  });
}

function categoryIdFromBody(b){
 const name=(b.category_name || b.category || b.data?.category || '').trim();
 if(b.category_id) return b.category_id;
 if(!name) return null;
 let c=db.prepare('SELECT id FROM categories WHERE lower(name_en)=lower(?)').get(name);
 if(c) return c.id;
 return db.prepare('INSERT INTO categories(name_en,name_ar,active,sort_order) VALUES(?,?,?,?)').run(name,b.category_ar || b.data?.category_ar || '',1,0).lastInsertRowid;
}


function getSettingObject(){
  const rows = db.prepare('SELECT key,value FROM settings').all();
  const out = {};
  rows.forEach(r => { try { out[r.key] = JSON.parse(r.value); } catch(e) { out[r.key] = r.value; } });
  if(!out.seo_pages) out.seo_pages = DEFAULT_SEO_PAGES;
  if(!out.site_url) out.site_url = process.env.PUBLIC_SITE_URL || '';
  return out;
}
function saveSettingObject(obj){
  const up = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const tx = db.transaction((settings) => {
    Object.entries(settings || {}).forEach(([k,v]) => up.run(k, JSON.stringify(v)));
  });
  tx(obj);
}
const DEFAULT_SEO_PAGES = {
  home: {
    title_en: 'Custom Furniture Saudi Arabia | Crafted Visual',
    title_ar: 'أثاث مخصص في السعودية | كرافتد فيجوال',
    description_en: 'Shop premium custom furniture in Saudi Arabia including sofas, beds, chairs, luxury fabrics, custom sizes, and Riyadh delivery by Crafted Visual.',
    description_ar: 'تسوق أثاثاً مخصصاً وفاخراً في السعودية يشمل الكنب والأسرة والكراسي والأقمشة الفاخرة والمقاسات حسب الطلب من كرافتد فيجوال.',
    keywords: ['custom furniture Saudi Arabia','premium furniture Riyadh','sofas Riyadh','beds Saudi Arabia','luxury furniture','custom sofas']
  },
  shop: {
    title_en: 'Shop Custom Sofas, Beds & Chairs | Crafted Visual',
    title_ar: 'تسوق كنب وأسرة وكراسي مخصصة | كرافتد فيجوال',
    description_en: 'Browse Crafted Visual furniture collections with custom sizes, fabrics, colors, prices, and delivery options across Saudi Arabia.',
    description_ar: 'تصفح مجموعات أثاث كرافتد فيجوال مع المقاسات والأقمشة والألوان والأسعار وخيارات التوصيل داخل السعودية.',
    keywords: ['shop furniture Saudi Arabia','buy sofa Riyadh','custom beds Riyadh','custom chairs Saudi','furniture ecommerce Saudi Arabia']
  },
  contact: {
    title_en: 'Contact Crafted Visual Furniture | Riyadh Saudi Arabia',
    title_ar: 'تواصل مع كرافتد فيجوال للأثاث | الرياض السعودية',
    description_en: 'Contact Crafted Visual for custom furniture orders, WhatsApp inquiries, delivery questions, and furniture support in Saudi Arabia.',
    description_ar: 'تواصل مع كرافتد فيجوال لطلبات الأثاث المخصص، الاستفسارات عبر واتساب، التوصيل، وخدمة العملاء في السعودية.',
    keywords: ['contact furniture Riyadh','custom furniture inquiry','furniture WhatsApp Saudi Arabia','Crafted Visual contact']
  },
  account: {
    title_en: 'My Account | Crafted Visual Furniture',
    title_ar: 'حسابي | كرافتد فيجوال للأثاث',
    description_en: 'Sign in to your Crafted Visual account to track orders, manage furniture purchases, and review your shopping journey.',
    description_ar: 'سجل الدخول إلى حسابك في كرافتد فيجوال لتتبع الطلبات وإدارة بيانات التوصيل والمشتريات.',
    keywords: ['furniture account','track furniture order','Crafted Visual account']
  },
  track: {
    title_en: 'Track Your Order | Crafted Visual',
    title_ar: 'تتبع طلبك | كرافتد فيجوال',
    description_en: 'Track your Crafted Visual furniture order status using your order number.',
    description_ar: 'تتبع حالة طلب الأثاث الخاص بك من كرافتد فيجوال باستخدام رقم الطلب.',
    keywords: ['track order Crafted Visual','furniture order tracking Saudi Arabia']
  },
  product: {
    title_en: 'Custom Furniture Product | Crafted Visual',
    title_ar: 'منتج أثاث مخصص | كرافتد فيجوال',
    description_en: 'View product details, custom sizes, fabrics, colors, prices, and ordering options from Crafted Visual.',
    description_ar: 'شاهد تفاصيل المنتج والمقاسات والأقمشة والألوان والأسعار وخيارات الطلب من كرافتد فيجوال.',
    keywords: ['custom furniture product','custom size sofa','custom fabric furniture','luxury product Saudi Arabia']
  }
};
function absoluteUrl(req, pathName=''){
  const configured = (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const origin = configured || `${req.protocol}://${req.get('host')}`;
  return origin + '/' + String(pathName || '').replace(/^\//,'');
}
function xmlEscape(v=''){
  return String(v).replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}


function hashValue(value=''){
  return crypto.createHash('sha256').update(String(value || '') + ACTIVE_JWT_SECRET).digest('hex').slice(0, 32);
}
function detectDevice(ua=''){
  const x = String(ua).toLowerCase();
  if(/mobile|iphone|android/.test(x)) return 'mobile';
  if(/ipad|tablet/.test(x)) return 'tablet';
  return 'desktop';
}
function auditLog(req, action, entityType='', entityId='', metadata={}){
  try{
    db.prepare('INSERT INTO audit_logs(admin_id,action,entity_type,entity_id,ip_hash,metadata_json) VALUES(?,?,?,?,?,?)')
      .run(req.user?.id || null, action, entityType, String(entityId || ''), hashValue(req.ip), JSON.stringify(metadata || {}));
  }catch(e){ console.warn('audit log skipped', e.message); }
}
function seedDefaults(){
 const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@craftedvisual.com').trim().toLowerCase();
 const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || (IS_PROD ? null : 'Admin@12345Secure');
 const shouldResetAdmin = String(process.env.RESET_ADMIN_PASSWORD || '').toLowerCase() === 'true' || String(process.env.FORCE_ADMIN_RESET || '').toLowerCase() === 'true';
 const count=db.prepare('SELECT COUNT(*) c FROM admin_users').get().c;

 if(IS_PROD && (!adminPassword || adminPassword.length < 12)){
   console.error('SECURITY ERROR: Set DEFAULT_ADMIN_PASSWORD Railway variable with at least 12 characters.');
   process.exit(1);
 }

 const existingByEmail = db.prepare('SELECT * FROM admin_users WHERE lower(email)=lower(?)').get(adminEmail);

 // Always keep the configured default admin as the system owner/superadmin.
 // RESET_ADMIN_PASSWORD controls password reset only; ownership must not depend on browser storage.
 if(existingByEmail){
   db.prepare('UPDATE admin_users SET name=?, role=?, active=1, permissions_json=? WHERE id=?')
     .run('Super Admin', 'superadmin', '{}', existingByEmail.id);
 }

 if(!count){
   db.prepare('INSERT INTO admin_users(name,email,password_hash,role,permissions_json,active) VALUES(?,?,?,?,?,?)')
     .run('Super Admin',adminEmail,bcrypt.hashSync(adminPassword,12),'superadmin','{}',1);
   console.log('Default Super Admin created:', adminEmail);
 } else if(shouldResetAdmin){
   if(existingByEmail){
     db.prepare("UPDATE admin_users SET name=?, password_hash=?, role=?, active=1, permissions_json=? WHERE id=?")
       .run('Super Admin', bcrypt.hashSync(adminPassword,12), 'superadmin', '{}', existingByEmail.id);
     console.log('Super Admin password reset for:', adminEmail);
   } else {
     db.prepare('INSERT INTO admin_users(name,email,password_hash,role,permissions_json,active) VALUES(?,?,?,?,?,?)')
       .run('Super Admin',adminEmail,bcrypt.hashSync(adminPassword,12),'superadmin','{}',1);
     console.log('New Super Admin created via reset:', adminEmail);
   }
 }

 const catCount=db.prepare('SELECT COUNT(*) c FROM categories').get().c;
 if(!catCount){ ['L Shape Sofas','Beds','Single Chairs'].forEach((c,i)=>db.prepare('INSERT INTO categories(name_en,active,sort_order) VALUES(?,?,?)').run(c,1,i)); }
 const seoCount=db.prepare('SELECT COUNT(*) c FROM settings WHERE key=?').get('seo_pages').c;
 if(!seoCount){ saveSettingObject({ seo_pages: DEFAULT_SEO_PAGES, site_url: process.env.PUBLIC_SITE_URL || '', seo_store_name_en: 'Crafted Visual', seo_store_name_ar: 'كرافتد فيجوال', seo_default_image: 'product_01.png' }); }
}

seedDefaults();
app.use(csrfProtection);
app.get('/api/health',(req,res)=>res.json({ok:true, platform:'Crafted Visual DB Ecommerce', time:new Date().toISOString()}));


// Analytics resilience: keep Analytics Center operational even when a Railway
// database was restored without journey tables or with an older partial schema.
function ensureAnalyticsTablesSafe(){
  try{
    db.exec(`
CREATE TABLE IF NOT EXISTS customer_journey_events(
 id SERIAL PRIMARY KEY,
 session_id TEXT NOT NULL,
 customer_id INTEGER,
 event_type TEXT NOT NULL,
 page_url TEXT,
 page_title TEXT,
 product_id INTEGER,
 product_name TEXT,
 source TEXT,
 medium TEXT,
 campaign TEXT,
 term TEXT,
 content TEXT,
 referrer TEXT,
 device TEXT,
 ip_hash TEXT,
 user_agent TEXT,
 metadata_json TEXT DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS customer_id INTEGER;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS page_url TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS page_title TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS medium TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS campaign TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS term TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS ip_hash TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS metadata_json TEXT DEFAULT '{}';
ALTER TABLE customer_journey_events ADD COLUMN IF NOT EXISTS created_at TEXT DEFAULT CURRENT_TIMESTAMP;
UPDATE customer_journey_events SET session_id = COALESCE(NULLIF(session_id,''), 'unknown') WHERE session_id IS NULL OR session_id='';
UPDATE customer_journey_events SET event_type = COALESCE(NULLIF(event_type,''), 'event') WHERE event_type IS NULL OR event_type='';
CREATE INDEX IF NOT EXISTS idx_journey_session ON customer_journey_events(session_id);
CREATE INDEX IF NOT EXISTS idx_journey_event_type ON customer_journey_events(event_type);
CREATE INDEX IF NOT EXISTS idx_journey_created ON customer_journey_events(created_at);

CREATE TABLE IF NOT EXISTS abandoned_carts(
 id SERIAL PRIMARY KEY,
 session_id TEXT NOT NULL,
 customer_id INTEGER,
 cart_json TEXT NOT NULL DEFAULT '[]',
 source TEXT,
 campaign TEXT,
 status TEXT NOT NULL DEFAULT 'open',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_id INTEGER;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS cart_json TEXT DEFAULT '[]';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS campaign TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS created_at TEXT DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT CURRENT_TIMESTAMP;
UPDATE abandoned_carts SET session_id = COALESCE(NULLIF(session_id,''), 'unknown') WHERE session_id IS NULL OR session_id='';
UPDATE abandoned_carts SET status = COALESCE(NULLIF(status,''), 'open') WHERE status IS NULL OR status='';
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON abandoned_carts(status);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_updated ON abandoned_carts(updated_at);
`);
    return true;
  }catch(err){
    console.error('Analytics table verification failed:', err.message || err);
    return false;
  }
}
function analyticsEmptySummary(days, reason='Analytics data unavailable'){
  return { ok:false, empty:true, days, reason,
    totals:{events:0, sessions:0}, funnel:[], sources:[], pages:[], products:[], abandoned:{open_carts:0}
  };
}
function numberOrNull(v){
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

app.get('/api/version',(req,res)=>res.json({version:'CRAFTED-VISUAL-SUPERADMIN-MEDIA-FIX-20260609-18', superadminFix:true, mediaLibrary:true, publicTopRibbon:false, publicAnalyticsMenu:false, adminLogin:true, time:new Date().toISOString()}));

app.get('/api/settings',(req,res)=>res.json(publicSettings(getSettingObject())));
app.put('/api/settings', adminAuth('settings','write'), (req,res)=>{ saveSettingObject(req.body || {}); res.json({ok:true, settings:getSettingObject()}); });
app.post('/api/settings', adminAuth('settings','write'), (req,res)=>{ saveSettingObject(req.body || {}); res.json({ok:true, settings:getSettingObject()}); });

app.get('/robots.txt',(req,res)=>{
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin-login.html\nDisallow: /orders.html\nDisallow: /crm.html\nDisallow: /financial-dashboard.html\nSitemap: ${absoluteUrl(req,'sitemap.xml')}\n`);
});

app.get('/sitemap.xml',(req,res)=>{
  const basePages = ['', 'shop.html', 'contact.html', 'track-order.html', 'account.html', 'privacy-policy.html', 'terms-and-conditions.html', 'cookie-policy.html', 'help.html'];
  const products = db.prepare('SELECT id, sku, created_at FROM products WHERE active=1 ORDER BY id DESC').all();
  const urls = [];
  basePages.forEach(p => urls.push({loc:absoluteUrl(req,p), changefreq:p===''?'weekly':'monthly', priority:p===''?'1.0':'0.8'}));
  products.forEach(p => urls.push({loc:absoluteUrl(req, 'shop.html?product=' + encodeURIComponent(p.sku || p.id)), changefreq:'weekly', priority:'0.7', lastmod:(p.created_at||'').slice(0,10)}));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` + urls.map(u => `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>${u.lastmod?`\n    <lastmod>${xmlEscape(u.lastmod)}</lastmod>`:''}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n') + `\n</urlset>`;
  res.type('application/xml').send(xml);
});


// 95/100 maturity: customer journey, source tracking, funnel, inventory and audit endpoints
app.post('/api/journey', writeLimiter, (req,res)=>{
  try{
    ensureAnalyticsTablesSafe();
    const b=req.body || {};
    const meta = b.metadata && typeof b.metadata === 'object' ? b.metadata : (b.data && typeof b.data === 'object' ? b.data : {});
    const sessionId = sanitizeText(b.session_id || b.sessionId || b.session || crypto.randomUUID(), 120) || crypto.randomUUID();
    const eventType = sanitizeText(b.event_type || b.eventType || b.event || 'event', 80) || 'event';
    db.prepare(`INSERT INTO customer_journey_events(session_id,customer_id,event_type,page_url,page_title,product_id,product_name,source,medium,campaign,term,content,referrer,device,ip_hash,user_agent,metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        sessionId,
        numberOrNull(b.customer_id || b.customerId),
        eventType,
        sanitizeText(b.page_url || b.pageUrl || b.page || '', 1000),
        sanitizeText(b.page_title || b.pageTitle || (typeof document !== 'undefined' ? document.title : '') || '', 300),
        numberOrNull(b.product_id || b.productId),
        sanitizeText(b.product_name || b.productName || '', 300),
        sanitizeText(b.source || b.utm_source || '', 120),
        sanitizeText(b.medium || b.utm_medium || '', 120),
        sanitizeText(b.campaign || b.utm_campaign || '', 160),
        sanitizeText(b.term || b.utm_term || '', 160),
        sanitizeText(b.content || b.utm_content || '', 160),
        sanitizeText(b.referrer || req.get('referer') || '', 1000),
        detectDevice(req.get('user-agent') || ''),
        hashValue(req.ip),
        sanitizeText(req.get('user-agent') || '', 500),
        JSON.stringify(meta)
      );
    res.json({ok:true, session_id:sessionId});
  }catch(err){
    console.error('Journey tracking write failed:', err.message || err);
    res.status(200).json({ok:false, stored:false, message:'Tracking temporarily unavailable.'});
  }
});
app.post('/api/cart/abandoned', writeLimiter, (req,res)=>{
  try{
    ensureAnalyticsTablesSafe();
    const b=req.body || {};
    const sessionId = sanitizeText(b.session_id || b.sessionId || crypto.randomUUID(), 120) || crypto.randomUUID();
    const cartJson = JSON.stringify(Array.isArray(b.cart) ? b.cart : []);
    const existing = db.prepare('SELECT id FROM abandoned_carts WHERE session_id=? AND status=? ORDER BY id DESC').get(sessionId,'open');
    if(existing){
      db.prepare('UPDATE abandoned_carts SET cart_json=?, source=?, campaign=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(cartJson, sanitizeText(b.source||'',120), sanitizeText(b.campaign||'',160), existing.id);
      return res.json({ok:true, id:existing.id, updated:true});
    }
    const r=db.prepare('INSERT INTO abandoned_carts(session_id,customer_id,cart_json,source,campaign) VALUES(?,?,?,?,?)').run(sessionId,numberOrNull(b.customer_id || b.customerId),cartJson,sanitizeText(b.source||'',120),sanitizeText(b.campaign||'',160));
    res.json({ok:true,id:r.lastInsertRowid});
  }catch(err){
    console.error('Abandoned cart tracking failed:', err.message || err);
    res.status(200).json({ok:false, stored:false, message:'Cart tracking temporarily unavailable.'});
  }
});
app.get('/api/journey/summary', adminAuth('analytics','read'), (req,res)=>{
  const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
  try{
    if(!ensureAnalyticsTablesSafe()) return res.status(200).json(analyticsEmptySummary(days, 'Analytics tables could not be verified'));
    const since = `-${days} days`;
    const totals = db.prepare(`SELECT COUNT(*) events, COUNT(DISTINCT session_id) sessions FROM customer_journey_events WHERE created_at >= datetime('now', ?)`).get(since) || {events:0, sessions:0};
    const funnel = db.prepare(`SELECT event_type, COUNT(*) count, COUNT(DISTINCT session_id) sessions FROM customer_journey_events WHERE created_at >= datetime('now', ?) GROUP BY event_type ORDER BY count DESC`).all(since);
    const sources = db.prepare(`SELECT COALESCE(NULLIF(source,''),'direct') source, COALESCE(NULLIF(medium,''),'none') medium, COUNT(DISTINCT session_id) sessions, COUNT(*) events FROM customer_journey_events WHERE created_at >= datetime('now', ?) GROUP BY source, medium ORDER BY sessions DESC LIMIT 20`).all(since);
    const pages = db.prepare(`SELECT page_url, COUNT(*) views, COUNT(DISTINCT session_id) sessions FROM customer_journey_events WHERE event_type='page_view' AND created_at >= datetime('now', ?) GROUP BY page_url ORDER BY views DESC LIMIT 20`).all(since);
    const products = db.prepare(`SELECT product_name, product_id, COUNT(*) views, COUNT(DISTINCT session_id) sessions FROM customer_journey_events WHERE event_type IN ('product_view','view_details') AND created_at >= datetime('now', ?) GROUP BY product_name, product_id ORDER BY views DESC LIMIT 20`).all(since);
    const abandoned = db.prepare(`SELECT COUNT(*) open_carts FROM abandoned_carts WHERE status='open' AND updated_at >= datetime('now', ?)`).get(since) || {open_carts:0};
    res.json({ok:true, empty:Number(totals.events||0)===0, days, totals, funnel, sources, pages, products, abandoned});
  }catch(err){
    console.error('Analytics summary failed:', err.message || err);
    res.status(200).json(analyticsEmptySummary(days, 'Analytics query failed safely'));
  }
});
app.get('/api/journey/events', adminAuth('analytics','read'), (req,res)=>{
  try{
    if(!ensureAnalyticsTablesSafe()) return res.status(200).json([]);
    const rows = db.prepare('SELECT * FROM customer_journey_events ORDER BY created_at DESC LIMIT 500').all().map(r=>({...r, metadata: json(r.metadata_json,{})}));
    res.json(rows);
  }catch(err){
    console.error('Analytics events failed:', err.message || err);
    res.status(200).json([]);
  }
});
app.get('/api/audit-logs', adminAuth('security','read'), (req,res)=>{
  res.json(db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500').all().map(r=>({...r, metadata:json(r.metadata_json,{})})));
});
app.get('/api/inventory/summary', adminAuth('inventory','read'), (req,res)=>{
  const rows = db.prepare(`SELECT p.id product_id, p.name_en product_name, v.id variant_id, v.size, v.fabric, v.color, v.stock_qty, v.cost, v.selling_price_before_vat FROM products p LEFT JOIN product_variants v ON v.product_id=p.id WHERE p.active=1 ORDER BY p.name_en`).all();
  res.json(rows);
});

app.post('/api/admin/login', authLimiter, (req,res)=>{
  const {email,password}=req.body || {};
  const u=db.prepare('SELECT * FROM admin_users WHERE lower(email)=lower(?) AND active=1').get(email||'');
  if(!u || !bcrypt.compareSync(password||'',u.password_hash)) return res.status(401).json({error:'Invalid login'});

  // If this is the configured owner email, enforce superadmin in DB and in the token response.
  let user = u;
  if(isDefaultSuperAdminEmail(u.email)){
    db.prepare('UPDATE admin_users SET name=?, role=?, active=1, permissions_json=? WHERE id=?')
      .run('Super Admin', 'superadmin', '{}', u.id);
    user = db.prepare('SELECT * FROM admin_users WHERE id=?').get(u.id);
  }

  const role = String(user.role || '').toLowerCase();
  const permissions = (role === 'superadmin' || isDefaultSuperAdminEmail(user.email)) ? fullPermissions() : json(user.permissions_json,{});
  const adminJwt = token(user,'admin');
  setAuthCookie(res, 'cv_admin_auth', adminJwt);
  auditLog({ ...req, user:{id:user.id} }, 'auth.admin_login', 'admin_user', user.id, {email:user.email});
  res.json({
    token: IS_PROD ? undefined : adminJwt,
    user:{id:user.id,name:user.name,email:user.email,role:user.role,permissions}
  });
});
// Authoritative session check. The frontend uses this to confirm the live role/permissions
// from the server instead of trusting browser storage. A 401 here is the ONLY correct
// trigger for asking the user to sign in again.
app.get('/api/admin/me',(req,res)=>{
  auth(req,res,()=>{
    if(req.user.type !== 'admin') return res.status(403).json({error:'Admin only'});
    const u = db.prepare('SELECT id,name,email,role,permissions_json,active FROM admin_users WHERE id=? AND active=1').get(req.user.id);
    if(!u) return res.status(403).json({error:'Inactive admin'});
    const isSuper = isSuperAdminUser(u);
    res.json({
      id:u.id, name:u.name, email:u.email,
      role: isSuper ? 'superadmin' : u.role,
      isSuperAdmin: isSuper,
      permissions: isSuper ? fullPermissions() : json(u.permissions_json,{})
    });
  });
});
app.post('/api/customers/register', authLimiter, (req,res)=>{
  const {name,email,mobile,password,city,address}=req.body || {};
  if(!cleanStr(name,120) || !isEmail(email) || !cleanStr(mobile,50) || String(password||'').length < 8){
    return res.status(400).json({error:'Please enter name, valid email, mobile, and password of at least 8 characters.'});
  }
  try{
    const hash=bcrypt.hashSync(String(password),12);
    const r=db.prepare('INSERT INTO customers(name,email,mobile,password_hash,city,address) VALUES(?,?,?,?,?,?)')
      .run(cleanStr(name,120),String(email).trim().toLowerCase(),cleanStr(mobile,50),hash,cleanStr(city,100),cleanStr(address,500));
    const u=db.prepare('SELECT id,name,email,mobile,city,address FROM customers WHERE id=?').get(r.lastInsertRowid);
    const customerJwt = token({...u,role:'customer'},'customer');
    setAuthCookie(res, 'cv_customer_auth', customerJwt);
    res.json({token: IS_PROD ? undefined : customerJwt, user:u});
  }catch(e){
    if(String(e.message||'').includes('UNIQUE')) return res.status(409).json({error:'Account already exists.'});
    throw e;
  }
});
app.post('/api/customers/login', authLimiter, (req,res)=>{
  const {email,password}=req.body || {};
  if(!isEmail(email) || !password) return res.status(400).json({error:'Enter a valid email and password.'});
  const u=db.prepare('SELECT * FROM customers WHERE lower(email)=lower(?)').get(String(email).trim().toLowerCase());
  if(!u || !u.password_hash || !bcrypt.compareSync(String(password),u.password_hash)) return res.status(401).json({error:'Invalid login'});
  const customerJwt = token({...u,role:'customer'},'customer');
  setAuthCookie(res, 'cv_customer_auth', customerJwt);
  res.json({token: IS_PROD ? undefined : customerJwt, user:{id:u.id,name:u.name,email:u.email,mobile:u.mobile,city:u.city,address:u.address}});
});
app.get('/api/customer/me', auth, (req,res)=>{
  if(req.user.type !== 'customer') return res.status(403).json({error:'Customer only'});
  const u=db.prepare('SELECT id,name,email,mobile,city,address,notes,created_at FROM customers WHERE id=?').get(req.user.id);
  if(!u) return res.status(404).json({error:'Customer not found'});
  res.json({user:u});
});
app.post('/api/auth/logout',(req,res)=>{ clearAuthCookie(res,'cv_customer_auth'); clearAuthCookie(res,'cv_admin_auth'); res.json({ok:true}); });
app.post('/api/customers/forgot-password', authLimiter, (req,res)=>{
  const {email}=req.body||{};
  if(!isEmail(email)) return res.status(400).json({error:'Enter a valid email.'});
  const u=db.prepare('SELECT id,email FROM customers WHERE lower(email)=lower(?)').get(String(email).trim().toLowerCase());
  const tokenValue=crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO crm_activities(customer_id,type,channel,subject,body,status,metadata_json) VALUES(?,?,?,?,?,?,?)')
    .run(u?.id||null,'Password Reset Request','email','Password reset requested','Customer requested a password reset. Verify identity before manually resetting.', 'open', JSON.stringify({email:String(email).trim().toLowerCase(), reset_token_hash:crypto.createHash('sha256').update(tokenValue).digest('hex')}));
  res.json({ok:true, message:'If this email exists, customer care will contact you.'});
});
app.get('/api/categories',(req,res)=>res.json(db.prepare('SELECT * FROM categories WHERE active=1 ORDER BY sort_order,name_en').all()));
app.post('/api/categories',adminAuth('categories','write'),(req,res)=>{ const r=db.prepare('INSERT INTO categories(name_en,name_ar,active,sort_order) VALUES(?,?,?,?)').run(req.body.name_en,req.body.name_ar||'',req.body.active!==false?1:0,req.body.sort_order||0); res.json(db.prepare('SELECT * FROM categories WHERE id=?').get(r.lastInsertRowid)); });


app.get('/api/product-reviews', (req, res) => {
  try{
    ensureProductReviewsTable();
    const requested = safeReviewText(req.query.product_id || req.query.productId || '', 160);
    const rows = requested
      ? db.prepare(`SELECT id, product_id, customer_name, rating, review_text, created_at FROM product_reviews WHERE approved=1 AND product_id=? ORDER BY created_at DESC, id DESC LIMIT 500`).all(requested)
      : db.prepare(`SELECT id, product_id, customer_name, rating, review_text, created_at FROM product_reviews WHERE approved=1 ORDER BY created_at DESC, id DESC LIMIT 2000`).all();
    res.json(groupedReviewPayload(rows));
  }catch(e){
    console.error('Product reviews load failed:', e.message);
    res.status(200).json({reviews:{}, summaries:{}, empty:true, message:'Reviews are not available yet.'});
  }
});

app.post('/api/product-reviews', writeLimiter, (req, res) => {
  try{
    ensureProductReviewsTable();
    const productId = safeReviewText(req.body.product_id || req.body.productId || '', 160);
    const customerName = safeReviewText(req.body.customer_name || req.body.customerName || 'Customer', 80) || 'Customer';
    const reviewText = safeReviewText(req.body.review_text || req.body.reviewText || '', 1000);
    const rating = Math.max(1, Math.min(5, Number.parseInt(req.body.rating, 10) || 0));
    if(!productId) return res.status(400).json({error:'Product is required.'});
    if(!rating) return res.status(400).json({error:'Rating is required.'});
    if(reviewText.length < 3) return res.status(400).json({error:'Please write a short review.'});
    const result = db.prepare(`INSERT INTO product_reviews(product_id, customer_name, rating, review_text, approved, created_at, updated_at) VALUES(?,?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).run(productId, customerName, rating, reviewText);
    const saved = db.prepare(`SELECT id, product_id, customer_name, rating, review_text, created_at FROM product_reviews WHERE id=?`).get(result.lastInsertRowid);
    res.json({ok:true, review: publicReview(saved || {id: result.lastInsertRowid, product_id: productId, customer_name: customerName, rating, review_text: reviewText, created_at: new Date().toISOString()})});
  }catch(e){
    console.error('Product review save failed:', e.message);
    res.status(500).json({error:'Could not save review. Please try again.'});
  }
});

app.get('/api/products',(req,res)=>res.json(db.prepare(`SELECT p.*, c.name_en category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1 ORDER BY p.created_at DESC`).all().map(p=>({...p,data:json(p.data_json,{})}))));
app.get('/api/products/:id',(req,res)=>{ const p=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id); if(!p) return res.status(404).json({error:'Not found'}); const variants=db.prepare('SELECT * FROM product_variants WHERE product_id=?').all(p.id); res.json({...p,data:json(p.data_json,{}),variants}); });
app.post('/api/products',adminAuth('products','write'),(req,res)=>{ const b=req.body; const categoryId=categoryIdFromBody(b); const existing=b.sku?db.prepare('SELECT id FROM products WHERE sku=?').get(b.sku):null; if(existing){ db.prepare('UPDATE products SET name_en=?,name_ar=?,category_id=?,description_en=?,description_ar=?,base_price=?,vat_rate=?,active=?,data_json=? WHERE id=?').run(b.name_en,b.name_ar,categoryId,b.description_en,b.description_ar,b.base_price||0,b.vat_rate||15,b.active!==false?1:0,JSON.stringify(b.data||{}),existing.id); return res.json({id:existing.id, updated:true}); } const r=db.prepare('INSERT INTO products(sku,name_en,name_ar,category_id,description_en,description_ar,base_price,vat_rate,active,data_json) VALUES(?,?,?,?,?,?,?,?,?,?)').run(b.sku,b.name_en,b.name_ar,categoryId,b.description_en,b.description_ar,b.base_price||0,b.vat_rate||15,b.active!==false?1:0,JSON.stringify(b.data||{})); res.json({id:r.lastInsertRowid}); });
app.put('/api/products/:id',adminAuth('products','write'),(req,res)=>{ const b=req.body; const categoryId=categoryIdFromBody(b); db.prepare('UPDATE products SET sku=?,name_en=?,name_ar=?,category_id=?,description_en=?,description_ar=?,base_price=?,vat_rate=?,active=?,data_json=? WHERE id=?').run(b.sku,b.name_en,b.name_ar,categoryId,b.description_en,b.description_ar,b.base_price||0,b.vat_rate||15,b.active!==false?1:0,JSON.stringify(b.data||{}),req.params.id); res.json({ok:true}); });
app.post('/api/products/:id/variants',adminAuth('products','write'),(req,res)=>{ const b=req.body; const r=db.prepare('INSERT INTO product_variants(product_id,size,fabric,color,color_code,selling_price_before_vat,cost,stock_qty,data_json) VALUES(?,?,?,?,?,?,?,?,?)').run(req.params.id,b.size,b.fabric,b.color,b.color_code,b.selling_price_before_vat||0,b.cost||0,b.stock_qty||0,JSON.stringify(b.data||{})); res.json({id:r.lastInsertRowid}); });
app.get('/api/discounts',adminAuth('discounts','read'),(req,res)=>res.json(db.prepare('SELECT * FROM discount_codes ORDER BY id DESC').all()));
app.post('/api/discounts',adminAuth('discounts','write'),(req,res)=>{ const b=req.body; const r=db.prepare('INSERT INTO discount_codes(code,percent,active,expires_at,usage_limit) VALUES(?,?,?,?,?)').run(String(b.code).toUpperCase(),b.percent,b.active!==false?1:0,b.expires_at,b.usage_limit); res.json({id:r.lastInsertRowid}); });
app.get('/api/discounts/validate/:code',(req,res)=>{ const v=validateDiscountCode(req.params.code); if(!v.valid) return res.status(400).json(v); res.json({valid:true, discount:{code:v.discount.code, percent:v.discount.percent}}); });
app.put('/api/discounts/:id',adminAuth('discounts','write'),(req,res)=>{ const b=req.body||{}; const existing=db.prepare('SELECT * FROM discount_codes WHERE id=?').get(req.params.id); if(!existing) return res.status(404).json({error:'Discount not found'}); db.prepare('UPDATE discount_codes SET code=COALESCE(?,code), percent=COALESCE(?,percent), active=COALESCE(?,active), expires_at=COALESCE(?,expires_at), usage_limit=COALESCE(?,usage_limit) WHERE id=?').run(b.code?String(b.code).toUpperCase():null, b.percent!=null?b.percent:null, b.active!=null?(b.active?1:0):null, b.expires_at!==undefined?b.expires_at:null, b.usage_limit!=null?b.usage_limit:null, req.params.id); auditLog(req,'discount.update','discount_code',req.params.id,{active:b.active}); res.json({ok:true}); });
app.delete('/api/discounts/:id',adminAuth('discounts','write'),(req,res)=>{ const existing=db.prepare('SELECT * FROM discount_codes WHERE id=?').get(req.params.id); if(!existing) return res.status(404).json({error:'Discount not found'}); db.prepare('DELETE FROM discount_codes WHERE id=?').run(req.params.id); auditLog(req,'discount.delete','discount_code',req.params.id,{code:existing.code}); res.json({ok:true}); });
app.post('/api/orders', writeLimiter, async (req,res)=>{
  const b=req.body || {};
  const rawItems = Array.isArray(b.items) ? b.items : [];
  if(!rawItems.length) return res.status(400).json({error:'Cart is empty'});
  const customer=b.customer||{};
  if(customer.email && !isEmail(customer.email)) return res.status(400).json({error:'Invalid customer email'});
  let cid=null;
  if(customer.email){
    const email = String(customer.email).trim().toLowerCase();
    const existing=db.prepare('SELECT id FROM customers WHERE lower(email)=lower(?)').get(email);
    cid=existing?.id || db.prepare('INSERT INTO customers(name,email,mobile,city,address) VALUES(?,?,?,?,?)')
      .run(cleanStr(customer.name,120)||'Customer',email,cleanStr(customer.mobile,50),cleanStr(b.city,100),cleanStr(b.address,500)).lastInsertRowid;
  }
  const preparedItems = [];
  for(const item of rawItems){
    const product = findProductForCartItem(item);
    if(!product) return res.status(400).json({error:`Product not found or inactive: ${cleanStr(item.name || item.id || '',120)}`});
    const variant = findVariantForCartItem(product, item);
    const qty = Math.max(1, Math.min(99, Math.floor(toNum(item.qty,1,1,99))));
    const originalBefore = variant ? toNum(variant.selling_price_before_vat,0,0) : toNum(product.base_price,0,0);
    const vatRate = toNum(product.vat_rate,15,0,100);
    const unitCost = variant ? toNum(variant.cost,0,0) : 0;
    if(originalBefore <= 0) return res.status(400).json({error:`Product price is missing: ${product.name_en}`});
    const data = json(product.data_json,{});
    const productDiscount = toNum(data.discountPercent || data.discount_percent || 0,0,0,100);
    const unitBefore = Math.max(0, originalBefore * (1 - productDiscount / 100));
    preparedItems.push({
      product_id: product.id,
      variant_id: variant?.id || null,
      name: product.name_en,
      size: variant?.size || cleanStr(item.size,120),
      fabric: variant?.fabric || cleanStr(item.fabric,120),
      color: variant?.color || cleanStr(item.color,120),
      qty, unit_price_before_vat: unitBefore, vat_rate: vatRate, unit_cost: unitCost,
      product_discount_percent: productDiscount,
      exclude_code_discount: productDiscount > 0,
      data_json: JSON.stringify({requested:item})
    });
  }
  const subtotal = preparedItems.reduce((s,i)=>s+i.unit_price_before_vat*i.qty,0);
  const code = b.discount_code || b.discountCode?.code || b.discount?.code || '';
  let discount = 0;
  let discountRow = null;
  if(code){
    const v = validateDiscountCode(code);
    if(!v.valid) return res.status(400).json({error:v.error || 'Invalid discount code'});
    discountRow = v.discount;
    const eligible = preparedItems.filter(i=>!i.exclude_code_discount).reduce((s,i)=>s+i.unit_price_before_vat*i.qty,0);
    discount = eligible * discountRow.percent / 100;
  }
  const vat = preparedItems.reduce((s,i)=>{
    const lineBefore = i.unit_price_before_vat*i.qty;
    const lineDiscount = (!i.exclude_code_discount && discountRow) ? lineBefore * discountRow.percent / 100 : 0;
    return s + Math.max(0,lineBefore-lineDiscount) * i.vat_rate / 100;
  },0);
  const deliveryBefore = deliveryBeforeVatForCity(b.city);
  const deliveryVat=deliveryBefore*0.15;
  const cogs=preparedItems.reduce((s,i)=>s+i.unit_cost*i.qty,0);
  const total=Math.max(0,subtotal-discount)+vat+deliveryBefore+deliveryVat;
  const orderNo='CV-'+Date.now();
  const tx = db.transaction(()=>{
    const r=db.prepare('INSERT INTO orders(order_no,customer_id,customer_json,city,address,notes,subtotal_before_vat,vat_amount,delivery_before_vat,delivery_vat,discount_amount,total_amount,cogs_amount) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(orderNo,cid,JSON.stringify({name:cleanStr(customer.name,120),email:cleanStr(customer.email,180),mobile:cleanStr(customer.mobile,50)}),cleanStr(b.city,100),cleanStr(b.address,500),cleanStr(b.notes,1000),subtotal,vat,deliveryBefore,deliveryVat,discount,total,cogs);
    const ins=db.prepare('INSERT INTO order_items(order_id,product_id,variant_id,name,size,fabric,color,qty,unit_price_before_vat,vat_rate,unit_cost,line_total,line_cogs,data_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    preparedItems.forEach(i=>ins.run(r.lastInsertRowid,i.product_id,i.variant_id,i.name,i.size,i.fabric,i.color,i.qty,i.unit_price_before_vat,i.vat_rate,i.unit_cost,(i.unit_price_before_vat*i.qty)*(1+i.vat_rate/100),i.unit_cost*i.qty,i.data_json));
    if(discountRow) db.prepare('UPDATE discount_codes SET usage_count=usage_count+1 WHERE id=?').run(discountRow.id);
    return r.lastInsertRowid;
  });
  const orderId = tx();
  res.json({id:orderId, order_no:orderNo, total_amount:total, subtotal_before_vat:subtotal, vat_amount:vat, discount_amount:discount});
});
app.get('/api/orders',adminAuth('orders','read'),(req,res)=>res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all().map(o=>({...o,customer:json(o.customer_json,{})}))));
app.get('/api/orders/:orderNo',(req,res)=>{ const o=db.prepare('SELECT * FROM orders WHERE order_no=?').get(req.params.orderNo); if(!o) return res.status(404).json({error:'Not found'}); const items=db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id); res.json({...o,customer:json(o.customer_json,{}),items}); });
app.put('/api/orders/:id/status',adminAuth('orders','write'),async (req,res)=>{ const {status,payment_status,payment_method,notify=true}=req.body; const o=db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id); if(!o) return res.status(404).json({error:'Not found'}); db.prepare('UPDATE orders SET status=COALESCE(?,status), payment_status=COALESCE(?,payment_status), payment_method=COALESCE(?,payment_method), updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,payment_status,payment_method,req.params.id); const c=json(o.customer_json,{}); const body=`Dear ${c.name||'Customer'}, your order ${o.order_no} is now ${status||o.status}. Payment status: ${payment_status||o.payment_status}. Thank you, Crafted Visual.`; db.prepare('INSERT INTO crm_activities(customer_id,order_id,type,channel,subject,body,status) VALUES(?,?,?,?,?,?,?)').run(o.customer_id,o.id,'order_update','automation','Order update '+o.order_no,body,'done'); if(notify){ if(c.email) db.prepare('INSERT INTO automation_outbox(order_id,customer_id,channel,recipient,subject,body) VALUES(?,?,?,?,?,?)').run(o.id,o.customer_id,'email',c.email,'Order update '+o.order_no,body); if(c.mobile) db.prepare('INSERT INTO automation_outbox(order_id,customer_id,channel,recipient,body) VALUES(?,?,?,?,?)').run(o.id,o.customer_id,'whatsapp',c.mobile,body); } res.json({ok:true}); });
app.get('/api/crm',adminAuth('crm','read'),(req,res)=>res.json({customers:db.prepare('SELECT id,name,email,mobile,city,created_at FROM customers ORDER BY created_at DESC LIMIT 500').all(), activities:db.prepare('SELECT * FROM crm_activities ORDER BY created_at DESC LIMIT 500').all(), outbox:db.prepare('SELECT * FROM automation_outbox ORDER BY created_at DESC LIMIT 500').all()}));
app.post('/api/outbox/:id/send',adminAuth('crm','write'),async (req,res)=>{ const m=db.prepare('SELECT * FROM automation_outbox WHERE id=?').get(req.params.id); if(!m) return res.status(404).json({error:'Not found'}); let result = m.channel==='email' ? await sendEmailNow(m.recipient,m.subject||'Crafted Visual',m.body) : await sendWhatsAppNow(m.recipient,m.body); db.prepare('UPDATE automation_outbox SET provider_status=?, provider_response=?, sent_at=CURRENT_TIMESTAMP WHERE id=?').run(result.skipped?'configured_required':'sent',JSON.stringify(result),m.id); res.json(result); });
app.get('/api/finance/summary',adminAuth('finance','read'),(req,res)=>{ const s=db.prepare(`SELECT COALESCE(SUM(subtotal_before_vat),0) sales_before_vat, COALESCE(SUM(vat_amount),0) vat, COALESCE(SUM(delivery_before_vat),0) delivery_before_vat, COALESCE(SUM(delivery_vat),0) delivery_vat, COALESCE(SUM(discount_amount),0) discounts, COALESCE(SUM(total_amount),0) sales_incl_vat, COALESCE(SUM(cogs_amount),0) cogs FROM orders`).get(); const e=db.prepare(`SELECT COALESCE(SUM(amount),0) expenses FROM expenses`).get(); const gross=s.sales_before_vat-s.cogs; res.json({...s, expenses:e.expenses, gross_profit:gross, gross_margin:s.sales_before_vat?gross/s.sales_before_vat*100:0, net_profit:gross-e.expenses}); });
app.post('/api/expenses',adminAuth('finance','write'),(req,res)=>{ const b=req.body; const r=db.prepare('INSERT INTO expenses(type,name,amount,expense_date,notes) VALUES(?,?,?,?,?)').run(b.type||'general',b.name,b.amount,b.expense_date,b.notes); res.json({id:r.lastInsertRowid}); });
app.get('/api/admin-users',adminAuth('users','read'),(req,res)=>{
  const rows = db.prepare('SELECT id,name,email,role,permissions_json,active,created_at FROM admin_users ORDER BY id').all();
  res.json(rows.map(u=>{
    const role = String(u.role || '').toLowerCase();
    return {
      ...u,
      permissions: (role === 'superadmin' || isDefaultSuperAdminEmail(u.email)) ? fullPermissions() : json(u.permissions_json,{})
    };
  }));
});
app.post('/api/admin-users',superAdminOnly,(req,res)=>{
  const b=req.body || {};
  if(!b.name || !b.email || !b.password || String(b.password).length < 8) return res.status(400).json({error:'Name, email, and password with at least 8 characters are required'});
  const email = String(b.email).trim().toLowerCase();
  const exists = db.prepare('SELECT id FROM admin_users WHERE lower(email)=lower(?)').get(email);
  if(exists) return res.status(409).json({error:'An admin user with this email already exists'});
  const role = String(b.role || 'admin').toLowerCase() === 'superadmin' ? 'superadmin' : 'admin';
  const permissions = role === 'superadmin' ? {} : (b.permissions || {});
  const r=db.prepare('INSERT INTO admin_users(name,email,password_hash,role,permissions_json,active) VALUES(?,?,?,?,?,?)')
    .run(b.name,email,bcrypt.hashSync(b.password,12),role,JSON.stringify(permissions),b.active!==false?1:0);
  auditLog(req,'admin_user.create','admin_user',r.lastInsertRowid,{email,role});
  res.json({id:r.lastInsertRowid});
});
app.put('/api/admin-users/:id',superAdminOnly,(req,res)=>{
  const b=req.body || {};
  const existing = db.prepare('SELECT * FROM admin_users WHERE id=?').get(req.params.id);
  if(!existing) return res.status(404).json({error:'Admin user not found'});
  if(isDefaultSuperAdminEmail(existing.email) && String(b.role || existing.role).toLowerCase() !== 'superadmin'){
    return res.status(400).json({error:'The system owner must remain superadmin'});
  }
  const role = String(b.role || existing.role || 'admin').toLowerCase() === 'superadmin' ? 'superadmin' : 'admin';
  const permissions = role === 'superadmin' ? {} : (b.permissions || json(existing.permissions_json,{}));
  db.prepare('UPDATE admin_users SET name=?, role=?, permissions_json=?, active=? WHERE id=?')
    .run(b.name || existing.name, role, JSON.stringify(permissions), b.active === false ? 0 : 1, req.params.id);
  if(b.password && String(b.password).length >= 8){
    db.prepare('UPDATE admin_users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(b.password,12), req.params.id);
  }
  auditLog(req,'admin_user.update','admin_user',req.params.id,{role});
  res.json({ok:true});
});
app.delete('/api/admin-users/:id',superAdminOnly,(req,res)=>{
  const existing = db.prepare('SELECT * FROM admin_users WHERE id=?').get(req.params.id);
  if(!existing) return res.status(404).json({error:'Admin user not found'});
  if(isDefaultSuperAdminEmail(existing.email)) return res.status(400).json({error:'Cannot delete the system owner'});
  if(req.user && Number(req.user.id) === Number(req.params.id)) return res.status(400).json({error:'You cannot delete your own account'});
  db.prepare('UPDATE admin_users SET active=0 WHERE id=?').run(req.params.id);
  auditLog(req,'admin_user.disable','admin_user',req.params.id,{email:existing.email});
  res.json({ok:true});
});
app.post('/api/upload', writeLimiter, adminAuth('products','write'), (req,res,next)=>{ upload.single('file')(req,res,(err)=>{ if(err) return res.status(400).json({error:err.message}); next(); }); }, validateUploadedImage, async (req,res,next)=>{ try{ const stored = await storeUploadedImage(req.file); auditLog(req,'upload.create','upload',stored.provider_id,{provider:stored.provider,url:stored.url}); res.json({url:stored.url, original:req.file.originalname, provider:stored.provider}); }catch(e){ next(e); } });

// ===== Media Library =====
// Backed by media_assets (metadata) + media_assignments (links to products/banners/pages/sections).
// Authorization: any admin with the `media` permission, or any super admin (handled by adminAuth).
const MEDIA_TARGETS = new Set(['product','banner','page','section']);

app.get('/api/media', adminAuth('media','read'), (req,res)=>{
  const rows = db.prepare(`SELECT m.*, a.name uploader_name FROM media_assets m LEFT JOIN admin_users a ON a.id=m.uploaded_by ORDER BY m.created_at DESC, m.id DESC`).all();
  const assigns = db.prepare('SELECT * FROM media_assignments ORDER BY created_at DESC').all();
  const byMedia = {};
  assigns.forEach(a => { (byMedia[a.media_id] = byMedia[a.media_id] || []).push(a); });
  res.json(rows.map(m => ({...m, assignments: byMedia[m.id] || []})));
});

app.post('/api/media', writeLimiter, adminAuth('media','write'),
  (req,res,next)=>{ upload.single('file')(req,res,(err)=>{ if(err) return res.status(400).json({error:err.message}); next(); }); },
  validateUploadedImage,
  async (req,res,next)=>{
    try{
      const stored = await storeUploadedImage(req.file);
      const url = stored.url;
      const alt = sanitizeText(req.body?.alt_text || req.body?.alt || '', 300);
      const r = db.prepare(`INSERT INTO media_assets(filename,original_name,url,mime,type,size_bytes,alt_text,uploaded_by) VALUES(?,?,?,?,?,?,?,?)`)
        .run(stored.filename || req.file.filename, sanitizeText(req.file.originalname || '', 300), url, req.file.mimetype, 'image', req.file.size || 0, alt, req.user?.id || null);
      auditLog(req,'media.upload','media',r.lastInsertRowid,{url, size:req.file.size, provider:stored.provider});
      res.json(db.prepare('SELECT * FROM media_assets WHERE id=?').get(r.lastInsertRowid));
    }catch(e){ next(e); }
  }
);

app.put('/api/media/:id', adminAuth('media','write'), (req,res)=>{
  const m = db.prepare('SELECT * FROM media_assets WHERE id=?').get(req.params.id);
  if(!m) return res.status(404).json({error:'Media not found'});
  const alt = sanitizeText(req.body?.alt_text ?? m.alt_text, 300);
  db.prepare('UPDATE media_assets SET alt_text=? WHERE id=?').run(alt, req.params.id);
  res.json({ok:true});
});

app.delete('/api/media/:id', adminAuth('media','write'), (req,res)=>{
  const m = db.prepare('SELECT * FROM media_assets WHERE id=?').get(req.params.id);
  if(!m) return res.status(404).json({error:'Media not found'});
  db.prepare('DELETE FROM media_assignments WHERE media_id=?').run(m.id);
  db.prepare('DELETE FROM media_assets WHERE id=?').run(m.id);
  try{
    if(String(m.url || '').startsWith('/uploads/')){
      const safeName = path.basename(m.filename || '');
      if(safeName) fs.unlinkSync(path.join(uploadDir, safeName));
    }
  }catch(e){ /* file already gone */ }
  auditLog(req,'media.delete','media',req.params.id,{url:m.url});
  res.json({ok:true});
});

// Assign a media asset to a product, banner slot, page, or website section.
app.post('/api/media/:id/assign', adminAuth('media','write'), (req,res)=>{
  const m = db.prepare('SELECT * FROM media_assets WHERE id=?').get(req.params.id);
  if(!m) return res.status(404).json({error:'Media not found'});
  const targetType = String(req.body?.target_type || '').toLowerCase();
  const targetId = sanitizeText(req.body?.target_id || '', 200);
  if(!MEDIA_TARGETS.has(targetType)) return res.status(400).json({error:'target_type must be one of product, banner, page, section'});

  const r = db.prepare('INSERT INTO media_assignments(media_id,target_type,target_id,created_by) VALUES(?,?,?,?)')
    .run(m.id, targetType, targetId, req.user?.id || null);

  // Reflect the assignment where the live site actually reads from.
  try{
    if(targetType === 'banner'){
      const settings = getSettingObject();
      const banners = Array.isArray(settings.hero_banners) ? settings.hero_banners.slice(0,5) : [];
      const slot = Math.max(1, Math.min(5, Number(targetId) || (banners.length + 1))) - 1;
      banners[slot] = m.url;
      settings.hero_banners = banners.filter(Boolean);
      settings.hero_image = settings.hero_banners[0] || settings.hero_image || m.url;
      saveSettingObject(settings);
    } else if(targetType === 'product' && targetId){
      const p = db.prepare('SELECT * FROM products WHERE id=? OR sku=?').get(targetId, targetId);
      if(p){
        const data = json(p.data_json, {});
        data.gallery = Array.isArray(data.gallery) ? data.gallery : [];
        if(!data.gallery.includes(m.url)) data.gallery.push(m.url);
        db.prepare('UPDATE products SET data_json=? WHERE id=?').run(JSON.stringify(data), p.id);
      }
    } else if(targetType === 'page' || targetType === 'section'){
      const settings = getSettingObject();
      settings.section_media = settings.section_media || {};
      settings.section_media[`${targetType}:${targetId}`] = m.url;
      saveSettingObject(settings);
    }
  }catch(e){ console.warn('media assignment side-effect skipped:', e.message); }

  auditLog(req,'media.assign','media',m.id,{targetType, targetId});
  res.json({id:r.lastInsertRowid, ok:true});
});

app.delete('/api/media/assignments/:assignId', adminAuth('media','write'), (req,res)=>{
  const a = db.prepare('SELECT * FROM media_assignments WHERE id=?').get(req.params.assignId);
  if(!a) return res.status(404).json({error:'Assignment not found'});
  db.prepare('DELETE FROM media_assignments WHERE id=?').run(a.id);
  res.json({ok:true});
});


const SAFE_HTML_FILES = new Set([
  'index.html','shop.html','admin.html','admin-login.html','auth.html','account.html',
  'contact.html','track-order.html','review.html','payment.html','thankyou.html',
  'orders.html','financial-dashboard.html','customer-journey-dashboard.html','crm.html',
  'audit-logs.html','discounted-items.html','page.html','estimator final.html',
  'privacy-policy.html','terms-and-conditions.html','cookie-policy.html','help.html'
]);
function safeInside(base, target){
  const rel = path.relative(base, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}
function htmlFileForRequest(req){
  let requested = req.path === '/' ? '/index.html' : req.path;
  if(!path.extname(requested)) requested += '.html';
  if(path.extname(requested).toLowerCase() !== '.html') return null;
  const fileName = decodeURIComponent(requested.replace(/^\/+/, ''));
  if(!SAFE_HTML_FILES.has(fileName)) return null;
  const publicDir = path.join(__dirname, 'public');
  const rootCandidate = path.join(__dirname, fileName);
  const publicCandidate = path.join(publicDir, fileName);
  if(safeInside(publicDir, publicCandidate) && fs.existsSync(publicCandidate) && fs.statSync(publicCandidate).isFile()) return publicCandidate;
  // Fallback for Railway deployments where the frontend files were uploaded at project root.
  // This keeps backend/source files protected by only allowing known HTML entrypoints.
  if(fs.existsSync(rootCandidate) && fs.statSync(rootCandidate).isFile()) return rootCandidate;
  return null;
}
function htmlEscape(v=''){
  return String(v || '').replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;'}[c]));
}
function jsonLdSafe(data){
  return JSON.stringify(data).replace(/<\/script/gi, '<\\/script');
}
function seoPageKeyForRequest(req){
  const file = (req.path === '/' ? 'index.html' : path.basename(req.path || '')).toLowerCase();
  if(file === 'index.html' || file === '') return 'home';
  if(file === 'shop.html') return req.query && req.query.product ? 'product' : 'shop';
  if(file === 'discounted-items.html') return 'shop';
  if(file === 'contact.html') return 'contact';
  if(file === 'track-order.html') return 'track';
  if(file === 'account.html' || file === 'auth.html') return 'account';
  return 'product';
}
function seoField(pageSeo, field, lang='en'){
  return pageSeo?.[`${field}_${lang}`] || pageSeo?.[field] || pageSeo?.[`${field}_en`] || '';
}
function canonicalForRequest(req){
  const url = new URL(req.originalUrl || req.path || '/', 'https://example.com');
  url.searchParams.delete('lang');
  const pathWithQuery = (url.pathname || '/').replace(/^\//,'') + (url.search || '');
  return absoluteUrl(req, pathWithQuery);
}
function productSeoOverride(req){
  const wanted = req.query && (req.query.product || req.query.id);
  if(!wanted) return null;
  try{
    const bySku = db.prepare('SELECT * FROM products WHERE sku=? AND active=1 LIMIT 1').get(String(wanted));
    const row = bySku || (String(Number(wanted)) === String(wanted) ? db.prepare('SELECT * FROM products WHERE id=? AND active=1 LIMIT 1').get(Number(wanted)) : null);
    if(!row) return null;
    let images = [];
    try{ images = JSON.parse(row.images_json || row.images || '[]'); }catch(_e){}
    return {
      name: row.name_en || row.name || row.name_ar || '',
      description: row.description_en || row.description || row.description_ar || '',
      image: images[0] || row.image_url || row.image || ''
    };
  }catch(_e){ return null; }
}
function buildServerSeoTags(req){
  const settings = getSettingObject();
  const seoPages = Object.assign({}, DEFAULT_SEO_PAGES, settings.seo_pages || {});
  const lang = req.query && req.query.lang === 'ar' ? 'ar' : 'en';
  const key = seoPageKeyForRequest(req);
  const pageSeo = seoPages[key] || seoPages.home || {};
  const product = key === 'product' ? productSeoOverride(req) : null;
  const brandName = lang === 'ar' ? (settings.brand_ar || settings.seo_store_name_ar || 'كرافتد فيزوال') : (settings.brand_en || settings.seo_store_name_en || 'Crafted Visual');
  let title = seoField(pageSeo, 'title', lang) || `${brandName}`;
  let description = seoField(pageSeo, 'description', lang);
  let image = settings.seo_default_image || settings.hero_image || (Array.isArray(settings.hero_banners) && settings.hero_banners[0]) || '';
  if(product){
    if(product.name) title = `${product.name} | ${brandName}`;
    if(product.description) description = product.description;
    if(product.image) image = product.image;
  }
  const canonical = canonicalForRequest(req);
  const imageUrl = image ? (String(image).startsWith('http') ? image : absoluteUrl(req, String(image).replace(/^\//,''))) : '';
  const keywords = Array.isArray(pageSeo.keywords) ? pageSeo.keywords.join(', ') : (pageSeo.keywords || '');
  const schema = {
    '@context':'https://schema.org', '@type':'FurnitureStore', name:brandName, url:absoluteUrl(req,''), image:imageUrl || undefined,
    telephone:settings.footer_phone || settings.whatsapp_number || '', email:settings.footer_email || settings.customer_care_email || '',
    address:{'@type':'PostalAddress', addressLocality:'Riyadh', addressCountry:'SA'},
    sameAs:[settings.instagram_url,settings.tiktok_url,settings.facebook_url,settings.linkedin_url].filter(Boolean)
  };
  return `
  <title>${htmlEscape(title)}</title>
  <meta name="description" content="${htmlEscape(description)}">
  ${keywords ? `<meta name="keywords" content="${htmlEscape(keywords)}">` : ''}
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="author" content="${htmlEscape(brandName)}">
  <link rel="canonical" href="${htmlEscape(canonical)}">
  <meta property="og:title" content="${htmlEscape(title)}">
  <meta property="og:description" content="${htmlEscape(description)}">
  <meta property="og:type" content="${product ? 'product' : 'website'}">
  <meta property="og:url" content="${htmlEscape(canonical)}">
  ${imageUrl ? `<meta property="og:image" content="${htmlEscape(imageUrl)}">` : ''}
  <meta property="og:locale" content="${lang === 'ar' ? 'ar_SA' : 'en_US'}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${htmlEscape(title)}">
  <meta name="twitter:description" content="${htmlEscape(description)}">
  ${imageUrl ? `<meta name="twitter:image" content="${htmlEscape(imageUrl)}">` : ''}
  <script type="application/ld+json" id="cv-store-schema">${jsonLdSafe(schema)}</script>`;
}
function applyServerSeoTransforms(html, req){
  let out = html;
  out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/ig, '');
  out = out.replace(/<meta\s+(?:name|property)=["'](?:description|keywords|robots|author|language|og:title|og:description|og:type|og:url|og:image|og:locale|twitter:card|twitter:title|twitter:description|twitter:image)["'][^>]*>\s*/ig, '');
  out = out.replace(/<link\s+rel=["'](?:canonical|alternate)["'][^>]*>\s*/ig, '');
  out = out.replace(/<script[^>]*id=["']cv-store-schema["'][^>]*>[\s\S]*?<\/script>\s*/ig, '');
  if(/<head([^>]*)>/i.test(out)){
    return out.replace(/<head([^>]*)>/i, `<head$1>${buildServerSeoTags(req)}
`);
  }
  return out;
}
function applyHtmlSecurityTransforms(html, nonce, req){
  let out = applyServerSeoTransforms(html, req);
  if(!out.includes('cv-csp-action-bridge.js')){
    out = out.replace(/<head([^>]*)>/i, `<head$1>
  <script nonce="${nonce}" src="/cv-csp-action-bridge.js" defer></script>`);
  }
  if(!out.includes('cv-csrf-fetch-bridge')){
    out = out.replace(/<head([^>]*)>/i, `<head$1>
  <script nonce="${nonce}" id="cv-csrf-fetch-bridge">(function(){if(window.__cvCsrfFetchPatched)return;window.__cvCsrfFetchPatched=true;function token(){return(document.cookie.split('; ').find(function(v){return v.indexOf('cv_csrf_token=')===0;})||'').split('=').slice(1).join('=');}var originalFetch=window.fetch;window.fetch=function(input,init){init=init||{};var method=String(init.method||(input&&input.method)||'GET').toUpperCase();var url=String((input&&input.url)||input||'');var sameOrigin=!/^https?:\/\//i.test(url)||url.indexOf(location.origin)===0;if(sameOrigin&&['POST','PUT','PATCH','DELETE'].indexOf(method)!==-1){var headers=new Headers(init.headers||(input&&input.headers)||{});if(!headers.has('X-CSRF-Token'))headers.set('X-CSRF-Token',decodeURIComponent(token()||''));init.headers=headers;}return originalFetch.call(this,input,init);};})();</script>`);
  }
  out = out.replace(/<script(?![^>]*src=)(?![^>]*nonce=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`);
  return out;
}

// Safe frontend asset resolver: serve whitelisted CSS/JS/JSON/image assets from /public first,
// then from project root as a Railway fallback. This prevents unstyled pages when a deploy
// contains root-level frontend files but no populated /public folder.
const SAFE_ASSET_EXTENSIONS = new Set(['.css','.js','.json','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.map','.txt']);
function safeAssetFileForRequest(req){
  const pathname = decodeURIComponent(req.path || '');
  const fileName = pathname.replace(/^\/+/, '');
  if(!fileName || fileName.includes('..')) return null;
  const ext = path.extname(fileName).toLowerCase();
  if(!SAFE_ASSET_EXTENSIONS.has(ext)) return null;
  if(fileName.match(/^(server|db|schema|seed|pg-sync-worker)\.js$/i)) return null;
  if(fileName.match(/^(package|package-lock|railway|nixpacks)\./i)) return null;
  if(fileName.startsWith('security/') || fileName.startsWith('test/') || fileName.startsWith('crm/')) return null;
  const publicDir = path.join(__dirname, 'public');
  const rootDir = __dirname;
  const publicCandidate = path.join(publicDir, fileName);
  const rootCandidate = path.join(rootDir, fileName);
  if(safeInside(publicDir, publicCandidate) && fs.existsSync(publicCandidate) && fs.statSync(publicCandidate).isFile()) return publicCandidate;
  if(safeInside(rootDir, rootCandidate) && fs.existsSync(rootCandidate) && fs.statSync(rootCandidate).isFile()) return rootCandidate;
  return null;
}
app.get('*', (req,res,next)=>{
  const file = safeAssetFileForRequest(req);
  if(!file) return next();
  res.sendFile(file);
});

app.get(['/', '/*.html'], (req,res,next)=>{
  const file = htmlFileForRequest(req);
  if(!file) return next();
  try{
    const html = fs.readFileSync(file, 'utf8');
    res.type('html').send(applyHtmlSecurityTransforms(html, res.locals.cspNonce, req));
  }catch(e){ next(e); }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { fallthrough:false, setHeaders(res){ res.setHeader('X-Content-Type-Options','nosniff'); } }));
// Production frontend assets are served from /public only.
// Root-level backend and source files are never exposed as static assets.
app.use(express.static(path.join(__dirname, 'public'), { extensions:['html'], fallthrough:true }));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: IS_PROD ? 'Server error' : err.message }); });
app.listen(PORT,()=>console.log(`Crafted Visual platform running securely: http://localhost:${PORT}`));
