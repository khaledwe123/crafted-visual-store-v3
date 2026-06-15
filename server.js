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

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || !IS_PROD || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS origin not allowed'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:", "https:"],
      "connect-src": ["'self'"],
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
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
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

function json(v,d={}){ try{return JSON.parse(v||'')}catch{return d} }
function token(user,type){ return jwt.sign({id:user.id,email:user.email,role:user.role,type}, ACTIVE_JWT_SECRET, {expiresIn:'12h'}); }
function auth(req,res,next){ const h=req.headers.authorization||''; try{ req.user=jwt.verify(h.replace('Bearer ',''),ACTIVE_JWT_SECRET); next(); } catch(e){ res.status(401).json({error:'Unauthorized'}); } }
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
app.get('/api/health',(req,res)=>res.json({ok:true, platform:'Crafted Visual DB Ecommerce', time:new Date().toISOString()}));
app.get('/api/version',(req,res)=>res.json({version:'CRAFTED-VISUAL-SUPERADMIN-MEDIA-FIX-20260609-18', superadminFix:true, mediaLibrary:true, publicTopRibbon:false, publicAnalyticsMenu:false, adminLogin:true, time:new Date().toISOString()}));

app.get('/api/settings',(req,res)=>res.json(getSettingObject()));
app.put('/api/settings', adminAuth('settings','write'), (req,res)=>{ saveSettingObject(req.body || {}); res.json({ok:true, settings:getSettingObject()}); });
app.post('/api/settings', adminAuth('settings','write'), (req,res)=>{ saveSettingObject(req.body || {}); res.json({ok:true, settings:getSettingObject()}); });

