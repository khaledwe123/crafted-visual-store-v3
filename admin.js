
const DEFAULT_MENU = [
  {
    "label_en": "Home",
    "label_ar": "الرئيسية",
    "url": "index.html",
    "visible": true
  },
  {
    "label_en": "Shop",
    "label_ar": "المتجر",
    "url": "shop.html",
    "visible": true
  },
  {
    "label_en": "Custom Order",
    "label_ar": "طلب تفصيل",
    "url": "index.html#custom",
    "visible": true
  },
  {
    "label_en": "Track Order",
    "label_ar": "تتبع الطلب",
    "url": "track-order.html",
    "visible": true
  },
  {
    "label_en": "Contact Us",
    "label_ar": "تواصل معنا",
    "url": "contact.html",
    "visible": true
  },
  {
    "label_en": "My Account",
    "label_ar": "حسابي",
    "url": "account.html",
    "visible": true
  }
];

const STANDARD_SIZES = {
  "L Shape Sofas": ["280 x 180 cm", "300 x 200 cm", "320 x 220 cm", "350 x 230 cm", "Custom Size"],
  "Beds": ["Queen 160 x 200 cm", "King 180 x 200 cm", "Super King 200 x 200 cm", "Custom Size"],
  "Single Chairs": ["80 x 85 cm", "90 x 95 cm", "100 x 100 cm", "Custom Size"]
};

const DEFAULT_CATEGORIES = [
  {label_en:"L Shape Sofas", label_ar:"كنب حرف L", visible:true},
  {label_en:"Beds", label_ar:"أسرة", visible:true},
  {label_en:"Single Chairs", label_ar:"كراسي مفردة", visible:true}
];

/* ===== Super Admin session helpers =====
   These were referenced throughout admin.js but never defined, which made currentAdmin()
   throw and return null on every call — silently blocking the logged-in super admin from
   creating/managing users. Defined here once as the single source of truth. */
const CV_OWNER_EMAIL = 'admin@craftedvisual.com';
const CV_ADMIN_SECTIONS = ['menu','pictures','products','categories','seo','discounts','orders','finance','crm','users','analytics','security','inventory','media'];
function cloneFullAdminPermissions(){
  const out = {};
  CV_ADMIN_SECTIONS.forEach(k => out[k] = {read:true, write:true});
  return out;
}
function isOwnerSuperAdminUser(u){
  if(!u) return false;
  return String(u.role || '').toLowerCase() === 'superadmin' || String(u.email || '').toLowerCase() === CV_OWNER_EMAIL;
}
function enforceSuperAdminRecord(u){
  if(!u || typeof u !== 'object') return u;
  if(isOwnerSuperAdminUser(u)){
    u.role = 'superadmin';
    u.permissions = cloneFullAdminPermissions();
    if(String(u.email || '').toLowerCase() === CV_OWNER_EMAIL && !u.name) u.name = 'Super Admin';
  }
  return u;
}
function persistCurrentAdminSession(u){
  try{
    if(u){
      const s = JSON.stringify(u);
      sessionStorage.setItem('cvAdminSession', s);
      localStorage.setItem('cvAdminSession', s);
    }
  }catch(e){}
}
function persistAdminUsers(list){
  try{ localStorage.setItem('cvAdminUsers', JSON.stringify(list || [])); }catch(e){}
}


function normalizeMenuRoutes(items){
  return (items || []).filter(item => item && item.url !== "about.html" && item.label_en !== "About Us").map(item => {
    const m = {...item};
    if(m.url === "index.html#shop" || m.url === "#shop") m.url = "shop.html";
    if(m.url === "index.html#home" || m.url === "#home") m.url = "index.html";
    return m;
  });
}

let products = [];
let colorSets = {};
let manualSizes = [];
let manualFabrics = [];
let sizeFabricPrices = {};
let sizeFabricCosts = {};
let settings = {};
let menu = [];
let categories = [];
function isBlockedCategory(name){
  const n = String(name || "").trim().toLowerCase();
  return ["luxury","luxury line","luxuryline"].includes(n);
}
function cleanupBlockedCategoriesAdmin(){
  categories = (categories || []).filter(c=>!isBlockedCategory(c.label_en));
  try{
    localStorage.setItem("cms_categories", JSON.stringify(categories));
    sessionStorage.setItem("cms_categories", JSON.stringify(categories));
  }catch(e){}
}


function showAdminStatus(message, isError=false){
  const box = document.getElementById("adminSaveStatus");
  if(!box) return;
  box.textContent = message;
  box.className = "admin-save-status " + (isError ? "error" : "success");
  setTimeout(()=>{ box.textContent = ""; box.className = "admin-save-status"; }, 3500);
}

function getCategoryArabic(en){
  const found = categories.find(c => c.label_en === en);
  return found ? (found.label_ar || found.label_en) : en;
}

function syncCategoryArabic(){
  const en = document.getElementById("category")?.value || "";
  const arEl = document.getElementById("category_ar");
  if(arEl) arEl.value = getCategoryArabic(en);
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".cms-tabs button").forEach(btn => {
    btn.addEventListener("click", () => openTab(btn.dataset.tab, btn));
  });
  load();
});
function apiProductToAdmin(row){
  const data = row && row.data ? row.data : {};
  const product = Object.assign({}, data);
  product._dbId = row.id || data._dbId;
  product.id = data.id || row.sku || String(row.id);
  product.name = data.name || row.name_en || '';
  product.name_ar = data.name_ar || row.name_ar || '';
  product.category = data.category || row.category_name || 'Beds';
  product.description = data.description || row.description_en || '';
  product.description_ar = data.description_ar || row.description_ar || '';
  product.price = Number(data.price || row.base_price || 0);
  product.vatRate = Number(data.vatRate || row.vat_rate || settings.vat_rate || 15);
  return product;
}

function prototypeProductsRead(){
  const raw = localStorage.getItem('cvPrototypeProducts') || localStorage.getItem('adminProducts') || sessionStorage.getItem('cvPrototypeProducts') || sessionStorage.getItem('adminProducts');
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch(e){ return null; }
}
function prototypeProductsWrite(list){
  const data = JSON.stringify(list);
  localStorage.setItem('cvPrototypeProducts', data);
  localStorage.setItem('adminProducts', data);
  sessionStorage.setItem('cvPrototypeProducts', data);
  sessionStorage.setItem('adminProducts', data);
}


function safeJsonForHtml(data){
  return encodeURIComponent(JSON.stringify(data || []));
}
function buildInstantShopPreviewHtml(list){
  const data = safeJsonForHtml((list || []).map(normalizeProduct));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shop Preview | Crafted Visual</title>
  <link rel="stylesheet" href="styles.css">
  <style>
    body{font-family:Arial, sans-serif;margin:0;background:#faf8f4;color:#171717}.nav{display:flex;align-items:center;justify-content:space-between;padding:18px 28px;background:#fff;border-bottom:1px solid #eee;position:sticky;top:0;z-index:10}.brand{font-weight:800;font-size:22px}.nav a{margin:0 10px;color:#111;text-decoration:none}.preview-banner{padding:14px 24px;background:#111;color:#fff;text-align:center}.preview-banner b{color:#fff}.page-hero{text-align:center;padding:52px 20px}.page-hero h1{font-size:42px;margin:0 0 10px}.preview-filter{padding:10px 20px 25px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.preview-filter button{border:1px solid #ddd;background:#fff;border-radius:999px;padding:10px 16px;cursor:pointer}.preview-filter button.active{background:#111;color:#fff}.shop{padding:0 28px 60px}.product-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px;max-width:1180px;margin:0 auto}.card{background:#fff;border:1px solid #eee;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.06)}.card img{width:100%;height:250px;object-fit:cover;background:#eee}.card-body{padding:18px}.card-body h3{margin:0 0 8px}.card-body p{color:#666}.card-body h4{font-size:20px;margin:12px 0}.btn{border:0;border-radius:999px;padding:12px 18px;cursor:pointer}.btn.primary{background:#111;color:#fff}.empty-products{grid-column:1/-1;text-align:center;padding:40px;background:#fff;border-radius:18px}.preview-modal{position:fixed;inset:0;background:rgba(0,0,0,.62);display:none;align-items:center;justify-content:center;z-index:9999;padding:20px}.preview-modal.open{display:flex}.preview-modal-card{background:#fff;max-width:1080px;width:100%;max-height:92vh;overflow:auto;border-radius:20px;display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:24px;position:relative}.preview-close{position:absolute;top:14px;right:16px;border:0;background:#111;color:#fff;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:20px}.preview-main-img{width:100%;height:420px;object-fit:cover;border-radius:16px;background:#f5f5f5}.preview-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.preview-thumbs img{width:68px;height:68px;object-fit:cover;border-radius:10px;border:2px solid transparent;cursor:pointer}.preview-thumbs img.active{border-color:#111}.preview-options{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 16px}.preview-options button{border:1px solid #ddd;background:#fff;border-radius:999px;padding:9px 12px;cursor:pointer}.preview-options button.active{background:#111;color:#fff;border-color:#111}.preview-detail-price{font-size:24px;font-weight:800;margin:12px 0 4px}.vat-note{font-size:13px;color:#666;margin:0 0 10px}.chosen-options{background:#f7f2ea;border:1px solid #eadfce;border-radius:14px;padding:12px;margin:10px 0 14px;font-size:14px;line-height:1.6}.chosen-options b{display:inline-block;min-width:82px}.dimension-hint{font-size:12px;color:#666;margin-top:4px}.preview-detail-meta{color:#666;margin-bottom:10px}.selection-summary{background:#faf8f4;border:1px solid #eadfce;border-radius:14px;padding:12px;margin:12px 0;font-size:14px}.preview-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.preview-actions button,.preview-actions a{border:0;border-radius:999px;padding:12px 18px;text-decoration:none;cursor:pointer}.preview-actions .primary{background:#111;color:#fff}.preview-actions .secondary{background:#eee;color:#111}@media(max-width:760px){.preview-modal-card{grid-template-columns:1fr}.preview-main-img{height:300px}.nav{display:block;text-align:center}.nav nav{margin-top:10px}}
  </style>
</head>
<body>
  <header class="nav"><div class="brand">Crafted Visual</div><nav><a href="index.html">Home</a><a href="shop.html">Shop</a><a href="contact.html">Contact Us</a><a href="account.html">My Account</a></nav></header>
  <div class="preview-banner"><b>Prototype Shop Preview</b><br>This preview is generated directly from Super Admin. It does not need a database.</div>
  <section class="page-hero"><h1>Shop Collection</h1><p>Browse products by category, fabric, color, size, and price.</p></section>
  <div id="previewFilter" class="preview-filter"></div>
  <section class="shop"><div id="productGrid" class="product-grid"></div></section>
  <div id="previewModal" class="preview-modal"><div class="preview-modal-card"><button class="preview-close" onclick="closeDetails()">×</button><div><img id="detailImage" class="preview-main-img" src="" alt=""><div id="detailThumbs" class="preview-thumbs"></div></div><div><h2 id="detailName"></h2><div id="detailCategory" class="preview-detail-meta"></div><div id="detailPrice" class="preview-detail-price"></div><div class="vat-note">VAT included</div><div id="chosenOptions" class="chosen-options"></div><p id="detailDescription"></p><h4>Colors</h4><div id="detailColors" class="preview-options"></div><h4>Dimensions</h4><div id="detailSizes" class="preview-options"></div><div class="dimension-hint">Shown as Width × Depth × Height in cm, based on what was entered in Super Admin.</div><h4>Fabrics</h4><div id="detailFabrics" class="preview-options"></div><div id="selectionSummary" class="selection-summary"></div><div class="preview-actions"><button class="primary" onclick="addToCartPreview()">Add to Cart</button><a id="detailWhatsapp" class="secondary" href="#" target="_blank">WhatsApp Enquiry</a></div></div></div></div>
  <script>
    const products=JSON.parse(decodeURIComponent('${data}'));
    let selectedDetail=null;
    let selectedColor='';
    let selectedSize='';
    let selectedFabric='';
    function firstImage(p){const colors=p.colors||{};for(const k of Object.keys(colors)){const imgs=colors[k]&&colors[k].images;if(imgs&&imgs.length)return imgs[0];}return (p.gallery&&p.gallery[0])||'assets/products/product_01.png';}
    function imagesForColor(p,color){const imgs=color&&p.colors&&p.colors[color]&&p.colors[color].images;if(imgs&&imgs.length)return imgs;return allImages(p);}
    function allImages(p){const arr=[];const colors=p.colors||{};Object.keys(colors).forEach(k=>{((colors[k]||{}).images||[]).forEach(img=>arr.push(img));});(p.gallery||[]).forEach(img=>arr.push(img));const out=[...new Set(arr)].filter(Boolean);return out.length?out:[firstImage(p)];}
    function sizeObj(p,label){return (p.sizeOptions||[]).find(s=>(s.label||s)===label)||null;}
    function dimensionText(size){if(!size)return '';const w=Number(size.width||0),d=Number(size.depth||0),h=Number(size.height||0);if(w||d||h){return [w||'-',d||'-',h||'-'].join(' × ')+' cm';}return String(size.label||size||'');}
    function sizeButtonText(p,label){const so=sizeObj(p,label);const dim=dimensionText(so);return dim||String(label||'');}
    function selectedBasePrice(p){const fabric=(p.fabricOptions||[]).find(f=>f.label===selectedFabric);if(fabric&&fabric.sizePrices&&selectedSize&&fabric.sizePrices[selectedSize]!=null)return Number(fabric.sizePrices[selectedSize]||0);const size=(p.sizeOptions||[]).find(s=>(s.label||s)===selectedSize);if(size&&size.price!=null)return Number(size.price||0);return Number(p.price||0);}
    function price(p){const vat=Number(p.vatRate||15), base=selectedDetail===p?selectedBasePrice(p):Number(p.price||0), disc=Number(p.discountPercent||0);const final=base*(1-disc/100)*(1+vat/100);return 'SAR '+Math.round(final).toLocaleString();}
    function esc(s){return String(s||'').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
    function render(cat){cat=cat||'All';const grid=document.getElementById('productGrid');const list=cat==='All'?products:products.filter(p=>(p.category||'')===cat);if(!list.length){grid.innerHTML='<div class="empty-products"><h3>No products showing yet</h3><p>Go back to Super Admin, add/save a product, then click Open Shop Preview again.</p></div>';return;}grid.innerHTML=list.map((p,i)=>'<div class="card"><img src="'+firstImage(p)+'" alt="'+esc(p.name||'Product')+'"><div class="card-body"><h3>'+esc(p.name||'Product')+'</h3><p>'+esc(p.category||'')+'</p><h4>SAR '+Math.round(Number(p.price||0)*(1+Number(p.vatRate||15)/100)).toLocaleString()+'</h4><button class="btn primary" type="button" onclick="openDetails(\''+String(p.id||i).replace(/'/g,"\\'")+'\')">View Details</button></div></div>').join('');}
    function filters(){const cats=['All',...new Set(products.map(p=>p.category).filter(Boolean))];document.getElementById('previewFilter').innerHTML=cats.map((c,i)=>'<button type="button" class="'+(i===0?'active':'')+'" data-cat="'+esc(c)+'">'+esc(c)+'</button>').join('');document.querySelectorAll('#previewFilter button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('#previewFilter button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');render(btn.dataset.cat)}));}
    function openDetails(id){const p=products.find(x=>String(x.id)===String(id))||products[Number(id)]||products[0];if(!p)return;selectedDetail=p;const colors=Object.keys(p.colors||{});const sizes=(p.sizeOptions&&p.sizeOptions.length?p.sizeOptions.map(s=>s.label||s):(p.sizes||[]));const fabrics=(p.fabricOptions&&p.fabricOptions.length?p.fabricOptions.map(f=>f.label||f):(p.fabrics||[]));selectedColor=colors[0]||'';selectedSize=sizes[0]||'';selectedFabric=fabrics[0]||'';document.getElementById('detailName').textContent=p.name||'Product';document.getElementById('detailCategory').textContent=p.category||'';document.getElementById('detailDescription').textContent=p.description||'No description added yet.';document.getElementById('detailColors').innerHTML=colors.length?colors.map((c,i)=>'<button data-color="'+esc(c)+'" class="'+(i===0?'active':'')+'" type="button">'+esc(c)+'</button>').join(''):'<small>No colors added</small>';document.getElementById('detailSizes').innerHTML=sizes.length?sizes.map((s,i)=>'<button data-size="'+esc(s)+'" class="'+(i===0?'active':'')+'" type="button">'+esc(sizeButtonText(p,s))+'</button>').join(''):'<small>No dimensions added</small>';document.getElementById('detailFabrics').innerHTML=fabrics.length?fabrics.map((f,i)=>'<button data-fabric="'+esc(f)+'" class="'+(i===0?'active':'')+'" type="button">'+esc(f)+'</button>').join(''):'<small>No fabrics added</small>';document.querySelectorAll('#detailColors button').forEach(btn=>btn.addEventListener('click',()=>selectColor(btn.dataset.color,btn)));document.querySelectorAll('#detailSizes button').forEach(btn=>btn.addEventListener('click',()=>selectSize(btn.dataset.size,btn)));document.querySelectorAll('#detailFabrics button').forEach(btn=>btn.addEventListener('click',()=>selectFabric(btn.dataset.fabric,btn)));updateDetailView();document.getElementById('previewModal').classList.add('open');}
    function updateDetailView(){if(!selectedDetail)return;const p=selectedDetail;const imgs=imagesForColor(p,selectedColor);document.getElementById('detailImage').src=imgs[0]||firstImage(p);document.getElementById('detailThumbs').innerHTML=imgs.map((img,i)=>'<img src="'+img+'" class="'+(i===0?'active':'')+'">').join('');document.querySelectorAll('#detailThumbs img').forEach(img=>img.addEventListener('click',()=>selectDetailImage(img,img.src)));document.getElementById('detailPrice').textContent=price(p);const dim=sizeButtonText(p,selectedSize);document.getElementById('chosenOptions').innerHTML='<div><b>Color:</b> '+esc(selectedColor||'No color')+'</div><div><b>Dimensions:</b> '+esc(dim||selectedSize||'No dimensions')+'</div><div><b>Fabric:</b> '+esc(selectedFabric||'No fabric')+'</div>';document.getElementById('selectionSummary').innerHTML='<b>Selected:</b> '+esc(selectedColor||'No color')+' / '+esc(dim||selectedSize||'No dimensions')+' / '+esc(selectedFabric||'No fabric');const msg=encodeURIComponent('Hello, I am interested in '+(p.name||'this product')+' - Color: '+(selectedColor||'N/A')+', Dimensions: '+(dim||selectedSize||'N/A')+', Fabric: '+(selectedFabric||'N/A'));document.getElementById('detailWhatsapp').href='https://wa.me/?text='+msg;}
    function selectColor(v,btn){selectedColor=v;document.querySelectorAll('#detailColors button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');updateDetailView();}
    function selectSize(v,btn){selectedSize=v;document.querySelectorAll('#detailSizes button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');updateDetailView();}
    function selectFabric(v,btn){selectedFabric=v;document.querySelectorAll('#detailFabrics button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');updateDetailView();}
    function addToCartPreview(){if(!selectedDetail)return;alert('Prototype cart preview:\n'+(selectedDetail.name||'Product')+'\nColor: '+(selectedColor||'N/A')+'\nDimensions: '+(sizeButtonText(selectedDetail,selectedSize)||selectedSize||'N/A')+'\nFabric: '+(selectedFabric||'N/A')+'\nPrice: '+price(selectedDetail));}
    function selectDetailImage(el,img){document.getElementById('detailImage').src=img;document.querySelectorAll('#detailThumbs img').forEach(x=>x.classList.remove('active'));el.classList.add('active');}
    function closeDetails(){document.getElementById('previewModal').classList.remove('open');}
    document.getElementById('previewModal').addEventListener('click',function(e){if(e.target.id==='previewModal')closeDetails();});
    filters();render('All');
  <\/script>
</body>
</html>`;
}

function openPrototypeShopPreview(){
  const latestProducts = (products && products.length ? products : (prototypeProductsRead() || [])).map(normalizeProduct);
  products = latestProducts;
  prototypeProductsWrite(latestProducts);
  if(!latestProducts.length){
    showAdminStatus('No products saved yet. Add and save a product first, then open preview.', true);
    return;
  }
  const win = window.open('', '_blank');
  if(!win){
    showAdminStatus('Popup blocked. Please allow popups, then click Open Shop Preview again.', true);
    return;
  }
  win.document.open();
  win.document.write(buildInstantShopPreviewHtml(latestProducts));
  win.document.close();
  showAdminStatus('Shop Preview opened using the products saved in Super Admin.');
}

function downloadPrototypeProductsJson(){
  prototypeProductsWrite(products);
  const blob = new Blob([JSON.stringify(products, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'products.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
async function loadProductsDataAdmin(){
  // In live Railway mode, Super Admin should load the same products shown on the Shop page.
  if(typeof CV_API !== 'undefined'){
    try{
      const hasApi = await CV_API.available();
      if(hasApi){
        const rows = await fetch('/api/products', {cache:'no-store'}).then(r => r.ok ? r.json() : []);
        if(Array.isArray(rows) && rows.length){
          return rows.map(apiProductToAdmin);
        }
      }
    }catch(e){
      console.warn('Backend products unavailable for admin, using prototype/static products.', e);
    }
  }
  const local = prototypeProductsRead();
  return local || await getJSON('products.json', []);
}

function apiProductToAdmin(row){
  const data = row && row.data ? row.data : {};
  const product = Object.assign({}, data);
  product._dbId = row.id || data._dbId;
  product.id = data.id || row.sku || String(row.id);
  product.name = data.name || row.name_en || '';
  product.name_ar = data.name_ar || row.name_ar || '';
  product.category = data.category || row.category_name || 'Beds';
  product.category_ar = data.category_ar || row.category_ar || '';
  product.description = data.description || row.description_en || '';
  product.description_ar = data.description_ar || row.description_ar || '';
  product.price = Number(data.price || row.base_price || 0);
  product.vatRate = Number(data.vatRate || row.vat_rate || settings.vat_rate || 15);
  return product;
}

async function saveProductToBackend(p, existing){
  if(typeof CV_API === 'undefined') throw new Error('Backend API helper is not loaded.');
  const hasApi = await CV_API.available();
  if(!hasApi) throw new Error('Live backend is not available. The website is running as static files only.');
  const token = CV_API.token(true);
  if(!token) throw new Error('Admin API session is missing. Please logout and login again from admin-login.html.');
  const payload = {
    sku: p.id,
    name_en: p.name,
    name_ar: p.name_ar,
    category_name: p.category,
    description_en: p.description,
    description_ar: p.description_ar,
    base_price: p.price,
    vat_rate: p.vatRate,
    active: true,
    data: p
  };
  const dbId = existing && existing._dbId;
  if(dbId){
    await CV_API.request('/products/' + dbId, {method:'PUT', admin:true, body:payload});
    return dbId;
  }
  const saved = await CV_API.request('/products', {method:'POST', admin:true, body:payload});
  return saved && saved.id;
}

async function getJSON(file, fallback){
  const localKey = file.replace(".json","");
  if(file === "settings.json" && (window.location.protocol === 'http:' || window.location.protocol === 'https:')){
    try{
      const res = await fetch('/api/settings', {cache:'no-store'});
      if(res.ok) return await res.json();
    }catch(e){ console.warn('Settings API unavailable, using local/static settings.', e); }
  }
  const local = localStorage.getItem("cms_" + localKey);
  if(local){
    try { return JSON.parse(local); } catch(e){}
  }
  try {
    const res = await fetch(file, {cache:'no-store'});
    if(!res.ok) throw new Error("fetch failed");
    return await res.json();
  } catch(e) {
    return fallback;
  }
}

async function saveSettingsPermanent(){
  const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  if(isHttp && typeof CV_API !== 'undefined' && CV_API.token(true)){
    return await CV_API.request('/settings', {method:'PUT', admin:true, body:settings});
  }
  localStorage.setItem("cms_settings", JSON.stringify(settings));
  sessionStorage.removeItem("cms_settings");
  return {ok:true};
}

async function load(){
  products = await loadProductsDataAdmin();
  products = products.map(normalizeProduct);
  settings = await getJSON("settings.json", {});
  menu = normalizeMenuRoutes(await getJSON("menu.json", DEFAULT_MENU));
  if(!menu || !menu.length) menu = DEFAULT_MENU;
  categories = await getJSON("categories.json", DEFAULT_CATEGORIES);
  if(!categories || !categories.length) categories = DEFAULT_CATEGORIES;
  cleanupBlockedCategoriesAdmin();
  renderAll();
}

function openTab(id, btn){
  document.querySelectorAll(".cms-section").forEach(s => s.classList.remove("active"));
  const section = document.getElementById(id);
  if(section) section.classList.add("active");
  document.querySelectorAll(".cms-tabs button").forEach(b => b.classList.remove("active"));
  if(btn) btn.classList.add("active");
  if(id === "analyticsControl" && typeof loadAnalyticsCenter === "function") loadAnalyticsCenter();
}

function normalizeSizeOptions(p){
  if(Array.isArray(p.sizeOptions) && p.sizeOptions.length){
    return p.sizeOptions.map(s => ({
      label: s.label || String(s),
      width: (s.width ?? s.length ?? '').toString(),
      depth: (s.depth ?? '').toString(),
      height: (s.height ?? '').toString(),
      price: Number(s.price || p.price || 0)
    }));
  }
  const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ["Custom Size"];
  return sizes.map(s => ({label:s, width:'', depth:'', height:'', price:Number(p.price || 0)}));
}

function normalizeFabricOptions(p){
  if(Array.isArray(p.fabricOptions) && p.fabricOptions.length){
    return p.fabricOptions.map(f => ({label:f.label || String(f), sizePrices:f.sizePrices || {}}));
  }
  const fabrics = Array.isArray(p.fabrics) && p.fabrics.length ? p.fabrics : ["Standard Fabric"];
  const sizes = Array.isArray(p.sizeOptions) && p.sizeOptions.length ? p.sizeOptions : normalizeSizeOptions(p);
  return fabrics.map(f => {
    const sizePrices = {};
    sizes.forEach(s => sizePrices[s.label] = Number(s.price || p.price || 0));
    return {label:f, sizePrices};
  });
}

function normalizeProduct(p){
  const newColors = {};
  Object.entries(p.colors || {}).forEach(([name, value]) => {
    if(typeof value === "string"){
      newColors[name] = { hex: guessHex(name), code: "", images: [value].filter(Boolean) };
    } else {
      newColors[name] = {
        hex: value.hex || guessHex(name),
        code: value.code || "",
        images: Array.isArray(value.images) ? value.images : [value.image].filter(Boolean)
      };
    }
  });
  p.colors = newColors;
  p.discountPercent = Number(p.discountPercent || 0);
  p.vatRate = Number(p.vatRate || settings.vat_rate || 15);
  p.costPrice = Number(p.costPrice || 0);
  p.sizeOptions = normalizeSizeOptions(p);
  p.fabricOptions = normalizeFabricOptions(p);
  p.fabrics = p.fabricOptions.map(f=>f.label);
  return p;
}

function guessHex(name){
  const n = (name || "").toLowerCase();
  if(n.includes("green") || n.includes("olive")) return "#243a26";
  if(n.includes("beige") || n.includes("sand")) return "#d8c4a6";
  if(n.includes("ivory") || n.includes("cream")) return "#f4ead8";
  if(n.includes("grey") || n.includes("gray")) return "#8f8f8a";
  if(n.includes("black") || n.includes("charcoal")) return "#2d2d2d";
  if(n.includes("yellow") || n.includes("mustard")) return "#d4a51f";
  if(n.includes("brown") || n.includes("camel")) return "#8a5f3d";
  return "#cccccc";
}

function renderAll(){
  renderSettings();
  renderMenu();
  renderCategories();
  renderCategorySelect();
  renderSeoAdmin();
  renderProductsAdmin();
  renderDiscountTargets();
  renderDiscountList();
  renderDiscountCodeList();
  renderColorSets();
  renderManualSizeTable();
  renderManualFabricTable();
  buildSizeFabricPriceTable();
  renderAdminUserBar();
  renderAdminUsers();
  if(typeof cvIsSuperAdmin === "function" && cvIsSuperAdmin() || (typeof hasAdminPermission === "function" && hasAdminPermission("users","read"))){
    refreshAdminUsers();
  }
  if(typeof loadMedia === "function" && (typeof cvIsSuperAdmin === "function" && cvIsSuperAdmin() || (typeof hasAdminPermission === "function" && hasAdminPermission("media","read")))){
    loadMedia();
  }
  if(typeof loadDiscountCodesFromBackend === "function" && (typeof cvIsSuperAdmin === "function" && cvIsSuperAdmin() || (typeof hasAdminPermission === "function" && hasAdminPermission("discounts","read")))){
    loadDiscountCodesFromBackend();
  }
  const fpb = document.getElementById("fabricPricingBox"); if(fpb) fpb.innerHTML = "";
}

function renderSettings(){
  Object.entries(settings).forEach(([k,v]) => {
    const el = document.getElementById(k);
    if(el){ if(el.type === "checkbox") el.checked = !!v; else if(Array.isArray(v)) el.value = v.join(", "); else el.value = v; }
  });
  syncHeroBannerFields();
  renderHeroPreview();
}

async function saveSettings(){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("pictures","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  const keys = ["brand_en","brand_ar","whatsapp_number","currency","vat_rate","riyadh_delivery","outside_riyadh_delivery","hero_title_en","hero_title_ar","hero_text_en","hero_text_ar","intro_title_en","intro_title_ar","intro_text_en","intro_text_ar","footer_text_en","footer_text_ar","hero_image","hero_banner_1","hero_banner_2","hero_banner_3","hero_banner_4","hero_banner_5","instagram_url","tiktok_url","facebook_url","x_url","linkedin_url","youtube_url","snapchat_url","google_analytics_id","google_tag_manager_id","meta_pixel_id","tiktok_pixel_id","snap_pixel_id","hotjar_id","do_not_reply_email","crm_email_api_url","whatsapp_business_api_url","footer_cr_number","footer_vat_number","footer_address","footer_email","footer_phone","footer_extra_info_en","footer_extra_info_ar","auto_translate_arabic"];
  keys.forEach(k => {
    const el = document.getElementById(k);
    if(el) settings[k] = el.type === "checkbox" ? el.checked : (el.type === "number" ? Number(el.value) : el.value);
  });
  const heroBanners = [1,2,3,4,5].map(i => (document.getElementById("hero_banner_" + i)?.value || "").trim()).filter(Boolean);
  settings.hero_banners = heroBanners;
  settings.hero_image = heroBanners[0] || settings.hero_image || "";
  try{
    await saveSettingsPermanent();
    showAdminStatus("Website settings, banners, and SEO data saved permanently.");
  }catch(e){
    console.error(e);
    try{
      localStorage.setItem("cms_settings", JSON.stringify(settings));
      showAdminStatus("Saved locally only. Login as Super Admin to publish permanently.", true);
    }catch(err){
      showAdminStatus("Could not save. Image files may be too large.", true);
    }
  }
}

function getHeroBannerValues(){
  return [1,2,3,4,5].map(i => (document.getElementById("hero_banner_" + i)?.value || "").trim()).filter(Boolean);
}

function syncHeroBannerFields(){
  const banners = Array.isArray(settings.hero_banners) && settings.hero_banners.length
    ? settings.hero_banners
    : [settings.hero_banner_1, settings.hero_banner_2, settings.hero_banner_3, settings.hero_banner_4, settings.hero_banner_5, settings.hero_image].filter(Boolean);
  [1,2,3,4,5].forEach(i => {
    const el = document.getElementById("hero_banner_" + i);
    if(el && !el.value) el.value = banners[i-1] || "";
  });
  const fallback = document.getElementById("hero_image");
  if(fallback) fallback.value = banners[0] || settings.hero_image || "";
}

function renderHeroPreview(){
  const banners = getHeroBannerValues();
  const prev = document.getElementById("heroPreview");
  if(!prev) return;
  if(!banners.length){
    prev.innerHTML = `<div class="admin-note">No banner pictures added yet.</div>`;
    return;
  }
  prev.innerHTML = banners.map((src,i)=>`
    <div class="banner-preview-card">
      <img src="${src}" alt="Homepage banner ${i+1}">
      <strong>Banner ${i+1}</strong>
    </div>`).join("");
}

function clearHeroBanners(){
  [1,2,3,4,5].forEach(i => {
    const input = document.getElementById("hero_banner_" + i);
    const file = document.getElementById("heroBannerFile" + i);
    if(input) input.value = "";
    if(file) file.value = "";
    settings["hero_banner_" + i] = "";
  });
  settings.hero_banners = [];
  settings.hero_image = "";
  const fallback = document.getElementById("hero_image");
  if(fallback) fallback.value = "";
  renderHeroPreview();
}

document.addEventListener("input", e => {
  if(/^hero_banner_[1-5]$/.test(e.target.id)) renderHeroPreview();
});

document.addEventListener("change", async e => {
  const match = /^heroBannerFile([1-5])$/.exec(e.target.id || "");
  if(match){
    const f = e.target.files[0]; if(!f) return;
    document.getElementById("hero_banner_" + match[1]).value = await readFile(f);
    const banners = getHeroBannerValues();
    const fallback = document.getElementById("hero_image");
    if(fallback) fallback.value = banners[0] || "";
    renderHeroPreview();
  }
});

function renderMenu(){
  const list = document.getElementById("menuList");
  if(!list) return;
  list.innerHTML = menu.map((m,i)=>`
    <div class="admin-item">
      <div><strong>${m.label_en}</strong> / ${m.label_ar || ""}<br>${m.url}<br>Visible: ${m.visible !== false}</div>
      <div><button type="button" onclick="toggleMenu(${i})">Show/Hide</button><button type="button" onclick="removeMenu(${i})">Delete</button></div>
    </div>`).join("");
}

function addMenuItem(){
  const en = document.getElementById("menu_label_en").value.trim();
  const ar = document.getElementById("menu_label_ar").value.trim();
  const url = document.getElementById("menu_url").value.trim();
  if(!en || !url){ alert("Add menu label and URL"); return; }
  menu.push({label_en:en, label_ar:ar, url, visible:true});
  document.getElementById("menu_label_en").value = "";
  document.getElementById("menu_label_ar").value = "";
  document.getElementById("menu_url").value = "";
  renderMenu();
}

function toggleMenu(i){ menu[i].visible = menu[i].visible === false ? true : false; renderMenu(); }
function removeMenu(i){ menu.splice(i,1); renderMenu(); }
function saveMenu(){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("menu","write")){ showAdminStatus("You have read-only access for this section.", true); return; } 
  try{
    localStorage.setItem("cms_menu", JSON.stringify(menu)); 
    showAdminStatus("Menu saved successfully. Refresh website page to see it.");
  }catch(e){ showAdminStatus("Could not save menu.", true); }
}
function resetMenu(){ menu = normalizeMenuRoutes(JSON.parse(JSON.stringify(DEFAULT_MENU))); saveMenu(); renderMenu(); }

function renderCategories(){
  const list = document.getElementById("categoryList");
  if(!list) return;
  list.innerHTML = categories.map((c,i)=>`
    <div class="admin-item">
      <div><strong>${c.label_en}</strong> / ${c.label_ar || ""}<br>Visible: ${c.visible !== false}</div>
      <div><button type="button" onclick="toggleCategory(${i})">Show/Hide</button><button type="button" onclick="removeCategory(${i})">Delete</button></div>
    </div>`).join("");
}

function addCategory(){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("categories","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  const en = document.getElementById("cat_en").value.trim();
  const ar = document.getElementById("cat_ar").value.trim();
  if(!en){ alert("Add English category"); return; }
  if(isBlockedCategory(en)){ showAdminStatus("Luxury categories are currently hidden/blocked until you add them again later.", true); return; }
  categories.push({label_en:en, label_ar: ar || (isAutoArabicEnabled() ? autoTranslateToArabic(en) : en), visible:true});
  document.getElementById("cat_en").value = "";
  document.getElementById("cat_ar").value = "";
  renderCategories(); renderCategorySelect(); renderDiscountTargets(); syncCategoryArabic(); saveCategories(); saveCategories();
}

function toggleCategory(i){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("categories","write")){ showAdminStatus("You have read-only access for this section.", true); return; } categories[i].visible = categories[i].visible === false ? true : false; renderCategories(); renderCategorySelect(); saveCategories(); }
function removeCategory(i){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("categories","write")){ showAdminStatus("You have read-only access for this section.", true); return; } categories.splice(i,1); renderCategories(); renderCategorySelect(); renderDiscountTargets(); syncCategoryArabic(); saveCategories(); saveCategories(); }
function saveCategories(){ 
  try{
    localStorage.setItem("cms_categories", JSON.stringify(categories)); 
    sessionStorage.setItem("cms_categories", JSON.stringify(categories));
    showAdminStatus("Categories saved successfully. Refresh website page to see them.");
  }catch(e){ showAdminStatus("Could not save categories.", true); }
}

function renderCategorySelect(){
  const select = document.getElementById("category");
  if(!select) return;
  select.innerHTML = categories.filter(c=>c.visible !== false).map(c=>`<option value="${c.label_en}">${c.label_en}</option>`).join("");
  select.onchange = function(){
    syncCategoryArabic();
    loadStandardSizes();
  };
  syncCategoryArabic();
  loadStandardSizes();
}

function loadStandardSizes(){
  const categoryName = document.getElementById("category")?.value || "L Shape Sofas";
  const defaultPrice = Number(document.getElementById("price")?.value || 0);
  const sizes = STANDARD_SIZES[categoryName] || ["Custom Size"];
  const box = document.getElementById("sizePricingBox");
  if(!box) return;
  box.innerHTML = sizes.map(s => `
    <div class="size-price-row">
      <label><input type="checkbox" class="size-enabled" value="${s}" checked> ${s}</label>
      <input type="number" class="size-price" data-size="${s}" placeholder="Price before VAT" value="${defaultPrice || ""}">
    </div>
  `).join("");
}

function getSizeOptionsFromForm(){
  const rows = [...document.querySelectorAll(".size-price-row")];
  return rows.map(row => {
    const enabled = row.querySelector(".size-enabled");
    const price = row.querySelector(".size-price");
    return enabled.checked ? {label: enabled.value, price: Number(price.value || document.getElementById("price").value || 0)} : null;
  }).filter(Boolean);
}

function setSizeOptionsInForm(sizeOptions){
  const box = document.getElementById("sizePricingBox");
  if(!box) return;
  box.innerHTML = (sizeOptions || []).map(s => `
    <div class="size-price-row">
      <label><input type="checkbox" class="size-enabled" value="${s.label}" checked> ${s.label}</label>
      <input type="number" class="size-price" data-size="${s.label}" placeholder="Price before VAT" value="${Number(s.price || 0)}">
    </div>
  `).join("");
}


function addManualSize(){
  const label = document.getElementById("sizeNameInput").value.trim();
  const width = document.getElementById("sizeWidthInput").value.trim();
  const depth = document.getElementById("sizeDepthInput").value.trim();
  const height = document.getElementById("sizeHeightInput").value.trim();
  const size = { label, width, depth, height };
  if(!size.label){ showAdminStatus("Size name is required.", true); return; }
  if(!width && !depth && !height){ showAdminStatus("Please enter at least one dimension for this size.", true); return; }
  manualSizes.push(size);
  ["sizeNameInput","sizeWidthInput","sizeDepthInput","sizeHeightInput"].forEach(id=>document.getElementById(id).value="");
  renderManualSizeTable();
  buildSizeFabricPriceTable();
  showAdminStatus("Size added with dimensions: " + label + " - " + [width||"-", depth||"-", height||"-"].join(" × ") + " cm", false);
}
function deleteManualSize(i){ 
  const removed = manualSizes[i]?.label;
  manualSizes.splice(i,1); 
  if(removed) delete sizeFabricPrices[removed];
  renderManualSizeTable(); 
  buildSizeFabricPriceTable();
}
function renderManualSizeTable(){
  const body = document.getElementById("manualSizeTable");
  if(!body) return;
  body.innerHTML = manualSizes.length ? manualSizes.map((s,i)=>`
    <tr><td><strong>${s.label}</strong><br><small>${[s.width||"-", s.depth||"-", s.height||"-"].join(" × ")} cm</small></td><td>${s.width || "-"} cm</td><td>${s.depth || "-"} cm</td><td>${s.height || "-"} cm</td><td><button type="button" onclick="deleteManualSize(${i})">Delete</button></td></tr>
  `).join("") : `<tr><td colspan="5">No sizes added yet.</td></tr>`;
}
function addManualFabric(){
  const fabric = {
    label: document.getElementById("fabricNameInput").value.trim(),
    description: document.getElementById("fabricDescInput").value.trim()
  };
  if(!fabric.label){ showAdminStatus("Fabric name is required.", true); return; }
  manualFabrics.push(fabric);
  ["fabricNameInput","fabricDescInput"].forEach(id=>document.getElementById(id).value="");
  renderManualFabricTable();
  buildSizeFabricPriceTable();
}
function deleteManualFabric(i){ 
  const removed = manualFabrics[i]?.label;
  manualFabrics.splice(i,1); 
  if(removed){
    Object.keys(sizeFabricPrices).forEach(sizeLabel=>{
      if(sizeFabricPrices[sizeLabel]) delete sizeFabricPrices[sizeLabel][removed];
    });
  }
  renderManualFabricTable(); 
  buildSizeFabricPriceTable();
}
function renderManualFabricTable(){
  const body = document.getElementById("manualFabricTable");
  if(!body) return;
  body.innerHTML = manualFabrics.length ? manualFabrics.map((f,i)=>`
    <tr><td>${f.label}</td><td>${f.description || ""}</td><td><button type="button" onclick="deleteManualFabric(${i})">Delete</button></td></tr>
  `).join("") : `<tr><td colspan="3">No fabrics added yet.</td></tr>`;
}
function buildSizeFabricPriceTable(){
  const head = document.getElementById("sizeFabricPriceHead");
  const body = document.getElementById("sizeFabricPriceBody");
  if(!head || !body) return;
  if(!manualSizes.length || !manualFabrics.length){
    head.innerHTML = "";
    body.innerHTML = `<tr><td>Add at least one size and one fabric to build the price and cost table.</td></tr>`;
    return;
  }
  head.innerHTML = `<tr><th>Size</th>${manualFabrics.map(f=>`<th>${f.label}<br><small>${f.description || ""}</small></th>`).join("")}</tr>`;
  body.innerHTML = manualSizes.map(size=>{
    if(!sizeFabricPrices[size.label]) sizeFabricPrices[size.label] = {};
    if(!sizeFabricCosts[size.label]) sizeFabricCosts[size.label] = {};
    return `<tr><td><strong>${size.label}</strong><br><small>${size.width || ""} x ${size.depth || ""} x ${size.height || ""} cm</small></td>` + manualFabrics.map(f=>{
      const sell = sizeFabricPrices[size.label]?.[f.label] || "";
      const cost = sizeFabricCosts[size.label]?.[f.label] || "";
      return `<td>
        <label>Selling Price Before VAT</label>
        <input type="number" class="sf-price" data-size="${size.label}" data-fabric="${f.label}" placeholder="Selling price" value="${sell}" onchange="captureSizeFabricPrices()">
        <label>Cost</label>
        <input type="number" class="sf-cost" data-size="${size.label}" data-fabric="${f.label}" placeholder="Cost" value="${cost}" onchange="captureSizeFabricPrices()">
      </td>`;
    }).join("") + `</tr>`;
  }).join("");
}
function captureSizeFabricPrices(){
  document.querySelectorAll(".sf-price").forEach(input=>{
    const size = input.dataset.size;
    const fabric = input.dataset.fabric;
    if(!sizeFabricPrices[size]) sizeFabricPrices[size] = {};
    sizeFabricPrices[size][fabric] = Number(input.value || 0);
  });
  document.querySelectorAll(".sf-cost").forEach(input=>{
    const size = input.dataset.size;
    const fabric = input.dataset.fabric;
    if(!sizeFabricCosts[size]) sizeFabricCosts[size] = {};
    sizeFabricCosts[size][fabric] = Number(input.value || 0);
  });
}
function buildFabricOptionsFromManual(){
  captureSizeFabricPrices();
  const sizes = manualSizes.length ? manualSizes : [{label:"Custom Size", width:0, depth:0, height:0}];
  const fabrics = manualFabrics.length ? manualFabrics : [{label:"Standard Fabric", description:""}];
  return fabrics.map(f=>{
    const sizePrices = {};
    const costPrices = {};
    sizes.forEach(s=>{
      sizePrices[s.label] = Number(sizeFabricPrices[s.label]?.[f.label] || document.getElementById("price").value || 0);
      costPrices[s.label] = Number(sizeFabricCosts[s.label]?.[f.label] || document.getElementById("costPrice").value || 0);
    });
    return {label:f.label, label_ar:autoTranslateToArabic(f.label), description:f.description || "", description_ar:autoTranslateToArabic(f.description || ""), sizePrices, costPrices};
  });
}

function renderProductsAdmin(){
  const q = (document.getElementById("productSearch")?.value || "").toLowerCase();
  const filtered = products.filter(p => !q || (p.name || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q));
  const list = document.getElementById("productList");
  if(!list) return;
  list.innerHTML = filtered.map(p=>`
    <div class="admin-item product-admin-item">
      <div>
        <strong>${p.name}</strong><br>
        ${p.category} | Before VAT: SAR ${Number(p.price||0).toLocaleString()} | VAT ${Number(p.vatRate || 15)}% ${p.discountPercent ? "| Discount " + p.discountPercent + "%" : ""}<br>
        COGS: SAR ${Number(p.costPrice || 0).toLocaleString()} | ${Object.keys(p.colors || {}).length} colors
      </div>
      <div>
        <button type="button" onclick="editProduct('${p.id}')">Edit</button>
        <button type="button" onclick="duplicateProduct('${p.id}')">Duplicate</button>
        <button type="button" onclick="deleteProduct('${p.id}')">Delete</button>
      </div>
    </div>`).join("");
}

function readFile(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1600;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function readFilesAsDataUrls(files){ return Promise.all([...files].map(readFile)); }

async function addColorSet(){
  const name = document.getElementById("colorName").value.trim();
  const code = document.getElementById("colorCode").value.trim();
  const files = document.getElementById("colorFiles").files;
  if(!name){ alert("Add color name"); return; }
  if(!files.length && !colorSets[name]){ alert("Attach at least one picture"); return; }
  const newImages = files.length ? await readFilesAsDataUrls(files) : [];
  const existing = colorSets[name]?.images || [];
  colorSets[name] = {hex: code.startsWith("#") ? code : document.getElementById("colorHex").value, code: code.startsWith("#") ? "" : code, images:[...existing, ...newImages]};
  document.getElementById("colorName").value = "";
  document.getElementById("colorCode").value = "";
  document.getElementById("colorFiles").value = "";
  renderColorSets();
}

function renderColorSets(){
  const wrap = document.getElementById("colorSetsPreview");
  if(!wrap) return;
  wrap.innerHTML = Object.entries(colorSets).map(([name,set])=>`
    <div class="color-set-card">
      <div class="color-set-head"><span class="color-dot big" style="background:${set.hex}"></span><strong>${name}</strong><small>${set.code || set.hex}</small><button type="button" onclick="removeColorSet('${name.replace(/'/g,"\\'")}')">Remove</button></div>
      <div class="admin-thumbs">${(set.images||[]).map((img,idx)=>`<div><img src="${img}"><button type="button" onclick="removeColorImage('${name.replace(/'/g,"\\'")}',${idx})">x</button></div>`).join("")}</div>
    </div>`).join("");
}

function removeColorSet(name){ delete colorSets[name]; renderColorSets(); }
function removeColorImage(name,idx){ colorSets[name].images.splice(idx,1); renderColorSets(); }

function getSelectedFabricsFromForm(){
  const selected = [...document.querySelectorAll(".quick-fabric:checked")].map(x=>x.value);
  const custom = document.getElementById("fabrics").value.split("\n").map(x=>x.trim()).filter(Boolean);
  return [...new Set([...selected, ...custom])];
}

function buildFabricPricingMatrix(existingOptions=null){
  const fabrics = existingOptions ? existingOptions.map(f=>f.label) : getSelectedFabricsFromForm();
  const sizes = getSizeOptionsFromForm();
  const box = document.getElementById("fabricPricingBox");
  if(!box) return;
  if(!fabrics.length || !sizes.length){
    box.innerHTML = "<p>Select at least one fabric and one size first.</p>";
    return;
  }
  box.innerHTML = fabrics.map(fabric => {
    const existing = existingOptions ? existingOptions.find(f=>f.label===fabric) : null;
    return `<div class="fabric-price-card"><h4>${fabric}</h4>` + sizes.map(size => {
      const value = existing?.sizePrices?.[size.label] ?? size.price ?? document.getElementById("price").value ?? "";
      return `<label>${size.label}<input type="number" class="fabric-size-price" data-fabric="${fabric}" data-size="${size.label}" value="${value}" placeholder="Price before VAT"></label>`;
    }).join("") + `</div>`;
  }).join("");
}

function getFabricOptionsFromMatrix(){
  const fabrics = getSelectedFabricsFromForm();
  const sizes = getSizeOptionsFromForm();
  if(!fabrics.length) return [{label:"Standard Fabric", sizePrices:Object.fromEntries(sizes.map(s=>[s.label, Number(s.price || 0)]))}];
  return fabrics.map(fabric => {
    const sizePrices = {};
    sizes.forEach(size => {
      const input = document.querySelector(`.fabric-size-price[data-fabric="${CSS.escape(fabric)}"][data-size="${CSS.escape(size.label)}"]`);
      sizePrices[size.label] = Number(input?.value || size.price || document.getElementById("price").value || 0);
    });
    return {label:fabric, sizePrices};
  });
}

async function saveProduct(){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("products","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  const name = document.getElementById("name").value.trim();
  const productId = document.getElementById("id").value.trim() || (name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") + "-" + Date.now());
  const selectedCategory = document.getElementById("category").value;
  const categoryArabic = getCategoryArabic(selectedCategory);
  const existing = products.find(x => x.id === productId);
  const colorsToSave = Object.keys(colorSets || {}).length ? colorSets : (existing ? existing.colors : {});
  captureSizeFabricPrices();
  const firstFabricLabel = manualFabrics[0]?.label || "Standard Fabric";
  const sizeOptions = manualSizes.length ? manualSizes.map(s=>({
    label:s.label, width:String(s.width || ''), depth:String(s.depth || ''), height:String(s.height || ''),
    price:Number(sizeFabricPrices[s.label]?.[firstFabricLabel] || document.getElementById("price").value || 0)
  })) : [{label:"Custom Size", width:'', depth:'', height:'', price:Number(document.getElementById("price").value || 0)}];
  const fabricOptions = buildFabricOptionsFromManual();

  const p = {
    id: productId,
    name,
    name_ar: ensureArabic(name, document.getElementById("name_ar").value.trim()),
    category: selectedCategory,
    category_ar: categoryArabic,
    price: Number(document.getElementById("price").value || sizeOptions[0]?.price || 0),
    costPrice: Number(sizeFabricCosts[sizeOptions[0]?.label]?.[firstFabricLabel] || document.getElementById("costPrice").value || 0),
    vatRate: Number(document.getElementById("vatRate").value || settings.vat_rate || 15),
    discountPercent: Number(document.getElementById("discountPercent").value || 0),
    description: document.getElementById("description").value.trim(),
    description_ar: ensureArabic(document.getElementById("description").value.trim(), document.getElementById("description_ar").value.trim()),
    sizeOptions,
    sizes: sizeOptions.map(s=>s.label),
    fabricOptions,
    fabrics: fabricOptions.map(f=>f.label),
    colors: colorsToSave,
    gallery: document.getElementById("gallery").value.split("\n").map(x=>x.trim()).filter(Boolean)
  };

  if(!p.name){ showAdminStatus("Product name is required.", true); return; }
  if(!p.price){ showAdminStatus("Default selling price before VAT is required.", true); return; }
  if(Object.keys(p.colors || {}).length === 0){ showAdminStatus("Add at least one product color photo.", true); return; }

  const idx = products.findIndex(x=>x.id === p.id);
  const existingProduct = idx >= 0 ? products[idx] : existing;

  try{
    const dbId = await saveProductToBackend(p, existingProduct);
    if(dbId) p._dbId = dbId;
    if(idx >= 0) products[idx] = p; else products.push(p);
    prototypeProductsWrite(products);
    renderProductsAdmin(); renderDiscountTargets(); renderDiscountList(); clearForm();
    showAdminStatus("Product saved to the live backend. It will now show on Shop page and Shop Preview.");
  }catch(e){
    if(idx >= 0) products[idx] = p; else products.push(p);
    prototypeProductsWrite(products);
    renderProductsAdmin(); renderDiscountTargets(); renderDiscountList(); clearForm();
    showAdminStatus("Prototype mode: Product saved locally. It will show in Shop Preview; live Shop needs Railway backend.");
    console.info("Prototype local save only:", e);
  }
}

function editProduct(pid){
  const p = normalizeProduct(products.find(x=>x.id===pid));
  if(!p) return;
  ["id","name","name_ar","category","price","costPrice","vatRate","discountPercent","description","description_ar"].forEach(k=>{
    const el = document.getElementById(k); if(el) el.value = p[k] || "";
  });
  document.getElementById("sizes").value = (p.sizes || []).join("\n");
  document.getElementById("fabrics").value = (p.fabrics || []).join("\n");
  document.getElementById("gallery").value = (p.gallery || []).join("\n");
  document.querySelectorAll(".quick-fabric").forEach(el=>el.checked=false);
  setSizeOptionsInForm(p.sizeOptions || normalizeSizeOptions(p));
  syncCategoryArabic();
  buildFabricPricingMatrix(p.fabricOptions || normalizeFabricOptions(p));
  (p.fabrics || []).forEach(v=>{ const el=[...document.querySelectorAll(".quick-fabric")].find(x=>x.value===v); if(el) el.checked=true; });
  manualSizes = (p.sizeOptions || normalizeSizeOptions(p)).map(s=>({label:s.label, width:String(s.width||''), depth:String(s.depth||''), height:String(s.height||''), price:Number(s.price||0)}));
  manualFabrics = (p.fabricOptions || normalizeFabricOptions(p)).map(f=>({label:f.label, description:f.description||""}));
  sizeFabricPrices = {};
  sizeFabricCosts = {};
  (p.fabricOptions || []).forEach(f=>{
    Object.entries(f.sizePrices || {}).forEach(([sizeLabel,price])=>{
      if(!sizeFabricPrices[sizeLabel]) sizeFabricPrices[sizeLabel] = {};
      sizeFabricPrices[sizeLabel][f.label] = Number(price || 0);
    });
    Object.entries(f.costPrices || {}).forEach(([sizeLabel,cost])=>{
      if(!sizeFabricCosts[sizeLabel]) sizeFabricCosts[sizeLabel] = {};
      sizeFabricCosts[sizeLabel][f.label] = Number(cost || 0);
    });
  });
  renderManualSizeTable();
  renderManualFabricTable();
  buildSizeFabricPriceTable();
  colorSets = JSON.parse(JSON.stringify(p.colors || {}));
  renderColorSets();
  openTab("productsControl", document.querySelector('[data-tab="productsControl"]'));
  window.scrollTo({top:0, behavior:"smooth"});
}

function duplicateProduct(pid){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("products","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  const original = products.find(p=>p.id===pid);
  if(!original) return;
  const copy = JSON.parse(JSON.stringify(original));
  copy.id = original.id + "-copy-" + Date.now();
  copy.name = original.name + " Copy";
  products.push(copy);
  prototypeProductsWrite(products);
  renderProductsAdmin();
  alert("Product duplicated.");
}
function deleteProduct(pid){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("products","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  if(!confirm("Delete this product?")) return;
  products = products.filter(p=>p.id!==pid);
  prototypeProductsWrite(products);
  renderProductsAdmin(); renderDiscountTargets(); renderDiscountList();
}

function clearForm(){
  document.querySelectorAll("#productsControl input:not([type=color]), #productsControl textarea").forEach(el=>{ if(el.id !== "exportBox") el.value=""; });
  document.querySelectorAll(".quick-fabric").forEach(el=>el.checked=false);
  if(document.getElementById("category").options.length) document.getElementById("category").selectedIndex=0;
  document.getElementById("vatRate").value = settings.vat_rate || 15;
  syncCategoryArabic();
  loadStandardSizes();
  document.getElementById("colorHex").value="#183d32";
  colorSets={};
  manualSizes=[];
  manualFabrics=[];
  sizeFabricPrices={};
  sizeFabricCosts={};
  renderColorSets();
  renderManualSizeTable();
  renderManualFabricTable();
}
function exportProducts(){ document.getElementById("exportBox").value = JSON.stringify(products, null, 2); }


const DEFAULT_SEO_PAGES = {
  home:{title:"Custom Furniture Saudi Arabia | Crafted Visual",description:"Shop premium custom furniture in Saudi Arabia including sofas, beds, chairs, luxury fabrics, custom sizes, and Riyadh delivery by Crafted Visual.",keywords:["custom furniture Saudi Arabia","premium furniture Riyadh","sofas Riyadh","beds Saudi Arabia","single chairs","luxury furniture","custom sofas","furniture delivery Riyadh"]},
  shop:{title:"Shop Custom Sofas, Beds & Chairs | Crafted Visual",description:"Browse Crafted Visual furniture collections with custom sizes, fabrics, colors, prices, and delivery options across Saudi Arabia.",keywords:["shop furniture Saudi Arabia","buy sofa Riyadh","custom beds Riyadh","custom chairs Saudi","furniture ecommerce Saudi Arabia"]},
  contact:{title:"Contact Crafted Visual Furniture | Riyadh Saudi Arabia",description:"Contact Crafted Visual for custom furniture orders, WhatsApp inquiries, delivery questions, and furniture support in Saudi Arabia.",keywords:["contact furniture Riyadh","custom furniture inquiry","furniture WhatsApp Saudi Arabia","Crafted Visual contact"]},
  account:{title:"My Account | Crafted Visual Furniture",description:"Sign in to your Crafted Visual account to track orders, manage furniture purchases, and review your shopping journey.",keywords:["furniture account","track furniture order","Crafted Visual account"]},
  product:{title:"Custom Furniture Product | Crafted Visual",description:"View product details, custom sizes, fabrics, colors, prices, and ordering options from Crafted Visual.",keywords:["custom furniture product","custom size sofa","custom fabric furniture","luxury product Saudi Arabia"]}
};
function ensureSeoPages(){
  if(!settings.seo_pages) settings.seo_pages = JSON.parse(JSON.stringify(DEFAULT_SEO_PAGES));
  Object.keys(DEFAULT_SEO_PAGES).forEach(k=>{
    if(!settings.seo_pages[k]) settings.seo_pages[k] = JSON.parse(JSON.stringify(DEFAULT_SEO_PAGES[k]));
    if(!Array.isArray(settings.seo_pages[k].keywords)) settings.seo_pages[k].keywords = [];
  });
}
function renderSeoAdmin(){
  ensureSeoPages();
  loadSeoPageForm();
  renderSeoPagesList();
}
function currentSeoPage(){
  ensureSeoPages();
  const key = document.getElementById("seoPageKey")?.value || "home";
  return settings.seo_pages[key];
}
function loadSeoPageForm(){
  const page = currentSeoPage();
  const title = document.getElementById("seoTitle");
  const desc = document.getElementById("seoDescription");
  if(title) title.value = page.title || "";
  if(desc) desc.value = page.description || "";
  renderSeoKeywordList();
}
function renderSeoKeywordList(){
  const box = document.getElementById("seoKeywordList");
  if(!box) return;
  const page = currentSeoPage();
  box.innerHTML = page.keywords.length ? page.keywords.map((kw,i)=>`
    <div class="admin-item">
      <input value="${String(kw).replace(/"/g,'&quot;')}" onchange="editSeoKeyword(${i}, this.value)">
      <button type="button" onclick="removeSeoKeyword(${i})">Remove</button>
    </div>`).join("") : "<p>No SEO words yet.</p>";
}
function renderSeoPagesList(){
  const box = document.getElementById("seoPagesList");
  if(!box) return;
  ensureSeoPages();
  box.innerHTML = Object.entries(settings.seo_pages).map(([key,page])=>`
    <div class="admin-item"><div><strong>${key.toUpperCase()}</strong><br>${page.title || ""}<br><small>${(page.keywords || []).join(", ")}</small></div></div>
  `).join("");
}
function addSeoKeyword(){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("seo","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  const input = document.getElementById("seoKeywordInput");
  const kw = input.value.trim();
  if(!kw) return;
  const page = currentSeoPage();
  if(!page.keywords.includes(kw)) page.keywords.push(kw);
  input.value = "";
  renderSeoKeywordList(); renderSeoPagesList();
}
function editSeoKeyword(i,value){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("seo","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  const page = currentSeoPage();
  page.keywords[i] = value.trim();
  page.keywords = page.keywords.filter(Boolean);
  renderSeoKeywordList(); renderSeoPagesList();
}
function removeSeoKeyword(i){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("seo","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  const page = currentSeoPage();
  page.keywords.splice(i,1);
  renderSeoKeywordList(); renderSeoPagesList();
}
async function saveSeoPage(){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("seo","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  ensureSeoPages();
  const key = document.getElementById("seoPageKey")?.value || "home";
  const titleValue = document.getElementById("seoTitle")?.value.trim() || "";
  const descValue = document.getElementById("seoDescription")?.value.trim() || "";
  settings.seo_pages[key].title = titleValue;
  settings.seo_pages[key].description = descValue;
  // Also store English fields for the upgraded frontend SEO engine.
  settings.seo_pages[key].title_en = settings.seo_pages[key].title_en || titleValue;
  settings.seo_pages[key].description_en = settings.seo_pages[key].description_en || descValue;
  try{
    await saveSettingsPermanent();
    renderSeoPagesList();
    showAdminStatus("SEO saved permanently. Google meta tags, sitemap, and schema will use it.");
  }catch(e){ console.error(e); showAdminStatus("Could not publish SEO. Login as Super Admin and try again.", true); }
}
async function resetSeoDefaults(){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("seo","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  settings.seo_pages = JSON.parse(JSON.stringify(DEFAULT_SEO_PAGES));
  saveSeoPage();
  renderSeoAdmin();
}

function discountOptionHtml(value, label, selected){
  return `<option value="${String(value).replace(/"/g,'&quot')}" ${selected ? 'selected' : ''}>${String(label || value)}</option>`;
}
function productDisplayName(p){ return p && (p.name || p.name_en || p.id || p.sku || 'Product'); }
function categoryDisplayName(c){ return typeof c === 'string' ? c : (c && (c.label_en || c.name || c.category || c.label)) || ''; }
function getDiscountProductById(id){ return (products || []).find(p => String(p.id) === String(id) || String(p._dbId || '') === String(id)); }
function getProductSizeLabels(p){
  const out = [];
  (p?.sizeOptions || []).forEach(s => { const v = s && (s.label || s.name || s.size || s); if(v && !out.includes(String(v))) out.push(String(v)); });
  (p?.sizes || []).forEach(s => { if(s && !out.includes(String(s))) out.push(String(s)); });
  return out;
}
function getProductFabricLabels(p){
  const out = [];
  (p?.fabricOptions || []).forEach(f => { const v = f && (f.label || f.name || f.fabric || f); if(v && !out.includes(String(v))) out.push(String(v)); });
  (p?.fabrics || []).forEach(f => { if(f && !out.includes(String(f))) out.push(String(f)); });
  return out;
}
function showDiscountEl(id, show){
  const el = document.getElementById(id);
  if(el) el.style.display = show ? '' : 'none';
}
function renderDiscountTargets(){
  const targetType = document.getElementById('discountTargetType')?.value || '';
  const categoryEl = document.getElementById('discountCategoryTarget');
  const productEl = document.getElementById('discountProductTarget');
  const scopeEl = document.getElementById('discountApplyScope');

  showDiscountEl('discountCategoryTarget', targetType === 'category');
  showDiscountEl('discountProductTarget', targetType === 'product');
  showDiscountEl('discountApplyScope', targetType === 'product');

  if(categoryEl){
    const categoryNames = (categories || []).map(categoryDisplayName).filter(Boolean);
    const uniqueCategories = [...new Set(categoryNames.concat((products || []).map(p=>p.category).filter(Boolean)))];
    categoryEl.innerHTML = '<option value="">Choose product category</option>' + uniqueCategories.map(c => discountOptionHtml(c, c, false)).join('');
  }
  if(productEl){
    const selected = productEl.value;
    const productList = (products || []).filter(Boolean).slice().sort((a,b)=>productDisplayName(a).localeCompare(productDisplayName(b)));
    productEl.innerHTML = '<option value="">Choose specific product</option>' + productList.map(prod => discountOptionHtml(prod.id, productDisplayName(prod), String(prod.id) === String(selected))).join('');
  }
  if(scopeEl && !scopeEl.value) scopeEl.value = 'product';
  renderDiscountVariantTargets();
}
function renderDiscountVariantTargets(){
  const targetType = document.getElementById('discountTargetType')?.value || '';
  const scope = document.getElementById('discountApplyScope')?.value || 'product';
  const productId = document.getElementById('discountProductTarget')?.value || '';
  const product = getDiscountProductById(productId);
  const sizeEl = document.getElementById('discountSizeTarget');
  const fabricEl = document.getElementById('discountFabricTarget');

  const needsSize = targetType === 'product' && product && (scope === 'size' || scope === 'combo');
  const needsFabric = targetType === 'product' && product && (scope === 'fabric' || scope === 'combo');
  showDiscountEl('discountSizeTarget', !!needsSize);
  showDiscountEl('discountFabricTarget', !!needsFabric);

  if(sizeEl){
    const selected = sizeEl.value;
    const sizes = product ? getProductSizeLabels(product) : [];
    sizeEl.innerHTML = '<option value="">Choose size</option>' + sizes.map(v => discountOptionHtml(v, v, v === selected)).join('');
  }
  if(fabricEl){
    const selected = fabricEl.value;
    const fabrics = product ? getProductFabricLabels(product) : [];
    fabricEl.innerHTML = '<option value="">Choose fabric</option>' + fabrics.map(v => discountOptionHtml(v, v, v === selected)).join('');
  }
}
function buildDiscountRuleFromForm(){
  const targetType = document.getElementById('discountTargetType')?.value || '';
  const percent = Number(document.getElementById('bulkDiscount')?.value || 0);
  const active = (document.getElementById('discountStatus')?.value || 'active') === 'active';
  if(!targetType){ showAdminStatus('Please choose a discount target.', true); return null; }
  if(percent < 0 || percent > 90){ showAdminStatus('Discount must be between 0 and 90.', true); return null; }
  if(!percent && active){ showAdminStatus('Please add discount percentage.', true); return null; }
  if(targetType === 'all') return {targetType, applyScope:'product', percent, active};
  if(targetType === 'category'){
    const category = document.getElementById('discountCategoryTarget')?.value || '';
    if(!category){ showAdminStatus('Please choose product category.', true); return null; }
    return {targetType, category, applyScope:'product', percent, active};
  }
  const productId = document.getElementById('discountProductTarget')?.value || '';
  const applyScope = document.getElementById('discountApplyScope')?.value || 'product';
  if(!productId){ showAdminStatus('Please choose specific product.', true); return null; }
  const size = document.getElementById('discountSizeTarget')?.value || '';
  const fabric = document.getElementById('discountFabricTarget')?.value || '';
  if((applyScope === 'size' || applyScope === 'combo') && !size){ showAdminStatus('Please choose size for this product.', true); return null; }
  if((applyScope === 'fabric' || applyScope === 'combo') && !fabric){ showAdminStatus('Please choose fabric for this product.', true); return null; }
  return {targetType, productId, applyScope, size, fabric, percent, active};
}
function ruleMatchesProduct(rule, p){
  if(!rule || !p) return false;
  if(rule.targetType === 'all') return true;
  if(rule.targetType === 'category') return String(p.category || '') === String(rule.category || '');
  if(rule.targetType === 'product') return String(p.id || '') === String(rule.productId || '');
  return false;
}
function upsertProductDiscountRule(p, rule){
  const cleanRule = {
    id: [rule.targetType, rule.applyScope, rule.category || rule.productId || 'all', rule.size || '', rule.fabric || ''].join('|'),
    targetType: rule.targetType,
    category: rule.category || '',
    productId: rule.productId || '',
    applyScope: rule.applyScope || 'product',
    size: rule.size || '',
    fabric: rule.fabric || '',
    percent: Number(rule.active ? rule.percent : 0),
    active: !!rule.active
  };
  const list = Array.isArray(p.discountRules) ? p.discountRules.filter(r => r && r.id !== cleanRule.id) : [];
  list.push(cleanRule);
  p.discountRules = list.filter(r => r.active && Number(r.percent || 0) > 0);
  if(cleanRule.applyScope === 'product') p.discountPercent = cleanRule.active ? Number(cleanRule.percent || 0) : 0;
  return p;
}
async function saveDiscountProductsPermanent(list){
  prototypeProductsWrite(products);
  if(typeof CV_API === 'undefined') return;
  try{
    const hasApi = await CV_API.available();
    if(!hasApi || !CV_API.token(true)) return;
    for(const p of list){ await saveProductToBackend(p, p); }
  }catch(e){
    console.warn('Discounts saved locally but backend update failed:', e);
    showAdminStatus('Discount saved locally. Backend update failed: ' + (e.message || e), true);
  }
}
async function applyDiscount(){
  if(typeof hasAdminPermission === 'function' && !hasAdminPermission('discounts','write')){ showAdminStatus('You have read-only access for this section.', true); return; }
  products = (products || []).map(normalizeProduct);
  const rule = buildDiscountRuleFromForm();
  if(!rule) return;
  const affected = [];
  products = products.map(p => {
    if(ruleMatchesProduct(rule, p)){
      const updated = upsertProductDiscountRule({...p}, rule);
      affected.push(updated);
      return updated;
    }
    return p;
  });
  if(!affected.length){ showAdminStatus('No matching product found for this discount.', true); return; }
  await saveDiscountProductsPermanent(affected);
  renderProductsAdmin(); renderDiscountList(); renderDiscountTargets();
  showAdminStatus('Discount applied to ' + affected.length + ' product(s).');
}
async function clearDiscounts(){
  if(typeof hasAdminPermission === 'function' && !hasAdminPermission('discounts','write')){ showAdminStatus('You have read-only access for this section.', true); return; }
  products = (products || []).map(p=>({...p, discountPercent:0, discountRules:[]}));
  await saveDiscountProductsPermanent(products);
  renderProductsAdmin(); renderDiscountList(); renderDiscountTargets();
  showAdminStatus('All product discounts cleared.');
}
function describeDiscountRule(r){
  if(!r) return '';
  const parts = [];
  if(r.targetType === 'all') parts.push('All Products');
  if(r.targetType === 'category') parts.push('Category: ' + r.category);
  if(r.targetType === 'product') parts.push('Specific Product');
  if(r.applyScope === 'size') parts.push('Size: ' + r.size);
  if(r.applyScope === 'fabric') parts.push('Fabric: ' + r.fabric);
  if(r.applyScope === 'combo') parts.push('Size: ' + r.size + ' + Fabric: ' + r.fabric);
  parts.push(Number(r.percent || 0) + '% discount');
  return parts.join(' | ');
}
function renderDiscountList(){
  const el = document.getElementById('discountList');
  if(!el) return;
  const rows = [];
  (products || []).forEach(p => {
    const productName = productDisplayName(p);
    if(Number(p.discountPercent || 0) > 0){
      rows.push(`<div class="admin-item"><div><strong>${productName}</strong><br>Product discount: ${Number(p.discountPercent || 0)}%</div><button type="button" onclick="editProduct('${p.id}')">Edit</button></div>`);
    }
    (Array.isArray(p.discountRules) ? p.discountRules : []).forEach(r => {
      if(r && r.active && Number(r.percent || 0) > 0){
        rows.push(`<div class="admin-item"><div><strong>${productName}</strong><br>${describeDiscountRule(r)}</div><button type="button" onclick="editProduct('${p.id}')">Edit</button></div>`);
      }
    });
  });
  el.innerHTML = rows.length ? rows.join('') : '<p>No active discounts.</p>';
}


function currentAdmin(){
  try{
    const session = JSON.parse(sessionStorage.getItem("cvAdminSession") || localStorage.getItem("cvAdminSession") || "null");
    if(!session) return null;
    const fixedSession = enforceSuperAdminRecord(session);
    persistCurrentAdminSession(fixedSession);
    return fixedSession;
  }catch(e){
    return null;
  }
}

function renderAdminUserBar(){
  const box = document.getElementById("adminUserBar");
  const u = currentAdmin();
  if(!box || !u) return;
  box.innerHTML = `<strong>${u.name}</strong> | ${u.role} | ${u.email} <button type="button" id="adminLogoutBtn">Logout</button>`;
  const btn = document.getElementById("adminLogoutBtn");
  if(btn) btn.addEventListener("click", adminLogout);
}

function adminLogout(){
  ['cvAdminApiToken','cvAdminSession','adminToken','token'].forEach(k=>{
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  location.href = "admin-login.html";
}

/* Admin users are now sourced from the backend (the real authority for access control)
   instead of localStorage, so the UI and enforced permissions can never diverge. */
let cvAdminUsersCache = [];

async function loadAdminUsersFromBackend(){
  if(!(typeof CV_API !== 'undefined' && CV_API.token(true))) return [];
  try{
    const rows = await CV_API.request('/admin-users', {admin:true});
    cvAdminUsersCache = Array.isArray(rows) ? rows : [];
  }catch(e){
    cvAdminUsersCache = [];
    showAdminStatus("Could not load admin users from backend: " + (e.message || e), true);
  }
  return cvAdminUsersCache;
}

function renderAdminUsers(){
  const box = document.getElementById("adminUsersList");
  if(!box) return;
  const isSuper = typeof cvIsSuperAdmin === "function" ? cvIsSuperAdmin() : false;
  const current = typeof currentAdmin === "function" ? currentAdmin() : null;
  const list = cvAdminUsersCache || [];
  box.innerHTML = list.length ? list.map((u)=>{
    const isOwner = isOwnerSuperAdminUser(u);
    const isCurrent = current && Number(current.id) === Number(u.id);
    const canDelete = isSuper && !isOwner && !isCurrent && Number(u.active) !== 0;
    const actions = isSuper ? `
      <div class="admin-user-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end;">
        <button type="button" onclick="editAdminPermissions(${u.id})">Edit Authorities</button>
        ${canDelete ? `<button type="button" class="danger" onclick="deleteAdminUser(${u.id})">Delete</button>` : ""}
      </div>` : "";
    return `
      <div class="admin-item admin-user-row">
        <div><strong>${u.name||""}</strong><br>${u.email||""}<br>Role: ${u.role||"admin"}${u.active===0?' (disabled)':''}<br>Authorities: ${isOwner ? "FULL ACCESS (ALL READ / WRITE)" : permissionText(normalizePermissions(u.permissions))}</div>
        ${actions}
      </div>`;
  }).join("") : "<p>No admin users loaded.</p>";
}

async function refreshAdminUsers(){
  await loadAdminUsersFromBackend();
  renderAdminUsers();
}

async function addAdminUser(){
  if(!(typeof cvIsSuperAdmin === "function" && cvIsSuperAdmin())){
    showAdminStatus("Only Super Admin can create users.", true);
    return;
  }
  const name = document.getElementById("newAdminName").value.trim();
  const email = document.getElementById("newAdminEmail").value.trim().toLowerCase();
  const password = document.getElementById("newAdminPassword").value;
  const role = String(document.getElementById("newAdminRole").value || "admin").toLowerCase();
  if(!name || !email || !password){
    showAdminStatus("Name, email and password are required.", true);
    return;
  }
  if(password.length < 8){
    showAdminStatus("Password must be at least 8 characters.", true);
    return;
  }
  const permissions = role === "superadmin" ? cloneFullAdminPermissions() : collectPermissionMatrix();
  try{
    if(!(typeof CV_API !== 'undefined' && CV_API.token(true))) throw new Error("Missing admin token. Logout and login again.");
    await CV_API.request('/admin-users', {method:'POST', admin:true, body:{name,email,password,role,permissions,active:true}});
    document.getElementById("newAdminName").value = "";
    document.getElementById("newAdminEmail").value = "";
    document.getElementById("newAdminPassword").value = "";
    await refreshAdminUsers();
    showAdminStatus(`${role === "superadmin" ? "Super Admin" : "Admin"} user "${name}" created.`);
  }catch(e){
    showAdminStatus("Could not create user: " + (e.message || e), true);
  }
}

async function deleteAdminUser(id){
  if(!(typeof cvIsSuperAdmin === "function" && cvIsSuperAdmin())){
    showAdminStatus("Only Super Admin can delete users.", true);
    return;
  }
  const user = (cvAdminUsersCache || []).find(u => Number(u.id) === Number(id));
  if(!user) return;
  if(!confirm(`Disable admin user "${user.email}"? They will no longer be able to sign in.`)) return;
  try{
    await CV_API.request('/admin-users/' + id, {method:'DELETE', admin:true});
    await refreshAdminUsers();
    showAdminStatus("Admin user disabled.");
  }catch(e){
    showAdminStatus("Could not delete user: " + (e.message || e), true);
  }
}


/* Discount codes: backend-backed. localStorage used as offline fallback only. */
let cvDiscountCodesCache = [];
function getDiscountCodes(){
  return cvDiscountCodesCache.length ? cvDiscountCodesCache : JSON.parse(localStorage.getItem("discountCodes") || "[]");
}
function saveDiscountCodesLocal(codes){
  try{ localStorage.setItem("discountCodes", JSON.stringify(codes)); }catch(e){}
}
async function loadDiscountCodesFromBackend(){
  if(!(typeof CV_API !== 'undefined' && CV_API.token(true))) return;
  try{
    const rows = await CV_API.request('/discounts', {admin:true});
    cvDiscountCodesCache = Array.isArray(rows) ? rows : [];
    saveDiscountCodesLocal(cvDiscountCodesCache);
    renderDiscountCodeList();
  }catch(e){ console.warn('Could not load discount codes from backend:', e.message); }
}
async function addDiscountCode(){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("discounts","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  const code = document.getElementById("discountCodeInput").value.trim().toUpperCase();
  const percent = Number(document.getElementById("discountCodePercent").value || 0);
  const expiry = document.getElementById("discountCodeExpiry").value || null;
  if(!code || !percent){ showAdminStatus("Add discount code and percentage.", true); return; }
  try{
    if(typeof CV_API !== 'undefined' && CV_API.token(true)){
      await CV_API.request('/discounts', {method:'POST', admin:true, body:{code, percent, expires_at:expiry||null, active:true}});
      await loadDiscountCodesFromBackend();
    } else {
      const codes = getDiscountCodes().filter(c=>c.code !== code);
      codes.push({code, percent, expiry, active:true, createdAt:new Date().toISOString()});
      cvDiscountCodesCache = codes;
      saveDiscountCodesLocal(codes);
      renderDiscountCodeList();
    }
    document.getElementById("discountCodeInput").value="";
    document.getElementById("discountCodePercent").value="";
    document.getElementById("discountCodeExpiry").value="";
    showAdminStatus("Discount code saved to backend.");
  }catch(e){ showAdminStatus("Could not save discount code: " + (e.message||e), true); }
}
async function toggleDiscountCode(id){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("discounts","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  try{
    const c = cvDiscountCodesCache.find(x=>x.id===id) || cvDiscountCodesCache[id];
    if(!c) return;
    if(typeof CV_API !== 'undefined' && CV_API.token(true)){
      await CV_API.request('/discounts/'+c.id, {method:'PUT', admin:true, body:{active: !c.active}});
      await loadDiscountCodesFromBackend();
    } else {
      c.active = !c.active;
      renderDiscountCodeList();
    }
  }catch(e){ showAdminStatus("Could not toggle discount code: " + (e.message||e), true); }
}
async function deleteDiscountCode(id){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("discounts","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  const c = cvDiscountCodesCache.find(x=>x.id===id);
  if(!confirm("Delete discount code" + (c?" "+c.code:"") + "?")) return;
  try{
    if(typeof CV_API !== 'undefined' && CV_API.token(true)){
      await CV_API.request('/discounts/'+id, {method:'DELETE', admin:true});
      await loadDiscountCodesFromBackend();
    } else {
      cvDiscountCodesCache = cvDiscountCodesCache.filter(x=>x.id!==id);
      renderDiscountCodeList();
    }
    showAdminStatus("Discount code deleted.");
  }catch(e){ showAdminStatus("Could not delete discount code: " + (e.message||e), true); }
}
function renderDiscountCodeList(){
  const box = document.getElementById("discountCodeList");
  if(!box) return;
  const codes = getDiscountCodes();
  box.innerHTML = codes.length ? codes.map((c)=>`
    <div class="admin-item">
      <div><strong>${c.code||''}</strong><br>${c.percent||c.percent_off||0}% discount ${(c.expiry||c.expires_at) ? "| Expiry: "+(c.expiry||c.expires_at||'') : ""}<br>Status: ${(c.active||c.active===undefined) ? "Active" : "Inactive"}</div>
      <div><button type="button" onclick="toggleDiscountCode(${c.id!==undefined?c.id:JSON.stringify(c.id)})">${(c.active||c.active===undefined) ? "Deactivate" : "Activate"}</button><button type="button" onclick="deleteDiscountCode(${c.id!==undefined?c.id:JSON.stringify(c.id)})">Delete</button></div>
    </div>
  `).join("") : "<p>No discount codes yet.</p>";
}

function editAdminPermissions(id){
  if(!(typeof cvIsSuperAdmin === "function" && cvIsSuperAdmin())){ showAdminStatus("Only Super Admin can edit authorities.", true); return; }
  const user = (cvAdminUsersCache || []).find(u => Number(u.id) === Number(id));
  if(!user) return;
  const isOwner = isOwnerSuperAdminUser(user);
  const perms = normalizePermissions(user.permissions);
  const all = [
    ["menu","Menu Control"],["pictures","Pictures & Banners"],["products","Products"],
    ["categories","Product Category"],["seo","SEO Words"],["discounts","Discounts"],["orders","Orders"],
    ["finance","Financial Dashboard"],["crm","CRM"],["analytics","Analytics / Journey"],
    ["inventory","Inventory"],["security","Security Audit"],["media","Media Library"],["users","Admin Users"]
  ];
  const box = document.createElement("div");
  box.className = "permissions-modal";
  box.innerHTML = `
    <div class="permissions-modal-card">
      <h2>Edit Authorities - ${user.name||user.email}</h2>
      <div style="margin:8px 0;">
        <label>Role:
          <select id="editRoleSelect" ${isOwner ? "disabled" : ""}>
            <option value="admin" ${String(user.role).toLowerCase()!=="superadmin"?"selected":""}>Admin</option>
            <option value="superadmin" ${String(user.role).toLowerCase()==="superadmin"?"selected":""}>Super Admin</option>
          </select>
        </label>
      </div>
      <table class="spec-table">
        <thead><tr><th>Section</th><th>Read</th><th>Write/Edit</th></tr></thead>
        <tbody>
          ${all.map(([key,label])=>`
            <tr>
              <td>${label}</td>
              <td><input type="checkbox" data-edit-perm="${key}" data-edit-level="read" ${perms[key]?.read ? "checked" : ""}></td>
              <td><input type="checkbox" data-edit-perm="${key}" data-edit-level="write" ${perms[key]?.write ? "checked" : ""}></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="modal-actions">
        <button class="btn primary" type="button" id="savePermsBtn">Save Authorities</button>
        <button class="btn secondary" type="button" id="closePermsBtn">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(box);
  document.getElementById("closePermsBtn").onclick = ()=>box.remove();
  document.getElementById("savePermsBtn").onclick = async ()=>{
    const next = {};
    box.querySelectorAll("input[type='checkbox']").forEach(cb=>{
      const p = cb.dataset.editPerm;
      const level = cb.dataset.editLevel;
      if(!next[p]) next[p] = {read:false, write:false};
      next[p][level] = cb.checked;
    });
    const role = isOwner ? "superadmin" : String(document.getElementById("editRoleSelect").value || "admin").toLowerCase();
    try{
      await CV_API.request('/admin-users/' + id, {method:'PUT', admin:true, body:{role, permissions: role === "superadmin" ? {} : next}});
      box.remove();
      await refreshAdminUsers();
      showAdminStatus("Authorities updated.");
    }catch(e){
      showAdminStatus("Could not update authorities: " + (e.message || e), true);
    }
  };
}

function normalizePermissions(perms){
  const all = ["menu","pictures","products","categories","seo","discounts","orders","finance","crm","users","analytics","security","inventory","media"];
  const current = currentAdmin();
  if(isOwnerSuperAdminUser(current)){
    return cloneFullAdminPermissions();
  }
  const obj = {};
  all.forEach(p=>obj[p]={read:false,write:false});
  if(!perms) return obj;
  if(Array.isArray(perms)){
    all.forEach(p=>obj[p]={read:perms.includes(p),write:perms.includes(p)});
    return obj;
  }
  all.forEach(p=>{
    obj[p] = {
      read: !!perms[p]?.read,
      write: !!perms[p]?.write
    };
  });
  return obj;
}

function hasAdminPermission(section, level="read"){
  const u = currentAdmin();
  if(!u) return false;
  if(u.role === "superadmin") return true;
  const perms = normalizePermissions(u.permissions);
  return !!perms[section]?.[level];
}

function applyAdminPermissions(){
  const u = currentAdmin();
  if(!u || u.role === "superadmin") return;

  const map = {menu:"menuControl",pictures:"picturesControl",products:"productsControl",categories:"categoriesControl",seo:"seoControl",discounts:"discountControl",media:"mediaControl",users:"usersControl"};
  Object.entries(map).forEach(([perm,id])=>{
    const section = document.getElementById(id);
    const btn = document.querySelector(`[data-tab="${id}"]`);
    if(!hasAdminPermission(perm,"read")){
      if(section) section.remove();
      if(btn) btn.remove();
    }else if(!hasAdminPermission(perm,"write") && section){
      section.classList.add("read-only-section");
      section.querySelectorAll("input,textarea,select,button").forEach(el=>{
        if(!el.closest(".cms-tabs")) el.disabled = true;
      });
      section.insertAdjacentHTML("afterbegin", `<div class="read-only-note">Read-only access. You cannot edit this section.</div>`);
    }
  });

  document.querySelectorAll(".admin-top-nav a").forEach(a=>{
    const txt = a.textContent.toLowerCase();
    if((txt.includes("orders") && !hasAdminPermission("orders","read")) || (txt.includes("financial") && !hasAdminPermission("finance","read")) || (txt.includes("crm") && !hasAdminPermission("crm","read"))){
      a.remove();
    }
  });

  const firstBtn = document.querySelector(".cms-tabs button:not([disabled])");
  const firstSectionId = firstBtn?.dataset?.tab;
  if(firstBtn && firstSectionId){
    document.querySelectorAll(".cms-tabs button").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".cms-section").forEach(s=>s.classList.remove("active"));
    firstBtn.classList.add("active");
    document.getElementById(firstSectionId)?.classList.add("active");
  }
}
document.addEventListener("DOMContentLoaded", ()=>setTimeout(applyAdminPermissions, 100));

async function saveDiscountPage(){
  if(typeof hasAdminPermission === "function" && !hasAdminPermission("discounts","write")){ showAdminStatus("You have read-only access for this section.", true); return; }
  try{
    prototypeProductsWrite(products);
    await saveDiscountProductsPermanent(products || []);
    localStorage.setItem("discountCodes", JSON.stringify(getDiscountCodes()));
    showAdminStatus("Discount page saved successfully.");
  }catch(e){
    showAdminStatus("Could not save discount page: " + (e.message || e), true);
  }
}

function collectPermissionMatrix(){
  const roleEl = document.getElementById("newAdminRole");
  const selectedRole = String(roleEl?.value || "").toLowerCase();
  if(selectedRole === "superadmin" || isOwnerSuperAdminUser(currentAdmin())){
    document.querySelectorAll("#newAdminPermissionsMatrix input[type='checkbox']").forEach(cb=>{
      cb.checked = true;
      cb.disabled = false;
    });
    return cloneFullAdminPermissions();
  }
  const permissions = {};
  document.querySelectorAll("#newAdminPermissionsMatrix input[type='checkbox']").forEach(cb=>{
    const perm = cb.dataset.perm;
    const level = cb.dataset.level;
    if(!permissions[perm]) permissions[perm] = {read:false, write:false};
    permissions[perm][level] = cb.checked;
  });
  return permissions;
}

function permissionText(perms){
  if(!perms) return "all";
  if(Array.isArray(perms)) return perms.join(", ");
  return Object.entries(perms).map(([k,v])=>`${k}: ${v.read ? "R" : "-"}${v.write ? "/W" : ""}`).join(" | ");
}


function isAutoArabicEnabled(){
  const el = document.getElementById("auto_translate_arabic");
  return el ? el.checked : true;
}

function autoFillArabicFields(){
  const pairs = [
    ["brand_en","brand_ar"],["hero_title_en","hero_title_ar"],["hero_text_en","hero_text_ar"],
    ["intro_title_en","intro_title_ar"],["intro_text_en","intro_text_ar"],
    ["about_title_ar"],["about_text_ar"],
    ["footer_text_en","footer_text_ar"],["footer_extra_info_en","footer_extra_info_ar"],["about_box1_title_ar"],["about_box1_text_ar"],["about_box2_title_ar"],["about_box2_text_ar"],["about_box3_title_ar"],["about_box3_text_ar"]
  ];
  pairs.forEach(([enId, arId])=>{
    const en = document.getElementById(enId);
    const ar = document.getElementById(arId);
    if(en && ar && !ar.value.trim()) ar.value = autoTranslateToArabic(en.value);
  });
  showAdminStatus("Arabic fields auto-filled.");
}

function autoFillProductArabic(){
  const pairs = [["name","name_ar"],["description","description_ar"]];
  pairs.forEach(([enId, arId])=>{
    const en = document.getElementById(enId);
    const ar = document.getElementById(arId);
    if(en && ar && !ar.value.trim()) ar.value = autoTranslateToArabic(en.value);
  });
  // category Arabic auto sync is already linked to category control
  showAdminStatus("Product Arabic fields auto-filled.");
}


/* === Prototype preview reliability fix ===
   This block intentionally overrides earlier prototype preview helpers.
   It does not require a database and does not depend on localStorage for showing the preview.
*/
function cvGetProductImagesForPreview(p){
  const imgs = [];
  const colors = p && p.colors ? p.colors : {};
  Object.keys(colors).forEach(k => {
    const set = colors[k] || {};
    (set.images || []).forEach(img => { if(img) imgs.push(img); });
  });
  (p && p.gallery ? p.gallery : []).forEach(img => { if(img) imgs.push(img); });
  return [...new Set(imgs)].filter(Boolean);
}
function cvFirstPreviewImage(p){
  return cvGetProductImagesForPreview(p)[0] || 'assets/products/product_01.png';
}
function cvPreviewPrice(p){
  const base = Number((p && p.price) || 0);
  const disc = Number((p && p.discountPercent) || 0);
  const vat = Number((p && p.vatRate) || 15);
  const finalPrice = base * (1 - disc / 100) * (1 + vat / 100);
  return 'SAR ' + Math.round(finalPrice || base || 0).toLocaleString();
}
function cvPreviewEsc(value){
  return String(value || '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function prototypeProductsWrite(list){
  // Save a light version for normal shop.html, but never allow storage quota to break the admin preview.
  try{
    const light = (list || []).map(p => ({...p, colors:p.colors || {}, gallery:p.gallery || []}));
    const data = JSON.stringify(light);
    localStorage.setItem('cvPrototypeProducts', data);
    localStorage.setItem('adminProducts', data);
    sessionStorage.setItem('cvPrototypeProducts', data);
    sessionStorage.setItem('adminProducts', data);
    return true;
  }catch(e){
    console.warn('Prototype storage skipped; inline preview will still work:', e);
    try{
      const ultraLight = (list || []).map(p => ({
        id:p.id, name:p.name, name_ar:p.name_ar, category:p.category, category_ar:p.category_ar,
        price:p.price, vatRate:p.vatRate, discountPercent:p.discountPercent,
        description:p.description, description_ar:p.description_ar,
        sizes:p.sizes, sizeOptions:p.sizeOptions, fabrics:p.fabrics, fabricOptions:p.fabricOptions,
        colors:{}, gallery:[]
      }));
      sessionStorage.setItem('cvPrototypeProducts', JSON.stringify(ultraLight));
    }catch(_e){}
    return false;
  }
}
function renderInlineShopPreview(){
  const panel = document.getElementById('prototypeShopPreviewPanel');
  const grid = document.getElementById('prototypeShopPreviewGrid');
  if(!panel || !grid) return;
  const list = (products || []).map(normalizeProduct).filter(p => p && p.name);
  panel.style.display = 'block';
  if(!list.length){
    grid.innerHTML = '<div class="empty-products"><h3>No products saved yet</h3><p>Add a product, click Save Product, then click Open Shop Preview.</p></div>';
    panel.scrollIntoView({behavior:'smooth', block:'start'});
    return;
  }
  grid.innerHTML = list.map((p, i) => `
    <article class="product-card">
      <img src="${cvFirstPreviewImage(p)}" alt="${cvPreviewEsc(p.name)}">
      <div class="product-info">
        <p class="product-cat">${cvPreviewEsc(p.category || '')}</p>
        <h3>${cvPreviewEsc(p.name || 'Product')}</h3>
        <p>${cvPreviewEsc((p.description || '').slice(0, 110))}</p>
        <div class="price-row"><strong>${cvPreviewPrice(p)}</strong></div>
        <button class="btn primary" type="button" onclick="openPrototypeDetailByIndex(${i})">View Details</button>
      </div>
    </article>
  `).join('');
  panel.scrollIntoView({behavior:'smooth', block:'start'});
}
function closeInlineShopPreview(){
  const panel = document.getElementById('prototypeShopPreviewPanel');
  if(panel) panel.style.display = 'none';
}
function openPrototypeDetailByIndex(i){
  const p = (products || []).map(normalizeProduct)[i];
  if(!p) return;
  const imgs = cvGetProductImagesForPreview(p);
  document.getElementById('prototypeDetailName').textContent = p.name || 'Product';
  document.getElementById('prototypeDetailCategory').textContent = p.category || '';
  document.getElementById('prototypeDetailPrice').textContent = cvPreviewPrice(p);
  document.getElementById('prototypeDetailDescription').textContent = p.description || 'No description added yet.';
  document.getElementById('prototypeDetailImage').src = imgs[0] || cvFirstPreviewImage(p);
  document.getElementById('prototypeDetailThumbs').innerHTML = imgs.map((img, idx) => `<img src="${img}" class="${idx===0?'active':''}" onclick="document.getElementById('prototypeDetailImage').src='${String(img).replace(/'/g, "\\'")}'">`).join('');
  document.getElementById('prototypeDetailWhatsapp').href = 'https://wa.me/?text=' + encodeURIComponent('Hello, I am interested in ' + (p.name || 'this product'));
  document.getElementById('prototypeDetailModal').classList.remove('hidden');
}
function closePrototypeDetail(){
  const modal = document.getElementById('prototypeDetailModal');
  if(modal) modal.classList.add('hidden');
}
function openPrototypeShopPreview(){
  // This is the reliable prototype path: show preview inside Super Admin from the current products array.
  products = (products || []).map(normalizeProduct);
  prototypeProductsWrite(products);
  renderInlineShopPreview();
  if(products.length){
    showAdminStatus('Shop Preview shown below using the product saved in Super Admin.');
  }else{
    showAdminStatus('No products saved yet. Add/save a product first.', true);
  }
}

/* === FINAL LOCAL PROTOTYPE FIX 2026-06-06 ===
   Fully local preview: creates a visible full-screen overlay from the current Super Admin products array.
   It does not rely on shop.html, a backend, popups, or localStorage.
*/
function cvFinalEsc(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
}
function cvFinalImages(p){
  const imgs = [];
  const colors = (p && p.colors) || {};
  Object.keys(colors).forEach(function(color){
    const set = colors[color] || {};
    (set.images || []).forEach(function(img){ if(img) imgs.push(img); });
  });
  ((p && p.gallery) || []).forEach(function(img){ if(img) imgs.push(img); });
  return Array.from(new Set(imgs)).filter(Boolean);
}
function cvFinalFirstImage(p){
  return cvFinalImages(p)[0] || 'assets/products/product_01.png';
}
function cvFinalPrice(p){
  const base = Number((p && p.price) || 0);
  const disc = Number((p && p.discountPercent) || 0);
  const vat = Number((p && p.vatRate) || 15);
  const value = base * (1 - disc / 100) * (1 + vat / 100);
  return 'SAR ' + Math.round(value || base || 0).toLocaleString();
}
function cvFinalNormalizeList(){
  let list = [];
  try{
    if(Array.isArray(products) && products.length){ list = products; }
  }catch(e){}
  if(!list.length){
    try{
      const raw = sessionStorage.getItem('cvPrototypeProducts') || localStorage.getItem('cvPrototypeProducts') || sessionStorage.getItem('adminProducts') || localStorage.getItem('adminProducts');
      if(raw) list = JSON.parse(raw) || [];
    }catch(e){}
  }
  return (list || []).map(function(p){
    try{ return typeof normalizeProduct === 'function' ? normalizeProduct(p) : p; }catch(e){ return p; }
  }).filter(function(p){ return p && (p.name || p.id); });
}
function prototypeProductsWrite(list){
  // Safe small storage copy; preview itself does not depend on this.
  try{
    const safe = (list || []).map(function(p){
      return {
        id:p.id, name:p.name, name_ar:p.name_ar, category:p.category, category_ar:p.category_ar,
        price:p.price, costPrice:p.costPrice, vatRate:p.vatRate, discountPercent:p.discountPercent,
        description:p.description, description_ar:p.description_ar,
        sizeOptions:p.sizeOptions, sizes:p.sizes, fabricOptions:p.fabricOptions, fabrics:p.fabrics,
        colors:p.colors || {}, gallery:p.gallery || []
      };
    });
    sessionStorage.setItem('cvPrototypeProducts', JSON.stringify(safe));
    sessionStorage.setItem('adminProducts', JSON.stringify(safe));
    try{ localStorage.setItem('cvPrototypeProducts', JSON.stringify(safe)); localStorage.setItem('adminProducts', JSON.stringify(safe)); }catch(_e){}
  }catch(e){ console.warn('Prototype storage skipped; preview still works from memory.', e); }
}
function cvFinalClosePreview(){
  const old = document.getElementById('cvFinalShopOverlay');
  if(old) old.remove();
}
function cvFinalRenderOverlay(list){
  cvFinalClosePreview();
  const overlay = document.createElement('div');
  overlay.id = 'cvFinalShopOverlay';
  overlay.innerHTML = `
    <div class="cv-final-preview-head">
      <div><strong>Crafted Visual Shop Preview</strong><span>Local prototype preview from Super Admin products</span></div>
      <button type="button" onclick="cvFinalClosePreview()">Close Preview</button>
    </div>
    <div class="cv-final-preview-body">
      <section class="cv-final-hero"><h1>Shop Collection</h1><p>Products saved in Super Admin appear here immediately.</p></section>
      <div id="cvFinalPreviewGrid" class="cv-final-grid"></div>
    </div>
    <div id="cvFinalDetailModal" class="cv-final-modal" style="display:none;"></div>
  `;
  document.body.appendChild(overlay);
  const style = document.createElement('style');
  style.id = 'cvFinalPreviewStyle';
  style.textContent = `
    #cvFinalShopOverlay{position:fixed;inset:0;background:#f7f1e8;z-index:999999;overflow:auto;color:#24201c;font-family:Arial,sans-serif;}
    .cv-final-preview-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 28px;background:#fff;border-bottom:1px solid #e4d7c4;box-shadow:0 2px 12px rgba(0,0,0,.06)}
    .cv-final-preview-head strong{display:block;color:#0f4636;font-size:20px}.cv-final-preview-head span{display:block;font-size:13px;color:#666;margin-top:3px}.cv-final-preview-head button{background:#0f4636;color:#fff;border:0;border-radius:999px;padding:10px 16px;font-weight:700;cursor:pointer}
    .cv-final-preview-body{max-width:1220px;margin:0 auto;padding:28px}.cv-final-hero{text-align:center;padding:30px 10px}.cv-final-hero h1{font-size:42px;margin:0 0 10px}.cv-final-hero p{color:#666}
    .cv-final-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:22px}.cv-final-card{background:#fff;border:1px solid #eadfce;border-radius:22px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.07)}.cv-final-card img{width:100%;height:260px;object-fit:cover;background:#eee}.cv-final-card-body{padding:18px}.cv-final-cat{font-size:13px;color:#0f4636;font-weight:700;margin:0 0 7px}.cv-final-card h3{font-size:22px;margin:0 0 8px}.cv-final-desc{color:#666;min-height:38px}.cv-final-price{font-size:20px;font-weight:800;margin:13px 0}.cv-final-vat-note{font-size:13px;color:#0f4636;font-weight:700;margin-top:-8px;margin-bottom:10px}.cv-final-selected-box{background:#f7f1e7;border:1px solid #eadfce;border-radius:14px;padding:10px 12px;margin:10px 0 14px}.cv-final-selected-line{font-size:14px;margin:4px 0;color:#222}.cv-final-card button{background:#0f4636;color:#fff;border:0;border-radius:999px;padding:12px 18px;font-weight:700;cursor:pointer}.cv-final-empty{background:#fff;border-radius:20px;padding:40px;text-align:center;grid-column:1/-1;border:1px solid #eadfce}.cv-final-modal{position:fixed;inset:0;background:rgba(0,0,0,.64);z-index:1000000;align-items:center;justify-content:center;padding:22px}.cv-final-modal-card{background:#fff;border-radius:24px;max-width:980px;width:100%;max-height:90vh;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:26px;padding:26px;position:relative}.cv-final-close{position:absolute;right:18px;top:14px;background:#111;color:#fff;border:0;border-radius:50%;width:36px;height:36px;font-size:20px;cursor:pointer}.cv-final-main-img{width:100%;height:430px;object-fit:cover;border-radius:18px;background:#eee}.cv-final-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.cv-final-thumbs img{width:64px;height:64px;object-fit:cover;border-radius:10px;cursor:pointer;border:2px solid #eee}.cv-final-options{display:flex;gap:8px;flex-wrap:wrap}.cv-final-pill{border:1px solid #e2d4bf;border-radius:999px;padding:8px 12px;background:#faf8f4;cursor:pointer}.cv-final-size-pill{border-radius:16px;text-align:left;line-height:1.25}.cv-size-name{display:block;font-weight:800}.cv-size-dim{display:block;font-size:12px;color:#666;margin-top:3px}.cv-final-size-pill.active .cv-size-dim{color:#fff;opacity:.9}.cv-final-option-btn.active{background:#0f4636;color:#fff;border-color:#0f4636}.cv-final-summary{margin:14px 0;padding:12px;border:1px solid #eadfce;background:#faf8f4;border-radius:14px}.cv-final-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.cv-final-actions button,.cv-final-actions a{border:0;border-radius:999px;padding:12px 18px;text-decoration:none;font-weight:700}.cv-final-actions button{background:#0f4636;color:#fff}.cv-final-actions a{background:#eee;color:#111}@media(max-width:760px){.cv-final-modal-card{grid-template-columns:1fr}.cv-final-main-img{height:300px}.cv-final-preview-head{align-items:flex-start;flex-direction:column}.cv-final-hero h1{font-size:32px}}
  `;
  document.head.appendChild(style);
  const grid = document.getElementById('cvFinalPreviewGrid');
  if(!list.length){
    grid.innerHTML = '<div class="cv-final-empty"><h2>No product found yet</h2><p>Go to Products, add the product, click Save Product, then click Open Shop Preview again.</p></div>';
    return;
  }
  grid.innerHTML = list.map(function(p, i){
    return `<article class="cv-final-card"><img src="${cvFinalFirstImage(p)}" alt="${cvFinalEsc(p.name || 'Product')}"><div class="cv-final-card-body"><p class="cv-final-cat">${cvFinalEsc(p.category || '')}</p><h3>${cvFinalEsc(p.name || 'Product')}</h3><p class="cv-final-desc">${cvFinalEsc((p.description || '').slice(0,120))}</p><div class="cv-final-price">${cvFinalPrice(p)}</div><button type="button" onclick="cvFinalOpenDetails(${i})">View Details</button></div></article>`;
  }).join('');
  window.cvFinalPreviewProducts = list;
}
function cvFinalOptionPrice(p, selectedSize, selectedFabric){
  let base = Number((p && p.price) || 0);
  const fabric = ((p && p.fabricOptions) || []).find(function(f){ return String(f.label || f) === String(selectedFabric); });
  if(fabric && fabric.sizePrices && selectedSize && fabric.sizePrices[selectedSize] != null && fabric.sizePrices[selectedSize] !== ''){
    base = Number(fabric.sizePrices[selectedSize] || base);
  }else{
    const size = ((p && p.sizeOptions) || []).find(function(s){ return String(s.label || s) === String(selectedSize); });
    if(size && size.price != null && size.price !== '') base = Number(size.price || base);
  }
  const disc = Number((p && p.discountPercent) || 0);
  const vat = Number((p && p.vatRate) || 15);
  return 'SAR ' + Math.round(base * (1 - disc / 100) * (1 + vat / 100) || base || 0).toLocaleString();
}
function cvFinalImagesForColor(p, color){
  if(color && p && p.colors && p.colors[color] && Array.isArray(p.colors[color].images) && p.colors[color].images.length){
    return p.colors[color].images.filter(Boolean);
  }
  return cvFinalImages(p);
}
function cvFinalSetActive(group, value){
  document.querySelectorAll('[data-cv-option-group="'+group+'"]').forEach(function(btn){
    btn.classList.toggle('active', String(btn.getAttribute('data-value')) === String(value));
  });
}

function cvFinalDimensionOnly(size){
  if(!size) return '';
  const w = String(size.width || '').trim();
  const d = String(size.depth || '').trim();
  const h = String(size.height || '').trim();
  if(w || d || h){
    return (w || '-') + ' × ' + (d || '-') + ' × ' + (h || '-') + ' cm';
  }
  return '';
}
function cvFinalSelectedSizeDetails(p, selectedSize){
  const sizes = (p && Array.isArray(p.sizeOptions)) ? p.sizeOptions : [];
  const size = sizes.find(function(s){ return String(s.label || s) === String(selectedSize); });
  if(!size) return selectedSize || 'No size selected';
  const label = String(size.label || selectedSize || '').trim();
  const dim = cvFinalDimensionOnly(size);
  if(label && dim) return label + ' — ' + dim;
  if(dim) return dim;
  return label || 'No size selected';
}
function cvFinalSizeButtonHtml(p, sizeLabel){
  const sizes = (p && Array.isArray(p.sizeOptions)) ? p.sizeOptions : [];
  const size = sizes.find(function(s){ return String(s.label || s) === String(sizeLabel); });
  const label = String((size && size.label) || sizeLabel || '').trim();
  const dim = cvFinalDimensionOnly(size);
  if(label && dim){
    return '<span class="cv-size-name">' + cvFinalEsc(label) + '</span><span class="cv-size-dim">' + cvFinalEsc(dim) + '</span>';
  }
  return cvFinalEsc(dim || label || 'Custom Size');
}
function cvFinalSelectedLineHtml(p, state){
  return '<div class="cv-final-selected-line"><strong>Dimensions:</strong> ' + cvFinalEsc(cvFinalSelectedSizeDetails(p, state.size)) + '</div>' +
         '<div class="cv-final-selected-line"><strong>Color:</strong> ' + cvFinalEsc(state.color || 'No color selected') + '</div>' +
         '<div class="cv-final-selected-line"><strong>Fabric:</strong> ' + cvFinalEsc(state.fabric || 'No fabric selected') + '</div>';
}

function cvFinalRefreshDetail(){
  const state = window.cvFinalDetailState;
  if(!state || !state.product) return;
  const p = state.product;
  const imgs = cvFinalImagesForColor(p, state.color);
  const main = document.getElementById('cvFinalMainImg');
  if(main) main.src = imgs[0] || cvFinalFirstImage(p);
  const thumbs = document.getElementById('cvFinalThumbs');
  if(thumbs){
    thumbs.innerHTML = (imgs.length ? imgs : [cvFinalFirstImage(p)]).map(function(img, idx){
      return `<img src="${img}" class="${idx===0?'active':''}" onclick="cvFinalSelectImage(this)">`;
    }).join('');
  }
  const price = document.getElementById('cvFinalDetailPrice');
  if(price) price.textContent = cvFinalOptionPrice(p, state.size, state.fabric);
  const vatNote = document.getElementById('cvFinalVatNote');
  if(vatNote) vatNote.textContent = 'VAT included';
  const selectedLine = document.getElementById('cvFinalSelectedLine');
  if(selectedLine) selectedLine.innerHTML = cvFinalSelectedLineHtml(p, state);
  const summary = document.getElementById('cvFinalSelectionSummary');
  if(summary){
    summary.innerHTML = '<strong>Current selection:</strong> ' + cvFinalEsc(state.color || 'No color') + ' / ' + cvFinalEsc(cvFinalSelectedSizeDetails(p, state.size)) + ' / ' + cvFinalEsc(state.fabric || 'No fabric');
  }
  const whats = document.getElementById('cvFinalWhatsapp');
  if(whats){
    whats.href = 'https://wa.me/?text=' + encodeURIComponent('Hello, I am interested in ' + (p.name || 'this product') + ' - Color: ' + (state.color || 'N/A') + ', Dimensions: ' + cvFinalSelectedSizeDetails(p, state.size) + ', Fabric: ' + (state.fabric || 'N/A'));
  }
}
function cvFinalSelectImage(el){
  const main = document.getElementById('cvFinalMainImg');
  if(main) main.src = el.src;
  document.querySelectorAll('#cvFinalThumbs img').forEach(function(x){ x.classList.remove('active'); });
  el.classList.add('active');
}
function cvFinalChooseOption(group, value){
  if(!window.cvFinalDetailState) return;
  if(group === 'color') window.cvFinalDetailState.color = value;
  if(group === 'size') window.cvFinalDetailState.size = value;
  if(group === 'fabric') window.cvFinalDetailState.fabric = value;
  cvFinalSetActive(group, value);
  cvFinalRefreshDetail();
}
function cvFinalAddToCart(){
  const state = window.cvFinalDetailState;
  if(!state || !state.product) return;
  alert('Prototype cart preview:\n' + (state.product.name || 'Product') + '\nColor: ' + (state.color || 'N/A') + '\nDimensions: ' + cvFinalSelectedSizeDetails(state.product, state.size) + '\nFabric: ' + (state.fabric || 'N/A') + '\nPrice: ' + cvFinalOptionPrice(state.product, state.size, state.fabric));
}
function cvFinalOpenDetails(i){
  const p = (window.cvFinalPreviewProducts || [])[i];
  if(!p) return;
  const colors = Object.keys(p.colors || {});
  const sizes = (Array.isArray(p.sizeOptions) && p.sizeOptions.length ? p.sizeOptions.map(function(s){ return s.label || s; }) : (p.sizes || []));
  const fabrics = (Array.isArray(p.fabricOptions) && p.fabricOptions.length ? p.fabricOptions.map(function(f){ return f.label || f; }) : (p.fabrics || []));
  window.cvFinalDetailState = { product:p, color: colors[0] || '', size: sizes[0] || '', fabric: fabrics[0] || '' };
  const first = cvFinalImagesForColor(p, window.cvFinalDetailState.color)[0] || cvFinalFirstImage(p);
  const modal = document.getElementById('cvFinalDetailModal');
  modal.innerHTML = `<div class="cv-final-modal-card"><button class="cv-final-close" onclick="document.getElementById('cvFinalDetailModal').style.display='none'">×</button><div><img id="cvFinalMainImg" class="cv-final-main-img" src="${first}" alt="${cvFinalEsc(p.name || '')}"><div id="cvFinalThumbs" class="cv-final-thumbs"></div></div><div><h2>${cvFinalEsc(p.name || 'Product')}</h2><p><strong>${cvFinalEsc(p.category || '')}</strong></p><h3 id="cvFinalDetailPrice">${cvFinalOptionPrice(p, window.cvFinalDetailState.size, window.cvFinalDetailState.fabric)}</h3><div id="cvFinalVatNote" class="cv-final-vat-note">VAT included</div><div id="cvFinalSelectedLine" class="cv-final-selected-box"></div><p>${cvFinalEsc(p.description || 'No description added yet.')}</p><h4>Colors</h4><div class="cv-final-options">${colors.length?colors.map(function(c,idx){return `<button type="button" class="cv-final-pill cv-final-option-btn ${idx===0?'active':''}" data-cv-option-group="color" data-value="${cvFinalEsc(c)}" onclick="cvFinalChooseOption('color', this.getAttribute('data-value'))">${cvFinalEsc(c)}</button>`;}).join(''):'<small>No colors added</small>'}</div><h4>Sizes / Dimensions</h4><div class="cv-final-options">${sizes.length?sizes.map(function(s,idx){return `<button type="button" class="cv-final-pill cv-final-size-pill cv-final-option-btn ${idx===0?'active':''}" data-cv-option-group="size" data-value="${cvFinalEsc(s)}" onclick="cvFinalChooseOption('size', this.getAttribute('data-value'))">${cvFinalSizeButtonHtml(p, s)}</button>`;}).join(''):'<small>No sizes/dimensions added</small>'}</div><div style="font-size:12px;color:#666;margin-top:6px;">Each button shows the size name plus Width × Depth × Height in cm as entered in Super Admin.</div><h4>Fabrics</h4><div class="cv-final-options">${fabrics.length?fabrics.map(function(f,idx){return `<button type="button" class="cv-final-pill cv-final-option-btn ${idx===0?'active':''}" data-cv-option-group="fabric" data-value="${cvFinalEsc(f)}" onclick="cvFinalChooseOption('fabric', this.getAttribute('data-value'))">${cvFinalEsc(f)}</button>`;}).join(''):'<small>No fabrics added</small>'}</div><div id="cvFinalSelectionSummary" class="cv-final-summary"></div><div class="cv-final-actions"><button onclick="cvFinalAddToCart()">Add to Cart</button><a id="cvFinalWhatsapp" target="_blank" href="#">WhatsApp Enquiry</a></div></div></div>`;
  modal.style.display = 'flex';
  cvFinalRefreshDetail();
}
function openPrototypeShopPreview(){
  try{ if(Array.isArray(products)) prototypeProductsWrite(products); }catch(e){}
  const list = cvFinalNormalizeList();
  cvFinalRenderOverlay(list);
  if(typeof showAdminStatus === 'function'){
    showAdminStatus(list.length ? 'Shop Preview opened. Product is displayed in the full-screen preview.' : 'No products found. Add/save product first, then click Open Shop Preview.', !list.length);
  }
}

/* === CV FINAL LIVE SHOP + FABRIC PHOTO PATCH === */
function openRealShop(){
  window.location.href = 'shop.html';
}

// Override old prototype preview button behavior: users now view the real Shop page directly.
window.openPrototypeShopPreview = openRealShop;

// Re-define Add Color Photos to keep the fabric name attached to every uploaded picture.
async function addColorSet(){
  const nameEl = document.getElementById('colorName');
  const codeEl = document.getElementById('colorCode');
  const hexEl = document.getElementById('colorHex');
  const fileEl = document.getElementById('colorFiles');
  const fabricEl = document.getElementById('colorPhotoFabric');
  const name = (nameEl && nameEl.value || '').trim();
  const code = (codeEl && codeEl.value || '').trim();
  const photoFabric = (fabricEl && fabricEl.value || '').trim();
  const files = fileEl ? fileEl.files : [];
  if(!name){ alert('Add color name'); return; }
  if(!files.length && !colorSets[name]){ alert('Attach at least one picture'); return; }
  const newImages = files && files.length ? await readFilesAsDataUrls(files) : [];
  const existing = colorSets[name] || {};
  const existingImages = Array.isArray(existing.images) ? existing.images : [];
  const existingMeta = Array.isArray(existing.imageMeta) ? existing.imageMeta : existingImages.map(function(url){ return {url:url, fabric: existing.fabric || ''}; });
  const newMeta = newImages.map(function(url){ return {url:url, fabric:photoFabric}; });
  colorSets[name] = {
    hex: code.startsWith('#') ? code : (hexEl ? hexEl.value : '#183d32'),
    code: code.startsWith('#') ? '' : code,
    fabric: photoFabric || existing.fabric || '',
    images: existingImages.concat(newImages),
    imageMeta: existingMeta.concat(newMeta)
  };
  if(nameEl) nameEl.value = '';
  if(codeEl) codeEl.value = '';
  if(fabricEl) fabricEl.value = '';
  if(fileEl) fileEl.value = '';
  renderColorSets();
}

// Re-render color sets with fabric labels under each picture.
function renderColorSets(){
  const wrap = document.getElementById('colorSetsPreview');
  if(!wrap) return;
  wrap.innerHTML = Object.entries(colorSets || {}).map(function(entry){
    const name = entry[0], set = entry[1] || {};
    const imgs = Array.isArray(set.images) ? set.images : [];
    const meta = Array.isArray(set.imageMeta) ? set.imageMeta : imgs.map(function(url){return {url:url, fabric:set.fabric || ''};});
    return '<div class="color-set-card">' +
      '<div class="color-set-head"><span class="color-dot big" style="background:' + (set.hex || '#ccc') + '"></span><strong>' + name + '</strong><small>' + (set.code || set.hex || '') + '</small><button type="button" onclick="removeColorSet(\'' + name.replace(/'/g,"\\'") + '\')">Remove</button></div>' +
      '<div class="admin-thumbs">' + imgs.map(function(img,idx){
        const fab = (meta[idx] && meta[idx].fabric) || set.fabric || '';
        return '<div><img src="' + img + '"><small>' + (fab ? 'Fabric: ' + fab : 'Fabric not assigned') + '</small><button type="button" onclick="removeColorImage(\'' + name.replace(/'/g,"\\'") + '\',' + idx + ')">x</button></div>';
      }).join('') + '</div></div>';
  }).join('');
}

// Ensure remove keeps image metadata aligned.
function removeColorImage(name,idx){
  if(!colorSets[name]) return;
  if(Array.isArray(colorSets[name].images)) colorSets[name].images.splice(idx,1);
  if(Array.isArray(colorSets[name].imageMeta)) colorSets[name].imageMeta.splice(idx,1);
  renderColorSets();
}


/* === Analytics Center inside Admin === */
function analyticsSafe(v){
  return String(v ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
function analyticsToken(){
  return (typeof CV_API !== 'undefined' && CV_API.token && CV_API.token(true)) || localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken') || '';
}
async function analyticsApi(path){
  const headers = { 'Content-Type':'application/json' };
  const t = analyticsToken();
  if(t) headers.Authorization = 'Bearer ' + t;
  const res = await fetch(path, { headers });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || 'Analytics API failed');
  return data;
}
function analyticsRows(id, arr, labelFn, valueFn, subFn){
  const box = document.getElementById(id);
  if(!box) return;
  const max = Math.max(...(arr || []).map(x => Number(valueFn(x) || 0)), 1);
  box.innerHTML = (arr && arr.length) ? arr.map(x => {
    const value = Number(valueFn(x) || 0);
    const width = Math.max(4, Math.round((value / max) * 100));
    return '<div class="analytics-row"><div style="flex:1"><strong>' + analyticsSafe(labelFn(x)) + '</strong>' + (subFn ? '<div class="analytics-muted">' + analyticsSafe(subFn(x)) + '</div>' : '') + '<div class="analytics-bar" style="width:' + width + '%"></div></div><span class="analytics-pill">' + value + '</span></div>';
  }).join('') : '<div class="analytics-muted">No data yet. Visit the website, products, cart, contact form, then refresh.</div>';
}
async function loadAnalyticsCenter(){
  const status = document.getElementById('analyticsStatus');
  if(status) status.textContent = 'Loading Analytics Center...';
  const days = document.getElementById('analyticsPeriod')?.value || 30;
  try{
    const [summary, events] = await Promise.all([
      analyticsApi('/api/journey/summary?days=' + encodeURIComponent(days)),
      analyticsApi('/api/journey/events')
    ]);
    const funnel = summary.funnel || [];
    const conversionEvents = funnel.filter(x => /add_to_cart|checkout|order|purchase|lead|whatsapp/i.test(x.event_type || '')).reduce((s,x)=>s+Number(x.count||0),0);
    const setText = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
    setText('kpiSessions', summary.totals?.sessions || 0);
    setText('kpiEvents', summary.totals?.events || 0);
    setText('kpiAbandoned', summary.abandoned?.open_carts || 0);
    setText('kpiConversions', conversionEvents || 0);

    analyticsRows('analyticsFunnel', funnel, x => x.event_type || 'event', x => x.count || 0, x => (x.sessions || 0) + ' sessions');
    analyticsRows('analyticsSources', summary.sources || [], x => (x.source || 'direct') + ' / ' + (x.medium || 'none'), x => x.sessions || 0, x => (x.events || 0) + ' events');
    analyticsRows('analyticsPages', summary.pages || [], x => x.page_url || '/', x => x.views || 0, x => (x.sessions || 0) + ' sessions');
    analyticsRows('analyticsProducts', summary.products || [], x => x.product_name || x.product_id || 'Unknown Product', x => x.views || 0, x => (x.sessions || 0) + ' sessions');

    const tbody = document.getElementById('analyticsRecentEvents');
    if(tbody){
      tbody.innerHTML = (events || []).slice(0,50).map(e => '<tr><td>' + analyticsSafe(e.created_at || '') + '</td><td>' + analyticsSafe((e.session_id || '').slice(0,18)) + '</td><td>' + analyticsSafe(e.event_type || '') + '</td><td>' + analyticsSafe(e.page_url || '') + '</td><td>' + analyticsSafe(e.product_name || e.product_id || '') + '</td><td>' + analyticsSafe(e.source || 'direct') + '</td><td>' + analyticsSafe(e.device || '') + '</td></tr>').join('') || '<tr><td colspan="7">No customer journey events yet.</td></tr>';
    }
    if(status) status.textContent = 'Analytics Center updated. Tracking is live from pages using analytics-tracker.js.';
  }catch(err){
    if(status) status.textContent = 'Could not load analytics. Login as Super Admin and confirm analytics permission. ' + err.message;
  }
}


/* === PERMANENT GODMODE PERMISSION UI PATCH === */
function activateGodModePermissionMatrix(){
  const u = currentAdmin();
  if(!isOwnerSuperAdminUser(u)) return;
  document.querySelectorAll("#newAdminPermissionsMatrix input[type='checkbox']").forEach(cb=>{
    cb.checked = true;
    cb.disabled = false;
  });
}
document.addEventListener("DOMContentLoaded", ()=>{
  setTimeout(()=>{
    const u = currentAdmin();
    if(isOwnerSuperAdminUser(u)){
      const users = cvAdminUsersCache || [];
      const currentEmail = String(u.email || '').toLowerCase();
      users.forEach(user=>{
        if(String(user.email || '').toLowerCase() === currentEmail || String(user.role || '').toLowerCase() === 'superadmin'){
          enforceSuperAdminRecord(user);
        }
      });
      persistAdminUsers(users);
      persistCurrentAdminSession(enforceSuperAdminRecord(u));
      activateGodModePermissionMatrix();
      renderAdminUsers();
      renderAdminUserBar();
    }
  }, 150);
});


/* === SUPERADMIN FULL ACTIONS FIX v17 ===
   Permanent frontend action fix: use the real admin JWT for backend writes,
   publish menu/categories/SEO/settings through /api/settings, and delegate
   tab clicks so dynamically-added UX95 Analytics works. */
function cvFullPermissions(){
  const all = ["menu","pictures","products","categories","seo","discounts","orders","finance","crm","users","analytics","security","inventory","media","settings"];
  const out = {};
  all.forEach(k => out[k] = {read:true, write:true});
  return out;
}
function cvAdminToken(){
  return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken') || '';
}
function cvAdminSession(){
  try{return JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null');}catch(e){return null;}
}
function cvIsSuperAdmin(){
  const u = cvAdminSession() || (typeof currentAdmin === 'function' ? currentAdmin() : null);
  return !!u && (String(u.role || '').toLowerCase() === 'superadmin' || String(u.email || '').toLowerCase() === 'admin@craftedvisual.com');
}
async function cvAdminFetch(path, options={}){
  const token = cvAdminToken();
  if(!token) throw new Error('Admin API token missing. Please logout and login again.');
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: Object.assign({'Content-Type':'application/json', Authorization:'Bearer ' + token}, options.headers || {}),
    body: options.body !== undefined ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || data.message || ('HTTP ' + res.status));
  return data;
}
async function cvPublishSettingsPatch(patch){
  const latest = await fetch('/api/settings', {cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}));
  const next = Object.assign({}, latest || {}, settings || {}, patch || {});
  const result = await cvAdminFetch('/api/settings', {method:'PUT', body:next});
  settings = Object.assign({}, next, result.settings || {});
  return settings;
}
async function getJSON(file, fallback){
  const localKey = file.replace('.json','');
  const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  if(isHttp){
    try{
      const liveSettings = await fetch('/api/settings', {cache:'no-store'}).then(r=>r.ok?r.json():null);
      if(file === 'settings.json' && liveSettings) return liveSettings;
      if(file === 'menu.json' && Array.isArray(liveSettings?.menu)) return normalizeMenuRoutes(liveSettings.menu);
      if(file === 'categories.json' && Array.isArray(liveSettings?.categories)) return liveSettings.categories;
    }catch(e){}
    if(file === 'categories.json'){
      try{
        const rows = await fetch('/api/categories', {cache:'no-store'}).then(r=>r.ok?r.json():[]);
        if(Array.isArray(rows) && rows.length){
          return rows.map(r=>({label_en:r.name_en || r.label_en, label_ar:r.name_ar || r.label_ar || '', visible:r.active !== 0}));
        }
      }catch(e){}
    }
  }
  const local = localStorage.getItem('cms_' + localKey) || sessionStorage.getItem('cms_' + localKey);
  if(local){ try { return JSON.parse(local); } catch(e){} }
  try { const res = await fetch(file, {cache:'no-store'}); if(!res.ok) throw new Error('fetch failed'); return await res.json(); } catch(e) { return fallback; }
}
async function saveSettingsPermanent(){
  const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  if(isHttp && cvAdminToken()){
    return await cvPublishSettingsPatch(settings || {});
  }
  localStorage.setItem('cms_settings', JSON.stringify(settings));
  sessionStorage.removeItem('cms_settings');
  return {ok:true, localOnly:true};
}
async function saveMenu(){
  if(typeof hasAdminPermission === 'function' && !hasAdminPermission('menu','write')){ showAdminStatus('You have read-only access for this section.', true); return; }
  try{
    menu = normalizeMenuRoutes(menu || []);
    await cvPublishSettingsPatch({menu});
    localStorage.setItem('cms_menu', JSON.stringify(menu));
    sessionStorage.setItem('cms_menu', JSON.stringify(menu));
    showAdminStatus('Menu published permanently to the live backend.');
  }catch(e){
    console.error('Menu publish failed:', e);
    localStorage.setItem('cms_menu', JSON.stringify(menu));
    showAdminStatus('Menu saved locally only. API error: ' + (e.message || e), true);
  }
}
async function saveCategories(){
  if(typeof hasAdminPermission === 'function' && !hasAdminPermission('categories','write')){ showAdminStatus('You have read-only access for this section.', true); return; }
  try{
    categories = (categories || []).filter(c=>!isBlockedCategory(c.label_en));
    await cvPublishSettingsPatch({categories});
    localStorage.setItem('cms_categories', JSON.stringify(categories));
    sessionStorage.setItem('cms_categories', JSON.stringify(categories));
    showAdminStatus('Categories published permanently to the live backend.');
  }catch(e){
    console.error('Category publish failed:', e);
    localStorage.setItem('cms_categories', JSON.stringify(categories));
    sessionStorage.setItem('cms_categories', JSON.stringify(categories));
    showAdminStatus('Categories saved locally only. API error: ' + (e.message || e), true);
  }
}
async function addCategory(){
  if(typeof hasAdminPermission === 'function' && !hasAdminPermission('categories','write')){ showAdminStatus('You have read-only access for this section.', true); return; }
  const en = document.getElementById('cat_en').value.trim();
  const ar = document.getElementById('cat_ar').value.trim();
  if(!en){ alert('Add English category'); return; }
  if(isBlockedCategory(en)){ showAdminStatus('Luxury categories are currently hidden/blocked until you add them again later.', true); return; }
  const item = {label_en:en, label_ar: ar || (isAutoArabicEnabled() ? autoTranslateToArabic(en) : en), visible:true};
  categories.push(item);
  document.getElementById('cat_en').value = '';
  document.getElementById('cat_ar').value = '';
  renderCategories(); renderCategorySelect(); renderDiscountTargets(); syncCategoryArabic();
  try{
    await cvAdminFetch('/api/categories', {method:'POST', body:{name_en:item.label_en, name_ar:item.label_ar, active:true, sort_order:categories.length}}).catch(()=>null);
  }catch(e){}
  await saveCategories();
}
function normalizePermissions(perms){
  const all = ['menu','pictures','products','categories','seo','discounts','orders','finance','crm','users','analytics','security','inventory','media','settings'];
  const obj = {};
  all.forEach(p=>obj[p]={read:false,write:false});
  if(cvIsSuperAdmin()) return cvFullPermissions();
  if(!perms) return obj;
  if(Array.isArray(perms)){ all.forEach(p=>obj[p]={read:perms.includes(p),write:perms.includes(p)}); return obj; }
  all.forEach(p=>{ obj[p] = {read:!!perms[p]?.read, write:!!perms[p]?.write}; });
  return obj;
}
function hasAdminPermission(section, level='read'){
  if(cvIsSuperAdmin()) return true;
  const u = cvAdminSession();
  if(!u) return false;
  if(typeof window.cvHasPermission === 'function' && window.cvHasPermission(section, level)) return true;
  const perms = normalizePermissions(u.permissions);
  return !!perms[section]?.[level];
}
document.addEventListener('click', function(e){
  const tabBtn = e.target.closest('[data-tab]');
  if(tabBtn){ e.preventDefault(); openTab(tabBtn.dataset.tab, tabBtn); return; }
  const tabLink = e.target.closest('[data-tab-link]');
  if(tabLink){ e.preventDefault(); const id=tabLink.dataset.tabLink; openTab(id, document.querySelector('[data-tab="'+id+'"]')); }
});
document.addEventListener('DOMContentLoaded', function(){
  if(cvIsSuperAdmin()){
    const u = cvAdminSession() || {};
    u.name = 'Super Admin'; u.role = 'superadmin'; u.permissions = cvFullPermissions();
    localStorage.setItem('cvAdminSession', JSON.stringify(u));
    sessionStorage.setItem('cvAdminSession', JSON.stringify(u));
    document.querySelectorAll('#newAdminPermissionsMatrix input[type="checkbox"]').forEach(cb => { cb.checked = true; cb.disabled = false; });
  }
});


/* ===== Media Library (backend-backed) ===== */
let cvMediaCache = [];

async function loadMedia(){
  const grid = document.getElementById('mediaGrid');
  if(!(typeof CV_API !== 'undefined' && CV_API.token(true))) return;
  try{
    cvMediaCache = await CV_API.request('/media', {admin:true});
  }catch(e){
    cvMediaCache = [];
    if(grid) grid.innerHTML = '<p>Could not load media: ' + (e.message || e) + '</p>';
    return;
  }
  renderMediaGrid();
}

function renderMediaGrid(){
  const grid = document.getElementById('mediaGrid');
  if(!grid) return;
  const canWrite = (typeof cvIsSuperAdmin === 'function' && cvIsSuperAdmin()) || (typeof hasAdminPermission === 'function' && hasAdminPermission('media','write'));
  if(!cvMediaCache.length){ grid.innerHTML = '<p>No images uploaded yet.</p>'; return; }
  grid.innerHTML = cvMediaCache.map(m => {
    const kb = Math.max(1, Math.round((m.size_bytes||0)/1024));
    const assigned = (m.assignments||[]).map(a => `${a.target_type}${a.target_id?(' #'+a.target_id):''}`).join(', ');
    return `
    <div class="media-card" style="border:1px solid #ddd;border-radius:8px;padding:8px;width:200px;display:inline-block;vertical-align:top;margin:6px;">
      <img src="${m.url}" alt="${(m.alt_text||'').replace(/"/g,'&quot;')}" style="width:100%;height:130px;object-fit:cover;border-radius:6px;">
      <div style="font-size:12px;margin-top:6px;word-break:break-all;">
        <div><strong>${m.original_name||m.filename}</strong></div>
        <div>${m.mime||'image'} · ${kb} KB</div>
        <div>By: ${m.uploader_name||'—'}</div>
        <div>${(m.created_at||'').slice(0,16).replace('T',' ')}</div>
        ${assigned?`<div>Assigned: ${assigned}</div>`:''}
        <input type="text" value="${(m.alt_text||'').replace(/"/g,'&quot;')}" id="mediaAlt_${m.id}" placeholder="Alt text" style="width:100%;margin-top:4px;" ${canWrite?'':'disabled'}>
      </div>
      ${canWrite?`<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">
        <button type="button" class="btn secondary" onclick="saveMediaAlt(${m.id})">Save Alt</button>
        <button type="button" class="btn secondary" onclick="openAssignMedia(${m.id})">Assign</button>
        <button type="button" class="btn" onclick="deleteMedia(${m.id})">Delete</button>
      </div>`:''}
    </div>`;
  }).join('');
}

async function uploadMedia(){
  if(!((typeof cvIsSuperAdmin === 'function' && cvIsSuperAdmin()) || (typeof hasAdminPermission === 'function' && hasAdminPermission('media','write')))){
    showAdminStatus('You do not have permission to upload media.', true); return;
  }
  const input = document.getElementById('mediaFileInput');
  const altInput = document.getElementById('mediaAltInput');
  const file = input && input.files && input.files[0];
  if(!file){ showAdminStatus('Choose an image file first.', true); return; }
  const fd = new FormData();
  fd.append('file', file);
  if(altInput && altInput.value) fd.append('alt_text', altInput.value);
  try{
    const token = (typeof cvAdminToken === 'function' ? cvAdminToken() : (localStorage.getItem('cvAdminApiToken')||sessionStorage.getItem('cvAdminApiToken')));
    const res = await fetch('/api/media', { method:'POST', headers:{ Authorization:'Bearer ' + token }, body: fd });
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    if(input) input.value = '';
    if(altInput) altInput.value = '';
    await loadMedia();
    showAdminStatus('Image uploaded to media library.');
  }catch(e){
    showAdminStatus('Upload failed: ' + (e.message || e), true);
  }
}

async function saveMediaAlt(id){
  const el = document.getElementById('mediaAlt_' + id);
  try{
    await CV_API.request('/media/' + id, {method:'PUT', admin:true, body:{alt_text: el ? el.value : ''}});
    await loadMedia();
    showAdminStatus('Alt text saved.');
  }catch(e){ showAdminStatus('Could not save alt text: ' + (e.message || e), true); }
}

async function deleteMedia(id){
  if(!confirm('Delete this image from the media library? This also removes its assignments.')) return;
  try{
    await CV_API.request('/media/' + id, {method:'DELETE', admin:true});
    await loadMedia();
    showAdminStatus('Image deleted.');
  }catch(e){ showAdminStatus('Could not delete image: ' + (e.message || e), true); }
}

function openAssignMedia(id){
  const targetType = prompt('Assign to which target type? Enter one of: product, banner, page, section');
  if(!targetType) return;
  const t = String(targetType).trim().toLowerCase();
  if(!['product','banner','page','section'].includes(t)){ showAdminStatus('Invalid target type.', true); return; }
  const hint = t === 'banner' ? 'banner slot number (1-5)' : (t === 'product' ? 'product id or SKU' : (t + ' key, e.g. home-hero'));
  const targetId = prompt('Enter the ' + hint + ':') || '';
  assignMedia(id, t, targetId.trim());
}

async function assignMedia(id, targetType, targetId){
  try{
    await CV_API.request('/media/' + id + '/assign', {method:'POST', admin:true, body:{target_type:targetType, target_id:targetId}});
    await loadMedia();
    showAdminStatus('Image assigned to ' + targetType + (targetId?(' #'+targetId):'') + '.');
  }catch(e){ showAdminStatus('Could not assign image: ' + (e.message || e), true); }
}


try { window.addAdminUser = addAdminUser; window.refreshAdminUsers = refreshAdminUsers; window.renderAdminUsers = renderAdminUsers; window.renderMenu = renderMenu; } catch(e) {}