app.get('/robots.txt',(req,res)=>{
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin-login.html\nDisallow: /orders.html\nDisallow: /crm.html\nDisallow: /financial-dashboard.html\nSitemap: ${absoluteUrl(req,'sitemap.xml')}\n`);
});

app.get('/sitemap.xml',(req,res)=>{
  const basePages = ['', 'shop.html', 'contact.html', 'track-order.html', 'account.html'];
  const products = db.prepare('SELECT id, sku, created_at FROM products WHERE active=1 ORDER BY id DESC').all();
  const urls = [];
  basePages.forEach(p => urls.push({loc:absoluteUrl(req,p), changefreq:p===''?'weekly':'monthly', priority:p===''?'1.0':'0.8'}));
  products.forEach(p => urls.push({loc:absoluteUrl(req, 'shop.html?product=' + encodeURIComponent(p.sku || p.id)), changefreq:'weekly', priority:'0.7', lastmod:(p.created_at||'').slice(0,10)}));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` + urls.map(u => `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>${u.lastmod?`\n    <lastmod>${xmlEscape(u.lastmod)}</lastmod>`:''}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n') + `\n</urlset>`;
  res.type('application/xml').send(xml);
});


// 95/100 maturity: customer journey, source tracking, funnel, inventory and audit endpoints
app.post('/api/journey', writeLimiter, (req,res)=>{
  const b=req.body || {};
  const meta = b.metadata && typeof b.metadata === 'object' ? b.metadata : {};
  const sessionId = sanitizeText(b.session_id || b.sessionId || crypto.randomUUID(), 120);
  const eventType = sanitizeText(b.event_type || b.eventType || 'event', 80);
  db.prepare(`INSERT INTO customer_journey_events(session_id,customer_id,event_type,page_url,page_title,product_id,product_name,source,medium,campaign,term,content,referrer,device,ip_hash,user_agent,metadata_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      sessionId,
      b.customer_id || null,
      eventType,
      sanitizeText(b.page_url || b.pageUrl || '', 1000),
      sanitizeText(b.page_title || b.pageTitle || '', 300),
      b.product_id || null,
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
});
app.post('/api/cart/abandoned', writeLimiter, (req,res)=>{
  const b=req.body || {};
  const sessionId = sanitizeText(b.session_id || b.sessionId || crypto.randomUUID(), 120);
  const cartJson = JSON.stringify(Array.isArray(b.cart) ? b.cart : []);
  const existing = db.prepare('SELECT id FROM abandoned_carts WHERE session_id=? AND status=? ORDER BY id DESC').get(sessionId,'open');
  if(existing){
    db.prepare('UPDATE abandoned_carts SET cart_json=?, source=?, campaign=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(cartJson, sanitizeText(b.source||'',120), sanitizeText(b.campaign||'',160), existing.id);
    return res.json({ok:true, id:existing.id, updated:true});
  }
  const r=db.prepare('INSERT INTO abandoned_carts(session_id,customer_id,cart_json,source,campaign) VALUES(?,?,?,?,?)').run(sessionId,b.customer_id||null,cartJson,sanitizeText(b.source||'',120),sanitizeText(b.campaign||'',160));
  res.json({ok:true,id:r.lastInsertRowid});
});
app.get('/api/journey/summary', adminAuth('analytics','read'), (req,res)=>{
  const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
  const since = `-${days} days`;
  const totals = db.prepare(`SELECT COUNT(*) events, COUNT(DISTINCT session_id) sessions FROM customer_journey_events WHERE created_at >= datetime('now', ?)`).get(since);
  const funnel = db.prepare(`SELECT event_type, COUNT(*) count, COUNT(DISTINCT session_id) sessions FROM customer_journey_events WHERE created_at >= datetime('now', ?) GROUP BY event_type ORDER BY count DESC`).all(since);
  const sources = db.prepare(`SELECT COALESCE(NULLIF(source,''),'direct') source, COALESCE(NULLIF(medium,''),'none') medium, COUNT(DISTINCT session_id) sessions, COUNT(*) events FROM customer_journey_events WHERE created_at >= datetime('now', ?) GROUP BY source, medium ORDER BY sessions DESC LIMIT 20`).all(since);
  const pages = db.prepare(`SELECT page_url, COUNT(*) views, COUNT(DISTINCT session_id) sessions FROM customer_journey_events WHERE event_type='page_view' AND created_at >= datetime('now', ?) GROUP BY page_url ORDER BY views DESC LIMIT 20`).all(since);
  const products = db.prepare(`SELECT product_name, product_id, COUNT(*) views, COUNT(DISTINCT session_id) sessions FROM customer_journey_events WHERE event_type IN ('product_view','view_details') AND created_at >= datetime('now', ?) GROUP BY product_name, product_id ORDER BY views DESC LIMIT 20`).all(since);
  const abandoned = db.prepare(`SELECT COUNT(*) open_carts FROM abandoned_carts WHERE status='open' AND updated_at >= datetime('now', ?)`).get(since);
  res.json({days, totals, funnel, sources, pages, products, abandoned});
});
app.get('/api/journey/events', adminAuth('analytics','read'), (req,res)=>{
  const rows = db.prepare('SELECT * FROM customer_journey_events ORDER BY created_at DESC LIMIT 500').all().map(r=>({...r, metadata: json(r.metadata_json,{})}));
  res.json(rows);
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
  res.json({
    token:token(user,'admin'),
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
app.post('/api/customers/register', authLimiter, (req,res)=>{ const {name,email,mobile,password,city,address}=req.body; const hash=password?bcrypt.hashSync(password,10):null; const r=db.prepare('INSERT INTO customers(name,email,mobile,password_hash,city,address) VALUES(?,?,?,?,?,?)').run(name,email,mobile,hash,city,address); const u=db.prepare('SELECT id,name,email,mobile,city,address FROM customers WHERE id=?').get(r.lastInsertRowid); res.json({token:token({...u,role:'customer'},'customer'), user:u}); });
app.post('/api/customers/login', authLimiter, (req,res)=>{ const {email,password}=req.body; const u=db.prepare('SELECT * FROM customers WHERE lower(email)=lower(?)').get(email||''); if(!u || !u.password_hash || !bcrypt.compareSync(password||'',u.password_hash)) return res.status(401).json({error:'Invalid login'}); res.json({token:token({...u,role:'customer'},'customer'), user:{id:u.id,name:u.name,email:u.email,mobile:u.mobile,city:u.city,address:u.address}}); });
app.get('/api/categories',(req,res)=>res.json(db.prepare('SELECT * FROM categories WHERE active=1 ORDER BY sort_order,name_en').all()));
app.post('/api/categories',adminAuth('categories','write'),(req,res)=>{ const r=db.prepare('INSERT INTO categories(name_en,name_ar,active,sort_order) VALUES(?,?,?,?)').run(req.body.name_en,req.body.name_ar||'',req.body.active!==false?1:0,req.body.sort_order||0); res.json(db.prepare('SELECT * FROM categories WHERE id=?').get(r.lastInsertRowid)); });
app.get('/api/products',(req,res)=>res.json(db.prepare(`SELECT p.*, c.name_en category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1 ORDER BY p.created_at DESC`).all().map(p=>({...p,data:json(p.data_json,{})}))));
app.get('/api/products/:id',(req,res)=>{ const p=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id); if(!p) return res.status(404).json({error:'Not found'}); const variants=db.prepare('SELECT * FROM product_variants WHERE product_id=?').all(p.id); res.json({...p,data:json(p.data_json,{}),variants}); });
app.post('/api/products',adminAuth('products','write'),(req,res)=>{ const b=req.body; const categoryId=categoryIdFromBody(b); const existing=b.sku?db.prepare('SELECT id FROM products WHERE sku=?').get(b.sku):null; if(existing){ db.prepare('UPDATE products SET name_en=?,name_ar=?,category_id=?,description_en=?,description_ar=?,base_price=?,vat_rate=?,active=?,data_json=? WHERE id=?').run(b.name_en,b.name_ar,categoryId,b.description_en,b.description_ar,b.base_price||0,b.vat_rate||15,b.active!==false?1:0,JSON.stringify(b.data||{}),existing.id); return res.json({id:existing.id, updated:true}); } const r=db.prepare('INSERT INTO products(sku,name_en,name_ar,category_id,description_en,description_ar,base_price,vat_rate,active,data_json) VALUES(?,?,?,?,?,?,?,?,?,?)').run(b.sku,b.name_en,b.name_ar,categoryId,b.description_en,b.description_ar,b.base_price||0,b.vat_rate||15,b.active!==false?1:0,JSON.stringify(b.data||{})); res.json({id:r.lastInsertRowid}); });
app.put('/api/products/:id',adminAuth('products','write'),(req,res)=>{ const b=req.body; const categoryId=categoryIdFromBody(b); db.prepare('UPDATE products SET sku=?,name_en=?,name_ar=?,category_id=?,description_en=?,description_ar=?,base_price=?,vat_rate=?,active=?,data_json=? WHERE id=?').run(b.sku,b.name_en,b.name_ar,categoryId,b.description_en,b.description_ar,b.base_price||0,b.vat_rate||15,b.active!==false?1:0,JSON.stringify(b.data||{}),req.params.id); res.json({ok:true}); });
app.post('/api/products/:id/variants',adminAuth('products','write'),(req,res)=>{ const b=req.body; const r=db.prepare('INSERT INTO product_variants(product_id,size,fabric,color,color_code,selling_price_before_vat,cost,stock_qty,data_json) VALUES(?,?,?,?,?,?,?,?,?)').run(req.params.id,b.size,b.fabric,b.color,b.color_code,b.selling_price_before_vat||0,b.cost||0,b.stock_qty||0,JSON.stringify(b.data||{})); res.json({id:r.lastInsertRowid}); });
app.get('/api/discounts',adminAuth('discounts','read'),(req,res)=>res.json(db.prepare('SELECT * FROM discount_codes ORDER BY id DESC').all()));
app.post('/api/discounts',adminAuth('discounts','write'),(req,res)=>{ const b=req.body; const r=db.prepare('INSERT INTO discount_codes(code,percent,active,expires_at,usage_limit) VALUES(?,?,?,?,?)').run(String(b.code).toUpperCase(),b.percent,b.active!==false?1:0,b.expires_at,b.usage_limit); res.json({id:r.lastInsertRowid}); });
app.get('/api/discounts/validate/:code',(req,res)=>{ const c=db.prepare('SELECT * FROM discount_codes WHERE code=? AND active=1').get(String(req.params.code).toUpperCase()); if(!c) return res.status(404).json({valid:false}); if(c.expires_at && new Date(c.expires_at)<new Date()) return res.status(400).json({valid:false,error:'Expired'}); if(c.usage_limit && c.usage_count>=c.usage_limit) return res.status(400).json({valid:false,error:'Usage limit reached'}); res.json({valid:true,discount:c}); });
app.put('/api/discounts/:id',adminAuth('discounts','write'),(req,res)=>{ const b=req.body||{}; const existing=db.prepare('SELECT * FROM discount_codes WHERE id=?').get(req.params.id); if(!existing) return res.status(404).json({error:'Discount not found'}); db.prepare('UPDATE discount_codes SET code=COALESCE(?,code), percent=COALESCE(?,percent), active=COALESCE(?,active), expires_at=COALESCE(?,expires_at), usage_limit=COALESCE(?,usage_limit) WHERE id=?').run(b.code?String(b.code).toUpperCase():null, b.percent!=null?b.percent:null, b.active!=null?(b.active?1:0):null, b.expires_at!==undefined?b.expires_at:null, b.usage_limit!=null?b.usage_limit:null, req.params.id); auditLog(req,'discount.update','discount_code',req.params.id,{active:b.active}); res.json({ok:true}); });
app.delete('/api/discounts/:id',adminAuth('discounts','write'),(req,res)=>{ const existing=db.prepare('SELECT * FROM discount_codes WHERE id=?').get(req.params.id); if(!existing) return res.status(404).json({error:'Discount not found'}); db.prepare('DELETE FROM discount_codes WHERE id=?').run(req.params.id); auditLog(req,'discount.delete','discount_code',req.params.id,{code:existing.code}); res.json({ok:true}); });
app.post('/api/orders', writeLimiter, async (req,res)=>{ const b=req.body; const customer=b.customer||{}; let cid=null; if(customer.email){ const existing=db.prepare('SELECT id FROM customers WHERE lower(email)=lower(?)').get(customer.email); cid=existing?.id || db.prepare('INSERT INTO customers(name,email,mobile,city,address) VALUES(?,?,?,?,?)').run(customer.name||'Customer',customer.email,customer.mobile,b.city,b.address).lastInsertRowid; }
 const orderNo='CV-'+Date.now(); const subtotal=(b.items||[]).reduce((s,i)=>s+Number(i.unit_price_before_vat||i.price||0)*Number(i.qty||1),0); const vat=(b.items||[]).reduce((s,i)=>s+(Number(i.unit_price_before_vat||i.price||0)*Number(i.qty||1)*Number(i.vat_rate||15)/100),0); const deliveryBefore=Number(b.delivery_before_vat||0); const deliveryVat=deliveryBefore*0.15; const discount=Number(b.discount_amount||0); const cogs=(b.items||[]).reduce((s,i)=>s+Number(i.unit_cost||i.cost||0)*Number(i.qty||1),0); const total=subtotal+vat+deliveryBefore+deliveryVat-discount;
 const r=db.prepare('INSERT INTO orders(order_no,customer_id,customer_json,city,address,notes,subtotal_before_vat,vat_amount,delivery_before_vat,delivery_vat,discount_amount,total_amount,cogs_amount) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(orderNo,cid,JSON.stringify(customer),b.city,b.address,b.notes,subtotal,vat,deliveryBefore,deliveryVat,discount,total,cogs);
 const orderId=r.lastInsertRowid; const ins=db.prepare('INSERT INTO order_items(order_id,product_id,variant_id,name,size,fabric,color,qty,unit_price_before_vat,vat_rate,unit_cost,line_total,line_cogs,data_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)'); (b.items||[]).forEach(i=>ins.run(orderId,i.product_id||null,i.variant_id||null,i.name,i.size,i.fabric,i.color,i.qty||1,i.unit_price_before_vat||i.price||0,i.vat_rate||15,i.unit_cost||i.cost||0,Number(i.price||i.unit_price_before_vat||0)*Number(i.qty||1),Number(i.cost||i.unit_cost||0)*Number(i.qty||1),JSON.stringify(i)));
 db.prepare('INSERT INTO crm_activities(customer_id,order_id,type,channel,subject,body,status) VALUES(?,?,?,?,?,?,?)').run(cid,orderId,'order_created','system','New order '+orderNo,`Order ${orderNo} created with total SAR ${Math.round(total)}`,'done');
 res.json({id:orderId,order_no:orderNo,total_amount:total}); });
app.get('/api/orders',adminAuth('orders','read'),(req,res)=>res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all().map(o=>({...o,customer:json(o.customer_json,{})}))));
app.get('/api/orders/:orderNo',(req,res)=>{ const o=db.prepare('SELECT * FROM orders WHERE order_no=?').get(req.params.orderNo); if(!o) return res.status(404).json({error:'Not found'}); const items=db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id); res.json({...o,customer:json(o.customer_json,{}),items}); });

// Customer payment-method confirmation. This does NOT mark an order as paid.
// It only records the selected method and moves the order to awaiting payment/verification.
app.post('/api/orders/:orderNo/payment', writeLimiter, (req,res)=>{
 const orderNo = String(req.params.orderNo || '').trim();
 const o = db.prepare('SELECT * FROM orders WHERE order_no=?').get(orderNo);
 if(!o) return res.status(404).json({error:'Order not found'});
 const allowedMethods = ['Bank Transfer','Cash on Delivery','Geidea Hosted Checkout','Mada','Visa','Mastercard','Apple Pay','Samsung Pay'];
 const c = json(o.customer_json,{});
 if(c.email && String(req.body.customer_email||'').toLowerCase() !== String(c.email).toLowerCase()) return res.status(403).json({error:'Customer verification failed'});
 const method = allowedMethods.includes(req.body.payment_method) ? req.body.payment_method : 'Bank Transfer';
 const paymentStatus = method === 'Cash on Delivery' ? 'cod_pending' : 'awaiting_payment_verification';
 const status = method === 'Cash on Delivery' ? 'confirmed' : 'awaiting_payment';
 db.prepare('UPDATE orders SET status=?, payment_status=?, payment_method=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,paymentStatus,method,o.id);
 const body = `Dear ${c.name||'Customer'}, your order ${o.order_no} has been received. Payment method: ${method}. Payment status: ${paymentStatus}. Crafted Visual will verify the payment and update you.`;
 db.prepare('INSERT INTO crm_activities(customer_id,order_id,type,channel,subject,body,status) VALUES(?,?,?,?,?,?,?)').run(o.customer_id,o.id,'payment_method_selected','website','Payment method selected '+o.order_no,body,'done');
 if(c.email) db.prepare('INSERT INTO automation_outbox(order_id,customer_id,channel,recipient,subject,body) VALUES(?,?,?,?,?,?)').run(o.id,o.customer_id,'email',c.email,'Order received '+o.order_no,body);
 if(c.mobile) db.prepare('INSERT INTO automation_outbox(order_id,customer_id,channel,recipient,body) VALUES(?,?,?,?,?)').run(o.id,o.customer_id,'whatsapp',c.mobile,body);
 res.json({ok:true, order_no:o.order_no, status, payment_status:paymentStatus, payment_method:method});
});

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
app.post('/api/upload', writeLimiter, adminAuth('products','write'), (req,res,next)=>{ upload.single('file')(req,res,(err)=>{ if(err) return res.status(400).json({error:err.message}); next(); }); }, (req,res)=>{ if(!req.file) return res.status(400).json({error:'No file uploaded'}); res.json({url:'/uploads/'+req.file.filename, original:req.file.originalname}); });

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
  (req,res)=>{
    if(!req.file) return res.status(400).json({error:'No image file uploaded'});
    const url = '/uploads/' + req.file.filename;
    const alt = sanitizeText(req.body?.alt_text || req.body?.alt || '', 300);
    const r = db.prepare(`INSERT INTO media_assets(filename,original_name,url,mime,type,size_bytes,alt_text,uploaded_by) VALUES(?,?,?,?,?,?,?,?)`)
      .run(req.file.filename, sanitizeText(req.file.originalname || '', 300), url, req.file.mimetype, 'image', req.file.size || 0, alt, req.user?.id || null);
    auditLog(req,'media.upload','media',r.lastInsertRowid,{url, size:req.file.size});
    res.json(db.prepare('SELECT * FROM media_assets WHERE id=?').get(r.lastInsertRowid));
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
    const safeName = path.basename(m.filename || '');
    if(safeName) fs.unlinkSync(path.join(uploadDir, safeName));
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

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: IS_PROD ? 'Server error' : err.message }); });
app.listen(PORT,()=>console.log(`Crafted Visual platform running securely: http://localhost:${PORT}`));
