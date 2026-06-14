
let products = [];
let settings = {};
let menu = [];
let cities = [];
let categories = [];
let currentProduct = null;
let selectedColor = "";
let selectedImage = "";
let selectedSizeOption = null;
let selectedFabricOption = null;
let lang = localStorage.getItem("lang") || "en";
let cart = JSON.parse(localStorage.getItem("cart") || sessionStorage.getItem("cart") || "[]").map(item => ({...item, thumb:undefined}));
let currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
let ratings = JSON.parse(localStorage.getItem("ratings") || "{}");
let activeCategory = new URLSearchParams(window.location.search).get("category") || window.CV_CATEGORY_FILTER || "All";

// Prototype bridge: allows Super Admin to open a Shop preview tab and pass saved products
// without a live database. This is for local/static prototype testing only.
function cvReceivePreviewProducts(incoming){
  try{
    if(!Array.isArray(incoming)) return;
    const data = JSON.stringify(incoming);
    localStorage.setItem('cvPrototypeProducts', data);
    localStorage.setItem('adminProducts', data);
    sessionStorage.setItem('cvPrototypeProducts', data);
    sessionStorage.setItem('adminProducts', data);
    products = incoming.map(normalizeProduct);
    renderDynamicCategories();
    applySortAndFilter();
  }catch(e){ console.warn('Preview product sync failed', e); }
}
window.addEventListener('message', function(event){
  if(event && event.data && event.data.type === 'CV_PRODUCTS_PREVIEW') cvReceivePreviewProducts(event.data.products || []);
});

const DEFAULT_WHATSAPP = "966500000000";
const DEFAULT_CATEGORIES = [
  {label_en:"L Shape Sofas", label_ar:"كنب حرف L", visible:true},
  {label_en:"Beds", label_ar:"أسرة", visible:true},
  {label_en:"Single Chairs", label_ar:"كراسي مفردة", visible:true}
];
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


function normalizeMenuRoutes(items){
  return (items || []).filter(item => item && item.url !== "about.html" && item.label_en !== "About Us").map(item => {
    const m = {...item};
    if(m.url === "index.html#shop" || m.url === "#shop") m.url = "shop.html";
    if(m.url === "index.html#home" || m.url === "#home") m.url = "index.html";
    return m;
  });
}

const T = {
  en: {
    cart:"Cart", signIn:"Sign In", signOut:"Sign Out",
    shopCollection:"Shop Collection", requestQuote:"Request Custom Quote",
    catSofa:"L Shape Sofas", catBeds:"Beds", catChairs:"Single Chairs", viewAll:"View All",
    customTitle:"Custom Furniture Request", productCategory:"Product Category", sendWhatsApp:"Send by WhatsApp",
    whatsappUs:"WhatsApp Us", color:"Color", fabric:"Fabric", size:"Size", addCart:"Add to Cart", whatsappInquiry:"WhatsApp Inquiry",
    yourCart:"Your Cart", checkout:"Checkout", empty:"Your cart is empty.", total:"Total",
    rating:"Customer Rating", rateItem:"Rate this item", loginRequired:"Please sign in or create an account before ordering.",
    was:"Was", now:"Now", discount:"Discount", delivery:"Delivery", free:"Free", riyadhFree:"Free delivery within Riyadh"
  },
  ar: {
    cart:"السلة", signIn:"تسجيل الدخول", signOut:"تسجيل الخروج",
    shopCollection:"تسوق المجموعة", requestQuote:"طلب عرض سعر خاص",
    catSofa:"كنب حرف L", catBeds:"أسرة", catChairs:"كراسي مفردة", viewAll:"عرض الكل",
    customTitle:"طلب تفصيل أثاث", productCategory:"فئة المنتج", sendWhatsApp:"إرسال عبر واتساب",
    whatsappUs:"تواصل واتساب", color:"اللون", fabric:"القماش", size:"المقاس", addCart:"أضف للسلة", whatsappInquiry:"استفسار واتساب",
    yourCart:"سلة التسوق", checkout:"الدفع", empty:"السلة فارغة.", total:"الإجمالي",
    rating:"تقييم العملاء", rateItem:"قيّم المنتج", loginRequired:"يرجى إنشاء حساب أو تسجيل الدخول قبل إتمام الطلب.",
    was:"السعر السابق", now:"الآن", discount:"خصم", delivery:"التوصيل", free:"مجاني", riyadhFree:"توصيل مجاني داخل الرياض"
  }
};

async function getJSON(file, fallback){
  const localKey = file.replace(".json","");
  if(file === "settings.json" && (window.location.protocol === 'http:' || window.location.protocol === 'https:')){
    try{
      const res = await fetch('/api/settings', {cache:'no-store'});
      if(res.ok) return await res.json();
    }catch(e){ console.warn('SEO/settings API unavailable, using local/static settings.', e); }
  }
  const local = localStorage.getItem("cms_" + localKey) || sessionStorage.getItem("cms_" + localKey);
  if(local) return JSON.parse(local);
  try { return await fetch(file, {cache:'no-store'}).then(r=>r.json()); } catch(e){ return fallback; }
}

function apiProductToFrontend(row){
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

function prototypeProductsReadFront(){
  const raw = localStorage.getItem('cvPrototypeProducts') || localStorage.getItem('adminProducts') || sessionStorage.getItem('cvPrototypeProducts') || sessionStorage.getItem('adminProducts');
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch(e){ return null; }
}
async function loadProductsData(){
  if(Array.isArray(window.CV_PREVIEW_PRODUCTS)) return window.CV_PREVIEW_PRODUCTS;

  // Live Railway/GitHub mode: the real Shop page must read from the backend database.
  // This makes products saved from Super Admin appear on /shop.html automatically.
  const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  if(isHttp){
    try{
      const res = await fetch('/api/products', {cache:'no-store'});
      if(res.ok){
        const rows = await res.json();
        if(Array.isArray(rows) && rows.length){
          return rows.map(apiProductToFrontend);
        }
      }
    }catch(e){
      console.warn('Backend products unavailable, using prototype/static products.', e);
    }
  }

  // Local/static prototype fallback.
  const localProducts = prototypeProductsReadFront();
  return localProducts || await getJSON('products.json', []);
}

function getSeoPageKey(){
  const file = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if(file === 'index.html' || file === '') return 'home';
  if(file === 'shop.html') return new URLSearchParams(location.search).get('product') ? 'product' : 'shop';
  if(file === 'contact.html') return 'contact';
  if(file === 'track-order.html') return 'track';
  if(file === 'account.html' || file === 'auth.html') return 'account';
  return 'product';
}
function currentOrigin(){ return window.location.origin || ''; }
function currentCanonical(){
  const u = new URL(window.location.href);
  ['lang'].forEach(k => u.searchParams.delete(k));
  return u.origin + u.pathname + (u.search ? u.search : '');
}
function setMetaTag(name, content){
  if(!content) return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if(!tag){ tag = document.createElement('meta'); tag.setAttribute('name', name); document.head.appendChild(tag); }
  tag.setAttribute('content', content);
}
function setPropertyTag(property, content){
  if(!content) return;
  let tag = document.querySelector(`meta[property="${property}"]`);
  if(!tag){ tag = document.createElement('meta'); tag.setAttribute('property', property); document.head.appendChild(tag); }
  tag.setAttribute('content', content);
}
function setLinkTag(rel, href, attrs={}){
  if(!href) return;
  let selector = `link[rel="${rel}"]`;
  if(attrs.hreflang) selector += `[hreflang="${attrs.hreflang}"]`;
  let tag = document.querySelector(selector);
  if(!tag){ tag = document.createElement('link'); tag.setAttribute('rel', rel); document.head.appendChild(tag); }
  Object.entries(attrs).forEach(([k,v]) => tag.setAttribute(k,v));
  tag.setAttribute('href', href);
}
function seoValue(pageSeo, base){
  return pageSeo[base + '_' + lang] || pageSeo[base] || pageSeo[base + '_en'] || '';
}
function getDefaultSeoPages(){
  return {
    home:{title_en:'Custom Furniture Saudi Arabia | Crafted Visual',title_ar:'أثاث مخصص في السعودية | كرافتد فيجوال',description_en:'Shop premium custom furniture in Saudi Arabia including sofas, beds, chairs, luxury fabrics, custom sizes, and Riyadh delivery by Crafted Visual.',description_ar:'تسوق أثاثاً مخصصاً وفاخراً في السعودية يشمل الكنب والأسرة والكراسي والأقمشة الفاخرة والمقاسات حسب الطلب من كرافتد فيجوال.',keywords:['custom furniture Saudi Arabia','premium furniture Riyadh','sofas Riyadh','beds Saudi Arabia','luxury furniture']},
    shop:{title_en:'Shop Custom Sofas, Beds & Chairs | Crafted Visual',title_ar:'تسوق كنب وأسرة وكراسي مخصصة | كرافتد فيجوال',description_en:'Browse Crafted Visual furniture collections with custom sizes, fabrics, colors, prices, and delivery options across Saudi Arabia.',description_ar:'تصفح مجموعات أثاث كرافتد فيجوال مع المقاسات والأقمشة والألوان والأسعار وخيارات التوصيل داخل السعودية.',keywords:['shop furniture Saudi Arabia','buy sofa Riyadh','custom beds Riyadh','custom chairs Saudi']},
    contact:{title_en:'Contact Crafted Visual Furniture | Riyadh Saudi Arabia',title_ar:'تواصل مع كرافتد فيجوال للأثاث | الرياض السعودية',description_en:'Contact Crafted Visual for custom furniture orders, WhatsApp inquiries, delivery questions, and furniture support in Saudi Arabia.',description_ar:'تواصل مع كرافتد فيجوال لطلبات الأثاث المخصص، الاستفسارات عبر واتساب، التوصيل، وخدمة العملاء في السعودية.',keywords:['contact furniture Riyadh','furniture WhatsApp Saudi Arabia']},
    account:{title_en:'My Account | Crafted Visual Furniture',title_ar:'حسابي | كرافتد فيجوال للأثاث',description_en:'Sign in to your Crafted Visual account to track orders and manage furniture purchases.',description_ar:'سجل الدخول إلى حسابك في كرافتد فيجوال لتتبع الطلبات وإدارة بيانات التوصيل والمشتريات.',keywords:['furniture account','track furniture order']},
    track:{title_en:'Track Your Order | Crafted Visual',title_ar:'تتبع طلبك | كرافتد فيجوال',description_en:'Track your Crafted Visual furniture order status using your order number.',description_ar:'تتبع حالة طلب الأثاث الخاص بك من كرافتد فيجوال باستخدام رقم الطلب.',keywords:['track furniture order','Crafted Visual order']},
    product:{title_en:'Custom Furniture Product | Crafted Visual',title_ar:'منتج أثاث مخصص | كرافتد فيجوال',description_en:'View product details, custom sizes, fabrics, colors, prices, and ordering options from Crafted Visual.',description_ar:'شاهد تفاصيل المنتج والمقاسات والأقمشة والألوان والأسعار وخيارات الطلب من كرافتد فيجوال.',keywords:['custom furniture product','custom size sofa','custom fabric furniture']}
  };
}
function addJsonLd(id, data){
  let el = document.getElementById(id);
  if(!el){ el = document.createElement('script'); el.type = 'application/ld+json'; el.id = id; document.head.appendChild(el); }
  el.textContent = JSON.stringify(data);
}
function productForSeo(){
  const qs = new URLSearchParams(location.search);
  const wanted = qs.get('product') || qs.get('id');
  if(wanted && Array.isArray(products)) return products.find(p => String(p.id) === String(wanted) || String(p._dbId) === String(wanted));
  if(currentProduct) return currentProduct;
  return null;
}
function applySeoTags(){
  const seoPages = Object.assign(getDefaultSeoPages(), settings.seo_pages || {});
  const key = getSeoPageKey();
  let pageSeo = seoPages[key] || seoPages.home || {};
  const p = key === 'product' ? productForSeo() : null;
  let title = seoValue(pageSeo, 'title');
  let description = seoValue(pageSeo, 'description');
  let image = settings.seo_default_image || settings.hero_image || (Array.isArray(settings.hero_banners) && settings.hero_banners[0]) || '';
  if(p){
    const pname = lang === 'ar' ? (p.name_ar || p.name) : (p.name || p.name_ar);
    const pdesc = lang === 'ar' ? (p.description_ar || p.description) : (p.description || p.description_ar);
    title = `${pname} | ${lang === 'ar' ? 'كرافتد فيجوال' : 'Crafted Visual'}`;
    description = pdesc || description;
    image = (p.images && p.images[0]) || p.image || image;
  }
  if(title) document.title = title;
  setMetaTag('description', description);
  setMetaTag('keywords', Array.isArray(pageSeo.keywords) ? pageSeo.keywords.join(', ') : pageSeo.keywords);
  setMetaTag('robots', 'index, follow, max-image-preview:large');
  setMetaTag('author', 'Crafted Visual');
  setMetaTag('language', lang === 'ar' ? 'Arabic' : 'English');
  setPropertyTag('og:title', title || document.title);
  setPropertyTag('og:description', description);
  setPropertyTag('og:type', p ? 'product' : 'website');
  setPropertyTag('og:url', currentCanonical());
  if(image) setPropertyTag('og:image', image.startsWith('http') ? image : currentOrigin() + '/' + image.replace(/^\//,''));
  setPropertyTag('og:locale', lang === 'ar' ? 'ar_SA' : 'en_US');
  setMetaTag('twitter:card', 'summary_large_image');
  setMetaTag('twitter:title', title || document.title);
  setMetaTag('twitter:description', description);
  setLinkTag('canonical', currentCanonical());
  setLinkTag('alternate', currentCanonical(), {hreflang: lang === 'ar' ? 'ar-SA' : 'en-SA'});
  const brandName = lang === 'ar' ? (settings.brand_ar || 'كرافتد فيجوال') : (settings.brand_en || 'Crafted Visual');
  addJsonLd('cv-store-schema', {
    '@context':'https://schema.org', '@type':'FurnitureStore', name:brandName, url:currentOrigin(),
    image:image ? (image.startsWith('http') ? image : currentOrigin() + '/' + image.replace(/^\//,'')) : undefined,
    telephone:settings.footer_phone || settings.whatsapp_number || '', email:settings.footer_email || settings.customer_care_email || '',
    address:{'@type':'PostalAddress', addressLocality:'Riyadh', addressCountry:'SA'},
    sameAs:[settings.instagram_url,settings.tiktok_url,settings.facebook_url,settings.linkedin_url].filter(Boolean)
  });
  if(p){
    addJsonLd('cv-product-schema', {
      '@context':'https://schema.org','@type':'Product', name: lang==='ar' ? (p.name_ar||p.name) : (p.name||p.name_ar),
      description, image: image ? [image.startsWith('http') ? image : currentOrigin() + '/' + image.replace(/^\//,'')] : [],
      brand:{'@type':'Brand', name:brandName}, category:p.category,
      offers:{'@type':'Offer', priceCurrency:'SAR', price:String(Math.round(Number(p.price||0))), availability:'https://schema.org/InStock', url:currentCanonical()}
    });
  }
}

async function init(){
  settings = await getJSON("settings.json", {});
  applySeoTags();
  menu = normalizeMenuRoutes(await getJSON("menu.json", DEFAULT_MENU));
  if(!menu || !menu.length) menu = DEFAULT_MENU;
  cities = await getJSON("cities.json", ["Riyadh","Jeddah","Dammam","Khobar"]);
  categories = await getJSON("categories.json", DEFAULT_CATEGORIES);
  if(!categories || !categories.length) categories = DEFAULT_CATEGORIES;
  cleanupBlockedCategories();
  products = await loadProductsData();
  products = products.map(normalizeProduct);
  applySeoTags();
  applyLang();
  renderMenu();
  renderDynamicCategories();
  renderHomeQuickMenu();
  renderCMS();
  renderCitySelects();
  renderSocialLinks();
  renderFooterDetails();
  renderAboutBoxes();
  applySortAndFilter();
  cart = cart.map(lightweightCartItem);
  saveCartSafe();
  updateCartCount();
  updateAuthUI();
}
init();



function normalizeSizeOptions(p){
  if(Array.isArray(p.sizeOptions) && p.sizeOptions.length){
    return p.sizeOptions.map(s => ({label:s.label || String(s), price:Number(s.price || p.price || 0)}));
  }
  const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ["Custom Size"];
  return sizes.map(s => ({label:s, price:Number(p.price || 0)}));
}

function normalizeFabricOptions(p){
  if(Array.isArray(p.fabricOptions) && p.fabricOptions.length){
    return p.fabricOptions.map(f => ({
      label: f.label || String(f),
      description: f.description || "",
      sizePrices: f.sizePrices || {}
    }));
  }
  const fabrics = Array.isArray(p.fabrics) && p.fabrics.length ? p.fabrics : ["Standard Fabric"];
  const sizeOptions = normalizeSizeOptions(p);
  return fabrics.map(f => {
    const sizePrices = {};
    sizeOptions.forEach(s => sizePrices[s.label] = Number(s.price || p.price || 0));
    return {label:f, description:"", sizePrices};
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
        images: Array.isArray(value.images) ? value.images.filter(Boolean) : [value.image].filter(Boolean)
      };
    }
  });
  p.colors = newColors;
  p.discountPercent = Number(p.discountPercent || 0);
  p.sizeOptions = normalizeSizeOptions(p);
  p.fabricOptions = normalizeFabricOptions(p);
  p.fabrics = p.fabricOptions.map(f => f.label);
  p.sizes = p.sizeOptions.map(s => s.label);
  return p;
}

function guessHex(name){
  const n = (name || "").toLowerCase();
  if(n.includes("green") || n.includes("olive")) return "#243a26";
  if(n.includes("beige") || n.includes("sand")) return "#d8c4a6";
  if(n.includes("ivory") || n.includes("cream") || n.includes("pearl")) return "#f4ead8";
  if(n.includes("grey") || n.includes("gray")) return "#8f8f8a";
  if(n.includes("charcoal") || n.includes("black")) return "#2d2d2d";
  if(n.includes("mustard") || n.includes("yellow")) return "#d4a51f";
  if(n.includes("taupe")) return "#9a8574";
  if(n.includes("brown") || n.includes("mocha") || n.includes("camel")) return "#8a5f3d";
  return "#cccccc";
}

function variantCost(p, sizeOpt=null, fabricOpt=null){
  const sizeLabel = sizeOpt?.label || p.sizeOptions?.[0]?.label || "Custom Size";
  if(fabricOpt && fabricOpt.costPrices && fabricOpt.costPrices[sizeLabel] !== undefined){
    return Number(fabricOpt.costPrices[sizeLabel] || 0);
  }
  return Number(p.costPrice || 0);
}

function variantPriceBeforeVat(p, sizeOpt=null, fabricOpt=null){
  const sizeLabel = sizeOpt?.label || p.sizeOptions?.[0]?.label || "Custom Size";
  if(fabricOpt && fabricOpt.sizePrices && fabricOpt.sizePrices[sizeLabel] !== undefined){
    return Number(fabricOpt.sizePrices[sizeLabel] || 0);
  }
  if(sizeOpt && sizeOpt.price !== undefined) return Number(sizeOpt.price || 0);
  return Number(p.price || 0);
}

function priceBeforeVat(p, sizeOpt=null, fabricOpt=null){
  return variantPriceBeforeVat(p, sizeOpt, fabricOpt);
}

function vatRate(p){
  return Number(p.vatRate || settings.vat_rate || 15);
}

function vatAmount(p, sizeOpt=null, fabricOpt=null){
  return priceBeforeVat(p, sizeOpt, fabricOpt) * vatRate(p) / 100;
}

function priceIncludingVat(p, sizeOpt=null, fabricOpt=null){
  return priceBeforeVat(p, sizeOpt, fabricOpt) + vatAmount(p, sizeOpt, fabricOpt);
}

function finalPrice(p, sizeOpt=null, fabricOpt=null){
  const discount = Number(p.discountPercent || 0);
  return Math.round(priceIncludingVat(p, sizeOpt, fabricOpt) * (1 - discount / 100));
}

function priceHTML(p, sizeOpt=null, fabricOpt=null){
  const before = priceBeforeVat(p, sizeOpt, fabricOpt);
  const vat = vatAmount(p, sizeOpt, fabricOpt);
  const incl = priceIncludingVat(p, sizeOpt, fabricOpt);
  const fp = finalPrice(p, sizeOpt, fabricOpt);
  const discount = Number(p.discountPercent || 0);
  let html = `<div class="price-detail">
    <div>Price before VAT: <strong>SAR ${before.toLocaleString()}</strong></div>
    <div>VAT (${vatRate(p)}%): <strong>SAR ${Math.round(vat).toLocaleString()}</strong></div>
    <div>Total incl. VAT: <strong>SAR ${Math.round(incl).toLocaleString()}</strong></div>`;
  if(discount > 0){
    html += `<div>After discount: <strong class="discount-price">SAR ${fp.toLocaleString()}</strong> <span class="discount-badge">${discount}%</span></div>`;
  }
  html += `</div>`;
  return html;
}

function applyLang(){
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  const langBtn = document.querySelector(".lang-btn");
  if(langBtn) langBtn.textContent = lang === "ar" ? "English" : "عربي";
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const key = el.dataset.i18n;
    if(T[lang][key]) el.textContent = T[lang][key];
  });
  document.querySelectorAll("[data-placeholder-en]").forEach(el=>{
    el.placeholder = lang === "ar" ? el.dataset.placeholderAr : el.dataset.placeholderEn;
  });
}

function toggleLang(){
  lang = lang === "en" ? "ar" : "en";
  localStorage.setItem("lang", lang);
  applyLang();
  renderMenu();
  renderDynamicCategories();
  renderHomeQuickMenu();
  renderCMS();
  applySortAndFilter();
  updateAuthUI();
}

function renderMenu(){
  const nav = document.getElementById("mainMenu");
  if(!nav) return;
  const safeMenu = (menu && menu.length ? menu : DEFAULT_MENU).filter(i => {
    const label = (i.label_en || "").toLowerCase();
    const url = (i.url || "").toLowerCase();
    return i.visible !== false && label !== "contact" && url !== "#contact" && url !== "index.html#contact";
  });
  nav.innerHTML = safeMenu.map(i=>{
    const label = lang === "ar" ? (i.label_ar || i.label_en) : i.label_en;
    return `<a href="${i.url}">${label}</a>`;
  }).join("");
}

function renderHomeQuickMenu(){
  const quick = document.getElementById("homeCategoryLinks");
  if(!quick) return;
  const visible = allVisibleCategories();
  quick.innerHTML = visible.map(c=>{
    const label = lang === "ar" ? ensureArabic(c.label_en, c.label_ar) : c.label_en;
    return `<a class="category-card-link" href="shop.html?category=${encodeURIComponent(c.label_en)}">${label}</a>`;
  }).join("");
}


function renderCMS(){
  const brand = lang === "ar" ? settings.brand_ar : settings.brand_en;
  const heroEyebrow = lang === "ar" ? settings.hero_eyebrow_ar : settings.hero_eyebrow_en;
  const heroTitle = lang === "ar" ? settings.hero_title_ar : settings.hero_title_en;
  const heroText = lang === "ar" ? settings.hero_text_ar : settings.hero_text_en;
  const introTitle = lang === "ar" ? settings.intro_title_ar : settings.intro_title_en;
  const introText = lang === "ar" ? settings.intro_text_ar : settings.intro_text_en;
  const footerText = lang === "ar" ? settings.footer_text_ar : settings.footer_text_en;
  setText("brandText", brand || "Crafted Visual");
  setText("footerBrand", brand || "Crafted Visual");
  setText("heroEyebrow", heroEyebrow || "");
  setText("heroTitle", heroTitle || "");
  setText("heroText", heroText || "");
  setText("introTitle", introTitle || "");
  setText("introText", introText || "");
  setText("footerText", footerText || "");
  setText("aboutTitle", lang === "ar" ? settings.about_title_ar : settings.about_title_en);
  setText("aboutText", lang === "ar" ? settings.about_text_ar : settings.about_text_en);
  const aboutImg = document.getElementById("aboutImage");
  if(aboutImg && settings.about_image) aboutImg.src = settings.about_image;
  setupHeroBannerSlider();
  const footerWhatsApp = document.getElementById("footerWhatsApp");
  if(footerWhatsApp) footerWhatsApp.href = "https://wa.me/" + (settings.whatsapp_number || DEFAULT_WHATSAPP);
}

function getHeroBanners(){
  const clean = src => src && !String(src).startsWith('file://') && !String(src).startsWith('/Users/') && !String(src).includes('C:\\');
  const banners = Array.isArray(settings.hero_banners) ? settings.hero_banners.filter(clean) : [];
  const legacy = [settings.hero_banner_1, settings.hero_banner_2, settings.hero_banner_3, settings.hero_banner_4, settings.hero_banner_5, settings.hero_image].filter(clean);
  return banners.length ? banners : legacy;
}

function setHeroBackground(hero, src){
  if(!hero || !src) return;
  hero.style.background = `linear-gradient(90deg,rgba(24,61,50,.88),rgba(24,61,50,.25)), url('${src}') center/cover`;
}

function setupHeroBannerSlider(){
  const hero = document.querySelector(".hero");
  if(!hero) return;
  const banners = getHeroBanners();
  if(window.CV_HERO_BANNER_TIMER){
    clearInterval(window.CV_HERO_BANNER_TIMER);
    window.CV_HERO_BANNER_TIMER = null;
  }
  if(!banners.length) return;
  let index = 0;
  setHeroBackground(hero, banners[index]);
  if(banners.length > 1){
    window.CV_HERO_BANNER_TIMER = setInterval(() => {
      index = (index + 1) % banners.length;
      setHeroBackground(hero, banners[index]);
    }, 5000);
  }
}

function setText(id, text){ const el = document.getElementById(id); if(el) el.textContent = text; }

function renderFooterDetails(){
  const box = document.getElementById("footerDetails");
  if(!box) return;
  const extra = lang === "ar" ? settings.footer_extra_info_ar : settings.footer_extra_info_en;
  const items = [
    settings.footer_cr_number ? `${lang === "ar" ? "السجل التجاري" : "CR Number"}: ${settings.footer_cr_number}` : "",
    settings.footer_vat_number ? `${lang === "ar" ? "الرقم الضريبي" : "VAT Number"}: ${settings.footer_vat_number}` : "",
    settings.footer_address ? `${lang === "ar" ? "العنوان" : "Address"}: ${settings.footer_address}` : "",
    settings.footer_email ? `${lang === "ar" ? "البريد الإلكتروني" : "Email"}: ${settings.footer_email}` : "",
    settings.footer_phone ? `${lang === "ar" ? "الهاتف" : "Phone"}: ${settings.footer_phone}` : "",
    extra || ""
  ].filter(Boolean);
  box.innerHTML = items.map(i=>`<p>${i}</p>`).join("");
}

function renderAboutBoxes(){
  const boxes = document.querySelectorAll(".about-points > div");
  if(!boxes || boxes.length < 3) return;
  const data = [
    {title_en:settings.about_box1_title_en, title_ar:settings.about_box1_title_ar, text_en:settings.about_box1_text_en, text_ar:settings.about_box1_text_ar},
    {title_en:settings.about_box2_title_en, title_ar:settings.about_box2_title_ar, text_en:settings.about_box2_text_en, text_ar:settings.about_box2_text_ar},
    {title_en:settings.about_box3_title_en, title_ar:settings.about_box3_title_ar, text_en:settings.about_box3_text_en, text_ar:settings.about_box3_text_ar}
  ];
  boxes.forEach((box,i)=>{
    const d = data[i];
    const title = lang === "ar" ? ensureArabic(d.title_en, d.title_ar) : d.title_en;
    const text = lang === "ar" ? ensureArabic(d.text_en, d.text_ar) : d.text_en;
    box.innerHTML = `<strong>${title || ""}</strong><br>${text || ""}`;
  });
}

function renderSocialLinks(){
  const map = {
    instagramLink: "instagram_url",
    tiktokLink: "tiktok_url",
    facebookLink: "facebook_url",
    xLink: "x_url",
    linkedinLink: "linkedin_url",
    youtubeLink: "youtube_url",
    snapchatLink: "snapchat_url"
  };
  Object.entries(map).forEach(([id,key])=>{
    const el = document.getElementById(id);
    if(el && settings[key]) el.href = settings[key];
  });
}

function trackEvent(name, params={}){
  try{
    if(window.gtag) window.gtag("event", name, params);
    if(window.fbq) window.fbq("trackCustom", name, params);
  }catch(e){}
}

function saveCRMActivity(type, payload){
  const activities = JSON.parse(localStorage.getItem("crmActivities") || "[]");
  activities.push({id:"ACT-" + Date.now(), type, payload, date:new Date().toISOString()});
  localStorage.setItem("crmActivities", JSON.stringify(activities));
}

function renderCitySelects(){
  const select = document.getElementById("customCity");
  if(select) select.innerHTML = `<option value="">${lang === "ar" ? "اختر المدينة" : "Select City"}</option>` + cities.map(c=>`<option>${c}</option>`).join("");
}

function displayName(p){
  return lang === "ar" ? ensureArabic(p.name, p.name_ar) : (p.name || "");
}

function productRating(productId){
  const list = ratings[productId] || [];
  if(!list.length) return {avg:0,count:0};
  return {avg:list.reduce((a,b)=>a+b,0)/list.length, count:list.length};
}
function starDisplay(productId){
  const r = productRating(productId);
  const rounded = Math.round(r.avg);
  return `<div class="rating-line">${"★".repeat(rounded)}${"☆".repeat(5-rounded)} <small>${r.count ? r.avg.toFixed(1)+" ("+r.count+")" : "No ratings"}</small></div>`;
}

function renderProducts(list){
  const grid = document.getElementById("productGrid");
  if(!grid) return;
  if(!list.length){
    grid.innerHTML = `<div class="empty-products"><h3>No products showing yet</h3><p>Prototype note: Shop reads products saved in Super Admin only when both pages share the same browser storage. For guaranteed preview, use Open Shop Preview from admin.html.</p></div>`;
    return;
  }
  grid.innerHTML = list.map(p=>{
    const img = firstImage(p);
    return `
      <div class="card">
        <img src="${img}" alt="${displayName(p)}">
        <div class="card-body">
          <h3>${displayName(p)}</h3>
          <p>${displayCategory(p)}</p>
          ${starDisplay(p.id)}
          ${priceHTML(p)}
          <div class="mini-swatches">
            ${Object.entries(p.colors || {}).map(([c,v])=>`<span title="${c}" style="background:${v.hex || '#ccc'}"></span>`).join("")}
          </div>
          <br>
          <button class="btn primary" onclick="openProduct('${p.id}')">${lang === "ar" ? "عرض المنتج" : "View Product"}</button>
        </div>
      </div>
    `;
  }).join("");
}

function cleanupBlockedCategories(){
  try{
    const raw = localStorage.getItem("cms_categories") || sessionStorage.getItem("cms_categories");
    if(raw){
      const cleaned = JSON.parse(raw).filter(c=>!isBlockedCategory(c.label_en));
      localStorage.setItem("cms_categories", JSON.stringify(cleaned));
      sessionStorage.setItem("cms_categories", JSON.stringify(cleaned));
      categories = cleaned;
    }
  }catch(e){}
}

function isBlockedCategory(name){
  const n = String(name || "").trim().toLowerCase();
  return ["luxury","luxury line","luxuryline"].includes(n);
}

function allVisibleCategories(){
  const map = new Map();
  (categories && categories.length ? categories : DEFAULT_CATEGORIES)
    .filter(c=>c.visible !== false && !isBlockedCategory(c.label_en))
    .forEach(c=>map.set(c.label_en, c));
  (products || []).forEach(p=>{
    if(p.category && !isBlockedCategory(p.category) && !map.has(p.category)){
      map.set(p.category, {label_en:p.category, label_ar:p.category_ar || p.category, visible:true});
    }
  });
  return [...map.values()];
}

function renderDynamicCategories(){
  const visible = allVisibleCategories();
  const btns = document.getElementById("categoryButtons");
  if(btns){
    btns.innerHTML = visible.map(c=>{
      const label = lang === "ar" ? ensureArabic(c.label_en, c.label_ar) : c.label_en;
      return `<button type="button" data-category-button="${c.label_en}" onclick="filterCategory('${String(c.label_en).replace(/'/g,"\'")}')">${label}</button>`;
    }).join("") + `<button type="button" data-category-button="All" onclick="filterCategory('All')">${T[lang].viewAll || "View All"}</button>`;
  }
  const filter = document.getElementById("categoryFilter");
  if(filter){
    filter.innerHTML = `<option value="All">${lang === "ar" ? "كل الفئات" : "All Categories"}</option>` + visible.map(c=>`<option value="${c.label_en}">${lang === "ar" ? ensureArabic(c.label_en, c.label_ar) : c.label_en}</option>`).join("");
    filter.value = activeCategory || "All";
  }
  const custom = document.getElementById("customCategorySelect");
  if(custom){
    custom.innerHTML = `<option value="">${lang === "ar" ? "فئة المنتج" : "Product Category"}</option>` + visible.map(c=>`<option value="${c.label_en}">${lang === "ar" ? ensureArabic(c.label_en, c.label_ar) : c.label_en}</option>`).join("");
  }
  document.querySelectorAll("[data-category-button]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.categoryButton === (activeCategory || "All"));
  });
}

function filterCategory(category){
  if(!document.getElementById("productGrid")){
    const target = category && category !== "All" ? "shop.html?category=" + encodeURIComponent(category) : "shop.html";
    window.location.href = target;
    return;
  }
  activeCategory = category || "All";
  const catFilter = document.getElementById("categoryFilter");
  if(catFilter){
    const exists = [...catFilter.options].some(o => o.value === activeCategory);
    if(exists) catFilter.value = activeCategory;
  }
  document.querySelectorAll("[data-category-button]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.categoryButton === activeCategory);
  });
  applySortAndFilter();
  const shop = document.getElementById("shop");
  if(shop) shop.scrollIntoView({behavior:"smooth", block:"start"});
}

function applySortAndFilter(){
  let list = [...products];
  const catFilter = document.getElementById("categoryFilter");
  const sortSelect = document.getElementById("sortSelect");
  const selectedCategory = catFilter && catFilter.value ? catFilter.value : (window.CV_CATEGORY_FILTER || activeCategory);
  activeCategory = selectedCategory || "All";

  if(activeCategory !== "All"){
    list = list.filter(p => p.category === activeCategory);
  }

  const sort = sortSelect ? sortSelect.value : "featured";
  if(sort === "priceHigh"){
    list.sort((a,b)=>finalPrice(b)-finalPrice(a));
  }else if(sort === "priceLow"){
    list.sort((a,b)=>finalPrice(a)-finalPrice(b));
  }else if(sort === "discount"){
    list.sort((a,b)=>Number(b.discountPercent||0)-Number(a.discountPercent||0));
  }else if(sort === "rating"){
    list.sort((a,b)=>productRating(b.id).avg-productRating(a.id).avg);
  }else if(sort === "nameAZ"){
    list.sort((a,b)=>displayName(a).localeCompare(displayName(b)));
  }

  const title = document.getElementById("shopPageTitle");
  if(title && activeCategory && activeCategory !== "All") title.textContent = activeCategory;
  renderProducts(list);
}

function openProduct(id){
  currentProduct = normalizeProduct(products.find(p=>p.id === id));
  selectedColor = Object.keys(currentProduct.colors || {})[0] || "";
  selectedImage = getColorImages(selectedColor)[0] || (currentProduct.gallery || [])[0] || "";
  document.getElementById("modalName").textContent = displayName(currentProduct);
  document.getElementById("modalDesc").textContent = displayDesc(currentProduct) || "";
  selectedSizeOption = currentProduct.sizeOptions[0] || {label:"Custom Size", price:Number(currentProduct.price||0)};
  selectedFabricOption = currentProduct.fabricOptions[0] || {label:"Standard Fabric", sizePrices:{}};
  document.getElementById("modalPrice").innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
  updateFabricDescription();
  updateFabricDescription();
  updateFabricDescription();
  document.getElementById("fabricSelect").innerHTML = (currentProduct.fabricOptions || []).map((f,idx)=>`<option value="${idx}">${f.label}</option>`).join("");
  document.getElementById("fabricSelect").onchange = updateSelectedFabric;
  document.getElementById("sizeSelect").innerHTML = (currentProduct.sizeOptions || []).map((s,idx)=>`<option value="${idx}">${s.label} - SAR ${Number(s.price).toLocaleString()} before VAT</option>`).join("");
  document.getElementById("sizeSelect").onchange = updateSelectedSize;
  document.getElementById("modalRating").innerHTML = `<strong>${T[lang].rating}:</strong> ${starDisplay(currentProduct.id)}<div class="rate-stars">${[1,2,3,4,5].map(n=>`<button onclick="rateCurrent(${n})">★</button>`).join("")}</div><small>${T[lang].rateItem}</small>`;
  renderColors();
  renderThumbs();
  updateModalImage();
  document.getElementById("productModal").classList.remove("hidden");
}
function getColorImages(color){ return currentProduct?.colors?.[color]?.images || []; }
function renderColors(){
  document.getElementById("colorOptions").innerHTML = Object.entries(currentProduct.colors || {}).map(([c,v])=>`
    <button class="color-chip ${c===selectedColor?'active':''}" onclick="selectColor('${c.replace(/'/g,"\\'")}')">
      <span class="color-dot" style="background:${v.hex || '#ccc'}"></span>
      <span>${c}</span>${v.code ? `<small>${v.code}</small>` : ""}
    </button>`).join("");
}
function renderThumbs(){
  const imgs = getColorImages(selectedColor);
  document.getElementById("thumbs").innerHTML = imgs.map(img=>`<img src="${img}" onclick="selectImage('${img}')" class="${img===selectedImage?'active':''}">`).join("");
}
function selectImage(img){ selectedImage = img; updateModalImage(); renderThumbs(); }
function selectColor(color){ selectedColor = color; selectedImage = getColorImages(color)[0] || ""; renderColors(); renderThumbs(); updateModalImage(); }
function updateModalImage(){ document.getElementById("modalImage").src = selectedImage; }
function closeModal(){ 
  document.getElementById("productModal").classList.add("hidden"); 
  const box = document.getElementById("addedBox");
  if(box) box.remove();
}

function rateCurrent(stars){
  if(!currentProduct) return;
  ratings[currentProduct.id] = ratings[currentProduct.id] || [];
  ratings[currentProduct.id].push(Number(stars));
  localStorage.setItem("ratings", JSON.stringify(ratings));
  document.getElementById("modalRating").innerHTML = `<strong>${T[lang].rating}:</strong> ${starDisplay(currentProduct.id)}<div class="rate-stars">${[1,2,3,4,5].map(n=>`<button onclick="rateCurrent(${n})">★</button>`).join("")}</div><small>${T[lang].rateItem}</small>`;
  renderProducts(products);
}

function updateFabricDescription(){
  const el = document.getElementById("fabricDescription");
  if(el) el.textContent = selectedFabricOption?.description || "";
}

function updateSelectedFabric(){
  const idx = Number(document.getElementById("fabricSelect").value || 0);
  selectedFabricOption = currentProduct.fabricOptions[idx] || currentProduct.fabricOptions[0];
  document.getElementById("modalPrice").innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
  updateFabricDescription();
  updateFabricDescription();
}

function updateSelectedSize(){
  const idx = Number(document.getElementById("sizeSelect").value || 0);
  selectedSizeOption = currentProduct.sizeOptions[idx] || currentProduct.sizeOptions[0];
  document.getElementById("modalPrice").innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
  updateFabricDescription();
  updateFabricDescription();
}

function addCurrentToCart(){
  if(!currentProduct){
    alert("Please select a product.");
    return;
  }
  const colorObj = currentProduct.colors[selectedColor] || {};
  const sizeLabel = selectedSizeOption ? selectedSizeOption.label : (document.getElementById("sizeSelect")?.selectedOptions?.[0]?.textContent || "");
  const fabricLabel = selectedFabricOption ? selectedFabricOption.label : (document.getElementById("fabricSelect")?.selectedOptions?.[0]?.textContent || "");
  const item = lightweightCartItem({
    id: currentProduct.id,
    name: displayName(currentProduct),
    price: finalPrice(currentProduct, selectedSizeOption, selectedFabricOption),
    originalPrice: priceBeforeVat(currentProduct, selectedSizeOption, selectedFabricOption),
    priceBeforeVat: priceBeforeVat(currentProduct, selectedSizeOption, selectedFabricOption),
    costPrice: variantCost(currentProduct, selectedSizeOption, selectedFabricOption),
    discountPercent: Number(currentProduct.discountPercent || 0),
    vatRate: vatRate(currentProduct),
    color: selectedColor,
    colorCode: colorObj.code || "",
    fabric: fabricLabel,
    size: sizeLabel,
    qty: 1,
    });

  cart.push(item);
  if(!saveCartSafe()){
    cart.pop();
    return;
  }

  trackEvent("add_to_cart", {item_id:item.id, item_name:item.name, value:item.price});
  saveCRMActivity("Add to Cart", {id:item.id, name:item.name, price:item.price, color:item.color, fabric:item.fabric, size:item.size});
  updateCartCount();
  closeModal();
  showToast(`${item.name} added to cart`);
}


function showToast(message){
  let toast = document.getElementById("cvToast");
  if(!toast){
    toast = document.createElement("div");
    toast.id = "cvToast";
    toast.className = "cv-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2600);
}

function showAddedBox(item){
  let box = document.getElementById("addedBox");
  if(!box){
    box = document.createElement("div");
    box.id = "addedBox";
    box.className = "added-box";
    document.querySelector(".modal-content").appendChild(box);
  }
  box.innerHTML = `
    <strong>✓ ${lang === "ar" ? "تمت إضافة المنتج إلى السلة" : "Product added to cart"}</strong>
    <p>${item.name}<br>${item.color} | ${item.fabric}<br>SAR ${Number(item.price).toLocaleString()}</p>
    <div class="added-actions">
      <button class="btn secondary" onclick="closeModal()">${lang === "ar" ? "متابعة التسوق" : "Continue Shopping"}</button>
      <button class="btn secondary" onclick="openCart()">${lang === "ar" ? "عرض السلة" : "View Cart"}</button>
      <button class="btn primary" onclick="checkout()">${lang === "ar" ? "الدفع الآن" : "Checkout Now"}</button>
    </div>
  `;
}

function getSelectedThumb(product, colorName){
  const colorImages = product?.colors?.[colorName]?.images || [];
  return colorImages[0] || (product?.gallery || [])[0] || "";
}

function lightweightCartItem(item){
  return {
    id: item.id,
    name: item.name,
    price: Number(item.price || 0),
    originalPrice: Number(item.originalPrice || 0),
    priceBeforeVat: Number(item.priceBeforeVat || item.originalPrice || 0),
    discountPercent: Number(item.discountPercent || 0),
    vatRate: Number(item.vatRate || 15),
    costPrice: Number(item.costPrice || 0),
    color: item.color || "",
    colorCode: item.colorCode || "",
    fabric: item.fabric || "",
    size: item.size || "",
    qty: Number(item.qty || 1)
  };
}


function findProductById(id){
  return products.find(p => p.id === id) || null;
}

function cartItemImage(item){
  const p = findProductById(item.id);
  if(!p) return "";
  const imgs = p.colors?.[item.color]?.images || [];
  return imgs[0] || (p.gallery || [])[0] || "";
}

function saveCartSafe(){
  cart = cart.map(lightweightCartItem);
  try{
    localStorage.setItem("cart", JSON.stringify(cart));
    return true;
  }catch(e){
    console.warn("localStorage cart save failed, using sessionStorage", e);
    try{
      sessionStorage.setItem("cart", JSON.stringify(cart));
      return true;
    }catch(err){
      console.error(err);
      alert("Cart could not be saved because browser storage is full. Please clear old product images from admin storage or use smaller images.");
      return false;
    }
  }
}

function updateCartCount(){ 
  const el = document.getElementById("cartCount"); 
  if(el) el.textContent = cart.reduce((s,i)=>s+Number(i.qty||1),0); 
}
function openCart(){
  const panel = document.getElementById("cartPanel");
  const wrap = document.getElementById("cartItems");
  if(!panel || !wrap) return;
  cart = cart.map(lightweightCartItem);
  wrap.innerHTML = cart.length ? cart.map((i,index)=>{
    const img = cartItemImage(i);
    return `
    <div class="cart-item cart-item-rich">
      ${img ? `<img src="${img}" alt="${i.name}">` : ""}
      <div>
        <strong>${i.name}</strong><br>
        ${T[lang].color}: ${i.color} ${i.colorCode ? "(" + i.colorCode + ")" : ""}<br>
        ${T[lang].fabric}: ${i.fabric}<br>
        ${T[lang].size}: ${i.size}<br>
        ${i.discountPercent ? `<small>${T[lang].discount}: ${i.discountPercent}%</small><br>` : ""}
        SAR ${Number(i.price).toLocaleString()}<br>
        <button type="button" onclick="changeQty(${index},-1)">-</button>
        <span class="qty">${i.qty || 1}</span>
        <button type="button" onclick="changeQty(${index},1)">+</button>
        <button type="button" onclick="removeCart(${index})">${lang === "ar" ? "حذف" : "Remove"}</button>
      </div>
    </div>`;
  }).join("") : `<p>${T[lang].empty}</p>`;
  const total = cart.reduce((sum,i)=>sum + Number(i.price) * Number(i.qty || 1),0);
  const totalEl = document.getElementById("cartTotal");
  if(totalEl) totalEl.textContent = `${T[lang].total}: SAR ${total.toLocaleString()}`;
  panel.classList.remove("hidden");
}
function closeCart(){ 
  const panel = document.getElementById("cartPanel");
  if(panel) panel.classList.add("hidden"); 
}
function changeQty(index,delta){
  if(!cart[index]) return;
  cart[index].qty = Math.max(1, Number(cart[index].qty || 1) + delta);
  saveCartSafe();
  updateCartCount();
  openCart();
}
function removeCart(index){
  cart.splice(index,1);
  saveCartSafe();
  updateCartCount();
  openCart();
}
function removeCart(index){ 
  cart.splice(index,1); 
  saveCartSafe(); 
  updateCartCount(); 
  openCart(); 
}


function checkout(){
  if(!cart.length){
    alert(T[lang].empty);
    return;
  }
  if(!currentUser){
    alert(T[lang].loginRequired);
    window.location.href = "auth.html?return=review.html";
    return;
  }
  saveCartSafe();
  trackEvent("begin_checkout", {items: cart.length});
  saveCRMActivity("Begin Checkout", {items: cart.length});
  window.location.href = "review.html";
}

function whatsappCurrent(){
  const fabric = document.getElementById("fabricSelect").value;
  const size = document.getElementById("sizeSelect").value;
  const code = currentProduct.colors[selectedColor]?.code || "";
  const msg = lang === "ar" 
    ? `مرحباً، أنا مهتم بمنتج ${displayName(currentProduct)}، اللون ${selectedColor} ${code}, القماش ${fabric}، المقاس ${size}. الرجاء إرسال عرض سعر.`
    : `Hello, I am interested in ${displayName(currentProduct)}, color ${selectedColor} ${code}, fabric ${fabric}, size ${size}. Please send quotation.`;
  window.open("https://wa.me/" + (settings.whatsapp_number || DEFAULT_WHATSAPP) + "?text=" + encodeURIComponent(msg), "_blank");
}

function updateAuthUI(){
  const authBtn = document.getElementById("authBtn");
  if(!authBtn) return;
  if(currentUser){ authBtn.textContent = (lang === "ar" ? "خروج: " : "Logout: ") + currentUser.name; authBtn.onclick = logout; }
  else{ authBtn.textContent = T[lang].signIn; authBtn.onclick = () => window.location.href = "auth.html"; }
}
function logout(){ localStorage.removeItem("currentUser"); currentUser = null; updateAuthUI(); }

const customForm = document.getElementById("customForm");
if(customForm){
  customForm.addEventListener("submit", function(e){
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if(!data.name || !data.mobile || !data.notes){
      alert("Please add your name, mobile number, and message.");
      return;
    }
    const delivery = data.city === "Riyadh" ? Number(settings.riyadh_delivery || 0) : Number(settings.outside_riyadh_delivery || 400);
    const msg = `Custom Furniture Request:
Category: ${data.category}
Width: ${data.width} cm
Depth: ${data.depth} cm
Height: ${data.height} cm
Fabric: ${data.fabric}
Color: ${data.color}
Name: ${data.name}
Mobile: ${data.mobile}
City: ${data.city}
Delivery: SAR ${delivery}
Notes: ${data.notes}`;
    window.open("https://wa.me/" + (settings.whatsapp_number || DEFAULT_WHATSAPP) + "?text=" + encodeURIComponent(msg), "_blank");
  });
}


function enhanceMobileNav(){
  const navs = [document.getElementById("mainMenu"), document.querySelector(".admin-top-nav")].filter(Boolean);
  navs.forEach(nav=>{
    nav.addEventListener("wheel", e=>{
      if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
        nav.scrollLeft += e.deltaY;
      }
    }, {passive:true});
  });
}
document.addEventListener("DOMContentLoaded", enhanceMobileNav);

window.addEventListener("storage", (e)=>{
  if(e.key === "cms_categories"){
    try{
      categories = JSON.parse(e.newValue || "[]");
      renderDynamicCategories();
      applySortAndFilter();
    }catch(err){}
  }
});

/* === CV FINAL REAL SHOP + IMAGE/FABRIC + ARABIC PATCH === */
function cvImgUrl(url){
  if(!url) return 'assets/products/product_01.png';
  url = String(url);
  if(url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) return url;
  return url;
}
function firstImage(p){
  p = p || {};
  const colors = p.colors || {};
  for(const k of Object.keys(colors)){
    const set = colors[k] || {};
    if(Array.isArray(set.imageMeta) && set.imageMeta.length && set.imageMeta[0].url) return cvImgUrl(set.imageMeta[0].url);
    if(Array.isArray(set.images) && set.images.length) return cvImgUrl(set.images[0]);
  }
  if(Array.isArray(p.gallery) && p.gallery.length) return cvImgUrl(p.gallery[0]);
  return 'assets/products/product_01.png';
}
function imagesForColorFabric(p, color, fabric){
  const set = p && p.colors && p.colors[color] ? p.colors[color] : null;
  if(!set) return [firstImage(p)];
  const meta = Array.isArray(set.imageMeta) ? set.imageMeta : [];
  if(fabric && meta.length){
    const matching = meta.filter(m => String(m.fabric || '').toLowerCase() === String(fabric || '').toLowerCase()).map(m=>m.url).filter(Boolean);
    if(matching.length) return matching.map(cvImgUrl);
  }
  if(meta.length) return meta.map(m=>m.url).filter(Boolean).map(cvImgUrl);
  if(Array.isArray(set.images) && set.images.length) return set.images.map(cvImgUrl);
  return [firstImage(p)];
}

// Patch normalizer to preserve image metadata and Arabic category.
const cvOriginalNormalizeProduct = typeof normalizeProduct === 'function' ? normalizeProduct : null;
normalizeProduct = function(p){
  p = cvOriginalNormalizeProduct ? cvOriginalNormalizeProduct(p || {}) : (p || {});
  const newColors = {};
  Object.entries(p.colors || {}).forEach(([name, value]) => {
    const v = value || {};
    const images = Array.isArray(v.images) ? v.images.filter(Boolean) : [v.image].filter(Boolean);
    const meta = Array.isArray(v.imageMeta) ? v.imageMeta.filter(m=>m && m.url) : images.map(url => ({url:url, fabric:v.fabric || ''}));
    newColors[name] = { hex:v.hex || guessHex(name), code:v.code || '', fabric:v.fabric || '', images:images, imageMeta:meta };
  });
  p.colors = newColors;
  return p;
};

// Patch API mapper to keep Arabic category and full data colors/images.
apiProductToFrontend = function(row){
  const data = row && row.data ? row.data : {};
  const product = Object.assign({}, data);
  product._dbId = row.id || data._dbId;
  product.id = data.id || row.sku || String(row.id || Date.now());
  product.name = data.name || row.name_en || '';
  product.name_ar = data.name_ar || row.name_ar || '';
  product.category = data.category || row.category_name || 'Beds';
  product.category_ar = data.category_ar || row.category_ar || data.category || row.category_name || '';
  product.description = data.description || row.description_en || '';
  product.description_ar = data.description_ar || row.description_ar || '';
  product.price = Number(data.price || row.base_price || 0);
  product.vatRate = Number(data.vatRate || row.vat_rate || (settings && settings.vat_rate) || 15);
  return normalizeProduct(product);
};

function cvArabicStaticPatch(){
  if(localStorage.getItem('lang') !== 'ar') return;
  const map = new Map([
    ['Browse products by category, fabric, color, size, and price.','تصفح المنتجات حسب الفئة والقماش واللون والمقاس والسعر.'],
    ['Featured','مميز'],['Price: High to Low','السعر: من الأعلى إلى الأقل'],['Price: Low to High','السعر: من الأقل إلى الأعلى'],['Highest Discount','أعلى خصم'],['Best Rating','أفضل تقييم'],['Name A-Z','الاسم أ-ي'],
    ['Contact Crafted Visual','تواصل مع كرافتد فيجوال'],['For furniture inquiries, custom orders, delivery, after-sales support, and project requests.','لاستفسارات الأثاث والطلبات الخاصة والتوصيل وخدمة ما بعد البيع وطلبات المشاريع.'],['Contact Information','معلومات التواصل'],['Send Inquiry','إرسال استفسار'],['Working Hours: Saturday to Thursday, 9:00 AM - 9:00 PM','ساعات العمل: من السبت إلى الخميس، 9:00 صباحاً - 9:00 مساءً'],['Location: Riyadh, Saudi Arabia','الموقع: الرياض، المملكة العربية السعودية'],['Product Inquiry','استفسار عن منتج'],['Send Inquiry','إرسال الاستفسار'],
    ['Track Your Order','تتبع طلبك'],['Enter the full order number exactly as received.','أدخل رقم الطلب كاملاً كما وصل إليك.'],['Track Order','تتبع الطلب'],['No order found.','لم يتم العثور على الطلب.'],
    ['My Account','حسابي'],['Manage your saved delivery details.','إدارة بيانات التوصيل المحفوظة.'],['Full Name','الاسم الكامل'],['Email','البريد الإلكتروني'],['Phone Number','رقم الجوال'],['City','المدينة'],['Delivery Address','عنوان التوصيل'],['Building / Villa / Apartment','المبنى / الفيلا / الشقة'],['Additional Notes','ملاحظات إضافية'],['Save Account','حفظ الحساب'],['Logout','تسجيل الخروج'],['Home','الرئيسية'],['Shop','المتجر'],['My Account','حسابي'],['Contact Us','تواصل معنا']
  ]);
  document.querySelectorAll('h1,h2,h3,p,label,button,a,option,strong,span').forEach(el=>{
    const t = (el.textContent || '').trim();
    if(map.has(t)) el.textContent = map.get(t);
  });
  document.querySelectorAll('input, textarea, select').forEach(el=>{
    const ph = el.getAttribute('placeholder');
    const phMap = {
      'Full Name':'الاسم الكامل','Mobile Number':'رقم الجوال','Email':'البريد الإلكتروني','Message':'الرسالة','Full Order Number e.g. CV-...':'رقم الطلب الكامل مثال CV-...','Phone Number':'رقم الجوال','Full delivery address':'عنوان التوصيل الكامل','Building, villa or apartment':'المبنى أو الفيلا أو الشقة','Preferred delivery notes':'ملاحظات التوصيل المفضلة'
    };
    if(phMap[ph]) el.setAttribute('placeholder', phMap[ph]);
  });
}

const cvOriginalApplyLang = typeof applyLang === 'function' ? applyLang : null;
applyLang = function(){
  if(cvOriginalApplyLang) cvOriginalApplyLang();
  const shopP = document.querySelector('.page-hero p');
  if(shopP && location.pathname.endsWith('shop.html')) shopP.textContent = lang === 'ar' ? 'تصفح المنتجات حسب الفئة والقماش واللون والمقاس والسعر.' : 'Browse products by category, fabric, color, size, and price.';
  const sort = document.getElementById('sortSelect');
  if(sort){
    const labels = lang === 'ar' ? ['مميز','السعر: من الأعلى إلى الأقل','السعر: من الأقل إلى الأعلى','أعلى خصم','أفضل تقييم','الاسم أ-ي'] : ['Featured','Price: High to Low','Price: Low to High','Highest Discount','Best Rating','Name A-Z'];
    [...sort.options].forEach((o,i)=>{ if(labels[i]) o.textContent = labels[i]; });
  }
  cvArabicStaticPatch();
};

// Override final product detail modal to filter images by selected fabric and translate labels.
if(typeof cvFinalUpdateDetail === 'function'){
  const oldCvFinalUpdateDetail = cvFinalUpdateDetail;
  cvFinalUpdateDetail = function(){
    const state = window.cvFinalDetailState;
    if(!state || !state.product){ return oldCvFinalUpdateDetail(); }
    const imgs = imagesForColorFabric(state.product, state.color, state.fabric);
    const main = document.getElementById('cvFinalMainImg');
    if(main) main.src = imgs[0] || firstImage(state.product);
    const thumbs = document.getElementById('cvFinalThumbs');
    if(thumbs){
      thumbs.innerHTML = imgs.map(function(img,idx){ return '<img src="' + img + '" class="' + (idx===0?'active':'') + '" onclick="document.getElementById(\'cvFinalMainImg\').src=this.src;document.querySelectorAll(\'#cvFinalThumbs img\').forEach(function(x){x.classList.remove(\'active\')});this.classList.add(\'active\');">'; }).join('');
    }
    oldCvFinalUpdateDetail();
    const vat = document.getElementById('cvFinalVatNote'); if(vat) vat.textContent = lang === 'ar' ? 'شامل ضريبة القيمة المضافة' : 'VAT included';
  };
}

// Refresh Arabic static text after page load as well.
document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ if(typeof applyLang === 'function') applyLang(); }, 50); });

/* === CV FINAL SHOP MODAL PATCH === */
const cvOriginalApplySortAndFilter = typeof applySortAndFilter === 'function' ? applySortAndFilter : null;
applySortAndFilter = function(){
  if(cvOriginalApplySortAndFilter) cvOriginalApplySortAndFilter();
  const title = document.getElementById('shopPageTitle');
  if(title && activeCategory && activeCategory !== 'All'){
    const cat = (categories || []).find(c => c.label_en === activeCategory || c.label_ar === activeCategory);
    title.textContent = lang === 'ar' ? ensureArabic(activeCategory, cat && cat.label_ar) : activeCategory;
  }
};

getColorImages = function(color){
  if(!currentProduct) return [];
  const fabricLabel = selectedFabricOption && selectedFabricOption.label ? selectedFabricOption.label : '';
  return imagesForColorFabric(currentProduct, color, fabricLabel);
};

const cvOriginalUpdateSelectedFabric = typeof updateSelectedFabric === 'function' ? updateSelectedFabric : null;
updateSelectedFabric = function(){
  const idx = Number(document.getElementById('fabricSelect').value || 0);
  selectedFabricOption = currentProduct.fabricOptions[idx] || currentProduct.fabricOptions[0];
  selectedImage = getColorImages(selectedColor)[0] || firstImage(currentProduct);
  document.getElementById('modalPrice').innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
  updateFabricDescription();
  renderThumbs();
  updateModalImage();
};

selectColor = function(color){
  selectedColor = color;
  selectedImage = getColorImages(color)[0] || firstImage(currentProduct);
  renderColors();
  renderThumbs();
  updateModalImage();
};

// Re-open product with direct Shop modal, not preview, and translate controls.
openProduct = function(id){
  currentProduct = normalizeProduct(products.find(p=>p.id === id));
  if(!currentProduct) return;
  selectedColor = Object.keys(currentProduct.colors || {})[0] || '';
  selectedSizeOption = currentProduct.sizeOptions[0] || {label:'Custom Size', price:Number(currentProduct.price||0)};
  selectedFabricOption = currentProduct.fabricOptions[0] || {label:'Standard Fabric', sizePrices:{}};
  selectedImage = getColorImages(selectedColor)[0] || firstImage(currentProduct);
  document.getElementById('modalName').textContent = displayName(currentProduct);
  document.getElementById('modalDesc').textContent = displayDesc(currentProduct) || '';
  document.getElementById('modalPrice').innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
  document.getElementById('fabricSelect').innerHTML = (currentProduct.fabricOptions || []).map((f,idx)=>`<option value="${idx}">${f.label}</option>`).join('');
  document.getElementById('fabricSelect').onchange = updateSelectedFabric;
  document.getElementById('sizeSelect').innerHTML = (currentProduct.sizeOptions || []).map((s,idx)=>{
    const dim = [s.width, s.depth, s.height].filter(Boolean).join(' × ');
    const label = dim ? `${s.label} - ${dim} cm` : s.label;
    return `<option value="${idx}">${label}</option>`;
  }).join('');
  document.getElementById('sizeSelect').onchange = updateSelectedSize;
  document.getElementById('modalRating').innerHTML = `<strong>${T[lang].rating}:</strong> ${starDisplay(currentProduct.id)}<div class="rate-stars">${[1,2,3,4,5].map(n=>`<button onclick="rateCurrent(${n})">★</button>`).join('')}</div><small>${T[lang].rateItem}</small>`;
  applySeoTags();
  updateFabricDescription();
  renderColors(); renderThumbs(); updateModalImage();
  document.getElementById('productModal').classList.remove('hidden');
};


/* CV RESPONSIVE V2 - embedded menu/bottom nav/sticky CTA */
(function(){
  function ready(fn){ if(document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    var nav = document.querySelector('.nav');
    if(nav && !document.querySelector('.mobile-menu-toggle')){
      var btn = document.createElement('button');
      btn.type='button'; btn.className='mobile-menu-toggle'; btn.setAttribute('aria-label','Open menu'); btn.innerHTML='☰ Menu';
      btn.addEventListener('click', function(){ document.body.classList.toggle('mobile-menu-open'); });
      var brand = nav.querySelector('.brand') || nav.firstElementChild;
      if(brand && brand.nextSibling) nav.insertBefore(btn, brand.nextSibling); else nav.appendChild(btn);
    }
    if(!document.querySelector('.mobile-bottom-nav')){
      var bottom = document.createElement('div');
      bottom.className='mobile-bottom-nav';
      bottom.innerHTML = '<a href="index.html"><span>⌂</span>Home</a><a href="shop.html"><span>▦</span>Shop</a><button type="button" data-open-cart><span>🛒</span>Cart</button><a href="account.html"><span>👤</span>Account</a>';
      document.body.appendChild(bottom);
      var cartButton = bottom.querySelector('[data-open-cart]');
      if(cartButton) cartButton.addEventListener('click', function(){ if(typeof window.openCart==='function') window.openCart(); else location.href='shop.html'; });
    }
    var modal = document.getElementById('productModal');
    var cta;
    function syncSticky(){
      if(!modal) return;
      var isOpen = !modal.classList.contains('hidden') && window.innerWidth <= 760;
      if(isOpen && !cta){
        cta = document.createElement('div'); cta.className='sticky-mobile-cta';
        cta.innerHTML='<div><strong id="stickyMobilePrice">Selected item</strong><small>VAT included</small></div><button type="button">Add to Cart</button>';
        cta.querySelector('button').addEventListener('click', function(){ if(typeof window.addCurrentToCart==='function') window.addCurrentToCart(); });
        document.body.appendChild(cta);
      }
      if(cta){
        cta.style.display = isOpen ? 'grid' : 'none';
        var price = document.getElementById('modalPrice'); var stickyPrice = document.getElementById('stickyMobilePrice');
        if(price && stickyPrice) stickyPrice.textContent = price.textContent || 'Selected item';
      }
    }
    if(modal){ new MutationObserver(syncSticky).observe(modal, {attributes:true, attributeFilter:['class']}); document.addEventListener('click', function(){ setTimeout(syncSticky, 80); }); window.addEventListener('resize', syncSticky); setInterval(syncSticky, 1000); }
    document.querySelectorAll('img').forEach(function(img){ if(!img.hasAttribute('loading')) img.setAttribute('loading','lazy'); if(!img.hasAttribute('decoding')) img.setAttribute('decoding','async'); });
  });
})();

/* CRAFTED-VISUAL-SHOP-DYNAMIC-PRICING-FIX-20260609-35
   Focus only: Shop product price rendering from Size × Fabric matrix and discounts.
   Does not change Admin modules.
*/
(function(){
  'use strict';
  if(typeof products === 'undefined') return;
  if(window.__cv35ShopDynamicPricingPatch) return;
  window.__cv35ShopDynamicPricingPatch = true;

  function money(n){ return 'SAR ' + Math.round(Number(n || 0)).toLocaleString(); }
  function cleanLabel(v){ return String(v || '').trim(); }
  function validNumber(v){ const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }
  function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function matrixLookup(matrix, sizeLabel, fabricLabel){
    if(!matrix || typeof matrix !== 'object') return 0;
    const s = cleanLabel(sizeLabel);
    const f = cleanLabel(fabricLabel);
    const attempts = [
      matrix?.[s]?.[f],
      matrix?.[f]?.[s],
      matrix?.[s],
      matrix?.[f]
    ];
    for(const value of attempts){
      const n = validNumber(value);
      if(n) return n;
    }
    return 0;
  }

  function allSizeLabels(p){
    const out = [];
    (p.sizeOptions || []).forEach(s => out.push(cleanLabel(s.label || s)));
    (p.sizes || []).forEach(s => out.push(cleanLabel(s.label || s)));
    if(p.sizeFabricPrices && typeof p.sizeFabricPrices === 'object') Object.keys(p.sizeFabricPrices).forEach(k => out.push(cleanLabel(k)));
    (p.fabricOptions || []).forEach(f => Object.keys(f.sizePrices || {}).forEach(k => out.push(cleanLabel(k))));
    return [...new Set(out.filter(Boolean))];
  }

  function allFabricLabels(p){
    const out = [];
    (p.fabricOptions || []).forEach(f => out.push(cleanLabel(f.label || f)));
    (p.fabrics || []).forEach(f => out.push(cleanLabel(f.label || f)));
    if(p.sizeFabricPrices && typeof p.sizeFabricPrices === 'object'){
      Object.values(p.sizeFabricPrices).forEach(row => {
        if(row && typeof row === 'object') Object.keys(row).forEach(k => out.push(cleanLabel(k)));
      });
    }
    if(p.sizeFabricCosts && typeof p.sizeFabricCosts === 'object'){
      Object.values(p.sizeFabricCosts).forEach(row => {
        if(row && typeof row === 'object') Object.keys(row).forEach(k => out.push(cleanLabel(k)));
      });
    }
    return [...new Set(out.filter(Boolean))];
  }

  const previousNormalizeSizeOptions = typeof normalizeSizeOptions === 'function' ? normalizeSizeOptions : null;
  normalizeSizeOptions = function(p){
    const labels = allSizeLabels(p);
    const source = Array.isArray(p.sizeOptions) && p.sizeOptions.length ? p.sizeOptions : labels.map(label => ({label}));
    const rows = source.map(s => {
      const label = cleanLabel(s.label || s);
      return {
        label,
        width: String(s.width || s.length || '').trim(),
        depth: String(s.depth || '').trim(),
        height: String(s.height || '').trim(),
        price: validNumber(s.price) || matrixLookup(p.sizeFabricPrices, label, allFabricLabels(p)[0]) || Number(p.price || 0)
      };
    }).filter(s => s.label);
    if(rows.length) return rows;
    return previousNormalizeSizeOptions ? previousNormalizeSizeOptions(p) : [{label:'Custom Size', price:Number(p.price || 0)}];
  };

  const previousNormalizeFabricOptions = typeof normalizeFabricOptions === 'function' ? normalizeFabricOptions : null;
  normalizeFabricOptions = function(p){
    const labels = allFabricLabels(p);
    const source = Array.isArray(p.fabricOptions) && p.fabricOptions.length ? p.fabricOptions : labels.map(label => ({label}));
    const sizes = Array.isArray(p.sizeOptions) && p.sizeOptions.length ? p.sizeOptions : normalizeSizeOptions(p);
    const rows = source.map(f => {
      const label = cleanLabel(f.label || f);
      const sizePrices = Object.assign({}, f.sizePrices || {});
      const costPrices = Object.assign({}, f.costPrices || {});
      sizes.forEach(s => {
        const sizeLabel = cleanLabel(s.label || s);
        if(sizePrices[sizeLabel] === undefined){
          const price = matrixLookup(p.sizeFabricPrices, sizeLabel, label) || validNumber(s.price) || Number(p.price || 0);
          if(price) sizePrices[sizeLabel] = price;
        }
        if(costPrices[sizeLabel] === undefined){
          const cost = matrixLookup(p.sizeFabricCosts, sizeLabel, label) || validNumber(p.costPrice);
          if(cost) costPrices[sizeLabel] = cost;
        }
      });
      return {
        label,
        label_ar: f.label_ar || '',
        description: f.description || '',
        description_ar: f.description_ar || '',
        sizePrices,
        costPrices
      };
    }).filter(f => f.label);
    if(rows.length) return rows;
    return previousNormalizeFabricOptions ? previousNormalizeFabricOptions(p) : [{label:'Standard Fabric', sizePrices:{}}];
  };

  const previousNormalizeProduct = typeof normalizeProduct === 'function' ? normalizeProduct : null;
  normalizeProduct = function(p){
    p = previousNormalizeProduct ? previousNormalizeProduct(p) : p;
    p.discountPercent = Number(p.discountPercent || 0);
    p.sizeFabricPrices = p.sizeFabricPrices || p.size_fabric_prices || {};
    p.sizeFabricCosts = p.sizeFabricCosts || p.size_fabric_costs || {};
    p.sizeOptions = normalizeSizeOptions(p);
    p.fabricOptions = normalizeFabricOptions(p);
    p.sizes = p.sizeOptions.map(s => s.label);
    p.fabrics = p.fabricOptions.map(f => f.label);
    return p;
  };

  variantPriceBeforeVat = function(p, sizeOpt=null, fabricOpt=null){
    const sizeLabel = cleanLabel(sizeOpt?.label || p.sizeOptions?.[0]?.label || 'Custom Size');
    const fabricLabel = cleanLabel(fabricOpt?.label || p.fabricOptions?.[0]?.label || 'Standard Fabric');
    const matrixPrice = matrixLookup(p.sizeFabricPrices, sizeLabel, fabricLabel);
    if(matrixPrice) return matrixPrice;
    if(fabricOpt && fabricOpt.sizePrices){
      const n = validNumber(fabricOpt.sizePrices[sizeLabel]);
      if(n) return n;
    }
    if(sizeOpt){
      const n = validNumber(sizeOpt.price);
      if(n) return n;
    }
    return Number(p.price || 0);
  };

  variantCost = function(p, sizeOpt=null, fabricOpt=null){
    const sizeLabel = cleanLabel(sizeOpt?.label || p.sizeOptions?.[0]?.label || 'Custom Size');
    const fabricLabel = cleanLabel(fabricOpt?.label || p.fabricOptions?.[0]?.label || 'Standard Fabric');
    const matrixCost = matrixLookup(p.sizeFabricCosts, sizeLabel, fabricLabel);
    if(matrixCost) return matrixCost;
    if(fabricOpt && fabricOpt.costPrices){
      const n = validNumber(fabricOpt.costPrices[sizeLabel]);
      if(n) return n;
    }
    return Number(p.costPrice || 0);
  };

  priceBeforeVat = function(p, sizeOpt=null, fabricOpt=null){ return variantPriceBeforeVat(p, sizeOpt, fabricOpt); };
  vatAmount = function(p, sizeOpt=null, fabricOpt=null){ return priceBeforeVat(p, sizeOpt, fabricOpt) * vatRate(p) / 100; };
  priceIncludingVat = function(p, sizeOpt=null, fabricOpt=null){ return priceBeforeVat(p, sizeOpt, fabricOpt) + vatAmount(p, sizeOpt, fabricOpt); };
  finalPrice = function(p, sizeOpt=null, fabricOpt=null){
    const discount = Number(p.discountPercent || 0);
    return Math.round(priceIncludingVat(p, sizeOpt, fabricOpt) * (1 - discount / 100));
  };

  function allVariantPrices(p){
    p = normalizeProduct(p);
    const values = [];
    (p.sizeOptions || []).forEach(s => {
      (p.fabricOptions || []).forEach(f => {
        const before = priceBeforeVat(p, s, f);
        if(validNumber(before)) values.push({before, final:finalPrice(p,s,f), size:s, fabric:f});
      });
    });
    if(!values.length){
      const before = Number(p.price || 0);
      values.push({before, final:finalPrice(p), size:null, fabric:null});
    }
    return values;
  }

  function lowestVariant(p){
    return allVariantPrices(p).sort((a,b)=>a.final-b.final)[0] || {before:Number(p.price||0), final:finalPrice(p)};
  }

  function shopCardPriceHTML(p){
    const low = lowestVariant(p);
    const discount = Number(p.discountPercent || 0);
    const beforeVatIncl = Math.round(low.before * (1 + vatRate(p)/100));
    if(discount > 0){
      return `<div class="shop-price-summary">
        <small>From</small><br>
        <span class="old-price" style="text-decoration:line-through;opacity:.65;">${money(beforeVatIncl)}</span><br>
        <strong class="discount-price">${money(low.final)}</strong>
        <span class="discount-badge">${discount}% OFF</span>
      </div>`;
    }
    return `<div class="shop-price-summary"><small>From</small><br><strong>${money(low.final)}</strong></div>`;
  }

  priceHTML = function(p, sizeOpt=null, fabricOpt=null){
    const before = priceBeforeVat(p, sizeOpt, fabricOpt);
    const vat = vatAmount(p, sizeOpt, fabricOpt);
    const incl = priceIncludingVat(p, sizeOpt, fabricOpt);
    const fp = finalPrice(p, sizeOpt, fabricOpt);
    const discount = Number(p.discountPercent || 0);
    let html = `<div class="price-detail">
      <div>Selected price before VAT: <strong>${money(before)}</strong></div>
      <div>VAT (${vatRate(p)}%): <strong>${money(vat)}</strong></div>`;
    if(discount > 0){
      html += `<div>Total before discount: <strong class="old-price" style="text-decoration:line-through;opacity:.65;">${money(incl)}</strong></div>
        <div>After discount: <strong class="discount-price">${money(fp)}</strong> <span class="discount-badge">${discount}% OFF</span></div>`;
    }else{
      html += `<div>Total incl. VAT: <strong>${money(incl)}</strong></div>`;
    }
    html += `</div>`;
    return html;
  };

  function sizeOptionLabel(p, s, fabric){
    const dim = [s.width, s.depth, s.height].filter(Boolean).join(' × ');
    const price = priceBeforeVat(p, s, fabric || p.fabricOptions?.[0]);
    return `${s.label}${dim ? ' — ' + dim + ' cm' : ''} — ${money(price)} before VAT`;
  }

  function refreshSizeSelectLabels(){
    const select = document.getElementById('sizeSelect');
    if(!select || !currentProduct) return;
    const current = select.value || '0';
    select.innerHTML = (currentProduct.sizeOptions || []).map((s,idx)=>`<option value="${idx}">${escapeHtml(sizeOptionLabel(currentProduct, s, selectedFabricOption))}</option>`).join('');
    select.value = current;
  }

  renderProducts = function(list){
    const grid = document.getElementById('productGrid');
    if(!grid) return;
    list = (list || []).map(normalizeProduct);
    if(!list.length){
      grid.innerHTML = `<div class="empty-products"><h3>No products showing yet</h3><p>No products are currently published.</p></div>`;
      return;
    }
    grid.innerHTML = list.map(p=>{
      const img = firstImage(p);
      return `<div class="card">
        <img src="${img}" alt="${escapeHtml(displayName(p))}">
        <div class="card-body">
          <h3>${escapeHtml(displayName(p))}</h3>
          <p>${escapeHtml(displayCategory(p))}</p>
          ${starDisplay(p.id)}
          ${shopCardPriceHTML(p)}
          <div class="mini-swatches">
            ${Object.entries(p.colors || {}).map(([c,v])=>`<span title="${escapeHtml(c)}" style="background:${v.hex || '#ccc'}"></span>`).join('')}
          </div>
          <br>
          <button class="btn primary" onclick="openProduct('${String(p.id).replace(/'/g,"\\'")}')">${lang === 'ar' ? 'عرض المنتج' : 'View Product'}</button>
        </div>
      </div>`;
    }).join('');
  };

  const previousApplySortAndFilter = typeof applySortAndFilter === 'function' ? applySortAndFilter : null;
  applySortAndFilter = function(){
    products = (products || []).map(normalizeProduct);
    let list = [...products];
    const catFilter = document.getElementById('categoryFilter');
    const sortSelect = document.getElementById('sortSelect');
    const selectedCategory = catFilter && catFilter.value ? catFilter.value : (window.CV_CATEGORY_FILTER || activeCategory);
    activeCategory = selectedCategory || 'All';
    if(activeCategory !== 'All') list = list.filter(p => p.category === activeCategory);
    const sort = sortSelect ? sortSelect.value : 'featured';
    if(sort === 'priceHigh') list.sort((a,b)=>lowestVariant(b).final-lowestVariant(a).final);
    else if(sort === 'priceLow') list.sort((a,b)=>lowestVariant(a).final-lowestVariant(b).final);
    else if(sort === 'discount') list.sort((a,b)=>Number(b.discountPercent||0)-Number(a.discountPercent||0));
    else if(sort === 'rating') list.sort((a,b)=>productRating(b.id).avg-productRating(a.id).avg);
    else if(sort === 'nameAZ') list.sort((a,b)=>displayName(a).localeCompare(displayName(b)));
    const title = document.getElementById('shopPageTitle');
    if(title && activeCategory && activeCategory !== 'All') title.textContent = activeCategory;
    renderProducts(list);
  };

  openProduct = function(id){
    currentProduct = normalizeProduct(products.find(p=>String(p.id) === String(id)) || products.find(p=>String(p._dbId) === String(id)) || {});
    if(!currentProduct || !currentProduct.id) return;
    selectedColor = Object.keys(currentProduct.colors || {})[0] || '';
    selectedImage = getColorImages(selectedColor)[0] || (currentProduct.gallery || [])[0] || firstImage(currentProduct);
    document.getElementById('modalName').textContent = displayName(currentProduct);
    document.getElementById('modalDesc').textContent = displayDesc(currentProduct) || '';
    selectedSizeOption = currentProduct.sizeOptions[0] || {label:'Custom Size', price:Number(currentProduct.price||0)};
    selectedFabricOption = currentProduct.fabricOptions[0] || {label:'Standard Fabric', sizePrices:{}, costPrices:{}};
    document.getElementById('fabricSelect').innerHTML = (currentProduct.fabricOptions || []).map((f,idx)=>`<option value="${idx}">${escapeHtml(f.label)}</option>`).join('');
    document.getElementById('fabricSelect').onchange = updateSelectedFabric;
    refreshSizeSelectLabels();
    document.getElementById('sizeSelect').onchange = updateSelectedSize;
    document.getElementById('modalPrice').innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
    updateFabricDescription();
    document.getElementById('modalRating').innerHTML = `<strong>${T[lang].rating}:</strong> ${starDisplay(currentProduct.id)}<div class="rate-stars">${[1,2,3,4,5].map(n=>`<button onclick="rateCurrent(${n})">★</button>`).join('')}</div><small>${T[lang].rateItem}</small>`;
    renderColors();
    renderThumbs();
    updateModalImage();
    document.getElementById('productModal').classList.remove('hidden');
  };

  updateSelectedFabric = function(){
    const idx = Number(document.getElementById('fabricSelect').value || 0);
    selectedFabricOption = currentProduct.fabricOptions[idx] || currentProduct.fabricOptions[0];
    refreshSizeSelectLabels();
    document.getElementById('modalPrice').innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
    updateFabricDescription();
  };

  updateSelectedSize = function(){
    const idx = Number(document.getElementById('sizeSelect').value || 0);
    selectedSizeOption = currentProduct.sizeOptions[idx] || currentProduct.sizeOptions[0];
    document.getElementById('modalPrice').innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
    updateFabricDescription();
  };

  addCurrentToCart = function(){
    if(!currentProduct){ alert('Please select a product.'); return; }
    const colorObj = currentProduct.colors[selectedColor] || {};
    const item = lightweightCartItem({
      id: currentProduct.id,
      name: displayName(currentProduct),
      price: finalPrice(currentProduct, selectedSizeOption, selectedFabricOption),
      originalPrice: priceBeforeVat(currentProduct, selectedSizeOption, selectedFabricOption),
      priceBeforeVat: priceBeforeVat(currentProduct, selectedSizeOption, selectedFabricOption),
      costPrice: variantCost(currentProduct, selectedSizeOption, selectedFabricOption),
      discountPercent: Number(currentProduct.discountPercent || 0),
      vatRate: vatRate(currentProduct),
      color: selectedColor,
      colorCode: colorObj.code || '',
      fabric: selectedFabricOption?.label || '',
      size: selectedSizeOption?.label || '',
      qty: 1
    });
    cart.push(item);
    if(!saveCartSafe()){ cart.pop(); return; }
    updateCartCount();
    renderCart();
    trackEvent('add_to_cart', {item_id:item.id, item_name:item.name, value:item.price, size:item.size, fabric:item.fabric});
    saveCRMActivity('Add to Cart', {id:item.id, name:item.name, price:item.price, color:item.color, fabric:item.fabric, size:item.size});
    const added = document.createElement('div');
    added.id = 'addedBox';
    added.className = 'added-box';
    added.textContent = lang === 'ar' ? 'تمت الإضافة إلى السلة' : 'Added to cart';
    document.querySelector('.modal-info')?.appendChild(added);
    setTimeout(()=>added.remove(), 2000);
  };

  function rerenderShopAfterPatch(){
    try{
      products = (products || []).map(normalizeProduct);
      if(document.getElementById('productGrid')) applySortAndFilter();
    }catch(e){ console.warn('v35 shop dynamic pricing render skipped', e); }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>setTimeout(rerenderShopAfterPatch, 250));
  else setTimeout(rerenderShopAfterPatch, 250);
})();


/* CRAFTED-VISUAL-SHOP-EXPERIENCE-SYNC-FIX-20260609-36
   Focus only: Shop frontend.
   Fixes: size/fabric selection, dynamic price, discount display, Quick View, Customize, Wishlist/heart.
   Does not touch Admin modules.
*/
(function(){
  'use strict';
  if(window.__cv36ShopExperiencePatch) return;
  window.__cv36ShopExperiencePatch = true;

  function money(n){ return 'SAR ' + Math.round(Number(n || 0)).toLocaleString(); }
  function clean(v){ return String(v || '').trim(); }
  function n(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
  function positive(v){ const x = n(v); return x > 0 ? x : 0; }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function getWishlist(){
    try{ return JSON.parse(localStorage.getItem('cv_wishlist_ids') || localStorage.getItem('cv_wishlist') || '[]').map(String); }
    catch(e){ return []; }
  }
  function saveWishlist(list){
    const cleanList = [...new Set((list || []).map(String))];
    localStorage.setItem('cv_wishlist_ids', JSON.stringify(cleanList));
    localStorage.setItem('cv_wishlist', JSON.stringify(cleanList));
  }
  function isWished(id){ return getWishlist().includes(String(id)); }

  window.cvToggleWishlist = function(id, ev){
    if(ev){ ev.preventDefault(); ev.stopPropagation(); }
    const sid = String(id);
    let list = getWishlist();
    if(list.includes(sid)) list = list.filter(x => x !== sid);
    else list.push(sid);
    saveWishlist(list);
    document.querySelectorAll(`[data-wishlist-id="${CSS.escape(sid)}"]`).forEach(btn=>{
      btn.classList.toggle('active', isWished(sid));
      btn.textContent = isWished(sid) ? '♥' : '♡';
      btn.setAttribute('aria-label', isWished(sid) ? 'Remove from wishlist' : 'Add to wishlist');
    });
    try{ if(typeof trackEvent === 'function') trackEvent('wishlist_toggle', {product_id:sid}); }catch(e){}
  };

  function matrixLookup(matrix, sizeLabel, fabricLabel){
    if(!matrix || typeof matrix !== 'object') return 0;
    const s = clean(sizeLabel);
    const f = clean(fabricLabel);
    const attempts = [
      matrix?.[s]?.[f],
      matrix?.[f]?.[s],
      matrix?.[s],
      matrix?.[f]
    ];
    for(const value of attempts){
      const x = positive(value);
      if(x) return x;
    }
    return 0;
  }

  function sizeLabelsFromProduct(p){
    const out = [];
    (p.sizeOptions || []).forEach(s => out.push(clean(s.label || s)));
    (p.sizes || []).forEach(s => out.push(clean(s.label || s)));
    if(p.sizeFabricPrices && typeof p.sizeFabricPrices === 'object') Object.keys(p.sizeFabricPrices).forEach(k => out.push(clean(k)));
    (p.fabricOptions || []).forEach(f => Object.keys(f.sizePrices || {}).forEach(k => out.push(clean(k))));
    return [...new Set(out.filter(Boolean))];
  }

  function fabricLabelsFromProduct(p){
    const out = [];
    (p.fabricOptions || []).forEach(f => out.push(clean(f.label || f)));
    (p.fabrics || []).forEach(f => out.push(clean(f.label || f)));
    if(p.sizeFabricPrices && typeof p.sizeFabricPrices === 'object'){
      Object.values(p.sizeFabricPrices).forEach(row => {
        if(row && typeof row === 'object') Object.keys(row).forEach(k => out.push(clean(k)));
      });
    }
    if(p.sizeFabricCosts && typeof p.sizeFabricCosts === 'object'){
      Object.values(p.sizeFabricCosts).forEach(row => {
        if(row && typeof row === 'object') Object.keys(row).forEach(k => out.push(clean(k)));
      });
    }
    return [...new Set(out.filter(Boolean))];
  }

  const originalNormalizeSizeOptions36 = typeof normalizeSizeOptions === 'function' ? normalizeSizeOptions : null;
  window.normalizeSizeOptions = normalizeSizeOptions = function(p){
    p = p || {};
    const labels = sizeLabelsFromProduct(p);
    const source = Array.isArray(p.sizeOptions) && p.sizeOptions.length ? p.sizeOptions : labels.map(label => ({label}));
    const firstFabric = fabricLabelsFromProduct(p)[0] || '';
    const rows = source.map(s => {
      const label = clean(s.label || s);
      if(!label) return null;
      return {
        label,
        width: clean(s.width || s.length || ''),
        depth: clean(s.depth || ''),
        height: clean(s.height || ''),
        price: positive(s.price) || matrixLookup(p.sizeFabricPrices, label, firstFabric) || n(p.price)
      };
    }).filter(Boolean);
    return rows.length ? rows : (originalNormalizeSizeOptions36 ? originalNormalizeSizeOptions36(p) : [{label:'Custom Size', price:n(p.price)}]);
  };

  const originalNormalizeFabricOptions36 = typeof normalizeFabricOptions === 'function' ? normalizeFabricOptions : null;
  window.normalizeFabricOptions = normalizeFabricOptions = function(p){
    p = p || {};
    const labels = fabricLabelsFromProduct(p);
    const source = Array.isArray(p.fabricOptions) && p.fabricOptions.length ? p.fabricOptions : labels.map(label => ({label}));
    const sizes = Array.isArray(p.sizeOptions) && p.sizeOptions.length ? p.sizeOptions : normalizeSizeOptions(p);

    const rows = source.map(f => {
      const label = clean(f.label || f);
      if(!label) return null;
      const sizePrices = Object.assign({}, f.sizePrices || {});
      const costPrices = Object.assign({}, f.costPrices || {});
      sizes.forEach(s => {
        const sizeLabel = clean(s.label || s);
        if(sizePrices[sizeLabel] === undefined){
          const price = matrixLookup(p.sizeFabricPrices, sizeLabel, label) || positive(s.price) || n(p.price);
          if(price) sizePrices[sizeLabel] = price;
        }
        if(costPrices[sizeLabel] === undefined){
          const cost = matrixLookup(p.sizeFabricCosts, sizeLabel, label) || positive(p.costPrice);
          if(cost) costPrices[sizeLabel] = cost;
        }
      });
      return {
        label,
        label_ar: f.label_ar || '',
        description: f.description || '',
        description_ar: f.description_ar || '',
        sizePrices,
        costPrices
      };
    }).filter(Boolean);

    return rows.length ? rows : (originalNormalizeFabricOptions36 ? originalNormalizeFabricOptions36(p) : [{label:'Standard Fabric', sizePrices:{}, costPrices:{}}]);
  };

  const originalNormalizeProduct36 = typeof normalizeProduct === 'function' ? normalizeProduct : null;
  window.normalizeProduct = normalizeProduct = function(p){
    p = originalNormalizeProduct36 ? originalNormalizeProduct36(p || {}) : (p || {});
    p.discountPercent = n(p.discountPercent || p.discount || 0);
    p.sizeFabricPrices = p.sizeFabricPrices || p.size_fabric_prices || {};
    p.sizeFabricCosts = p.sizeFabricCosts || p.size_fabric_costs || {};
    p.sizeOptions = normalizeSizeOptions(p);
    p.fabricOptions = normalizeFabricOptions(p);
    p.sizes = p.sizeOptions.map(s => s.label);
    p.fabrics = p.fabricOptions.map(f => f.label);
    return p;
  };

  window.variantPriceBeforeVat = variantPriceBeforeVat = function(p, sizeOpt=null, fabricOpt=null){
    p = normalizeProduct(p || {});
    const sizeLabel = clean(sizeOpt?.label || p.sizeOptions?.[0]?.label || '');
    const fabricLabel = clean(fabricOpt?.label || p.fabricOptions?.[0]?.label || '');
    return matrixLookup(p.sizeFabricPrices, sizeLabel, fabricLabel)
      || positive(fabricOpt?.sizePrices?.[sizeLabel])
      || positive(sizeOpt?.price)
      || n(p.price);
  };

  window.variantCost = variantCost = function(p, sizeOpt=null, fabricOpt=null){
    p = normalizeProduct(p || {});
    const sizeLabel = clean(sizeOpt?.label || p.sizeOptions?.[0]?.label || '');
    const fabricLabel = clean(fabricOpt?.label || p.fabricOptions?.[0]?.label || '');
    return matrixLookup(p.sizeFabricCosts, sizeLabel, fabricLabel)
      || positive(fabricOpt?.costPrices?.[sizeLabel])
      || n(p.costPrice);
  };

  window.priceBeforeVat = priceBeforeVat = function(p, sizeOpt=null, fabricOpt=null){ return variantPriceBeforeVat(p, sizeOpt, fabricOpt); };
  window.vatRate = vatRate = function(p){ return n(p?.vatRate || settings?.vat_rate || 15) || 15; };
  window.vatAmount = vatAmount = function(p, sizeOpt=null, fabricOpt=null){ return priceBeforeVat(p, sizeOpt, fabricOpt) * vatRate(p) / 100; };
  window.priceIncludingVat = priceIncludingVat = function(p, sizeOpt=null, fabricOpt=null){ return priceBeforeVat(p, sizeOpt, fabricOpt) + vatAmount(p, sizeOpt, fabricOpt); };
  window.finalPrice = finalPrice = function(p, sizeOpt=null, fabricOpt=null){
    return Math.round(priceIncludingVat(p, sizeOpt, fabricOpt) * (1 - n(p?.discountPercent) / 100));
  };

  function allVariantPrices(p){
    p = normalizeProduct(p || {});
    const values = [];
    (p.sizeOptions || []).forEach(s => {
      (p.fabricOptions || []).forEach(f => {
        const before = priceBeforeVat(p, s, f);
        if(before > 0) values.push({before, final:finalPrice(p,s,f), size:s, fabric:f});
      });
    });
    if(!values.length){
      const before = n(p.price);
      values.push({before, final:finalPrice(p), size:null, fabric:null});
    }
    return values;
  }

  function lowestVariant(p){
    return allVariantPrices(p).sort((a,b)=>a.final-b.final)[0] || {before:n(p.price), final:finalPrice(p)};
  }

  function shopCardPriceHTML(p){
    const low = lowestVariant(p);
    const discount = n(p.discountPercent);
    const oldIncl = Math.round(low.before * (1 + vatRate(p)/100));
    if(discount > 0){
      return `<div class="shop-price-summary">
        <small>From</small><br>
        <span class="old-price" style="text-decoration:line-through;opacity:.65;">${money(oldIncl)}</span><br>
        <strong class="discount-price">${money(low.final)}</strong>
        <span class="discount-badge">-${discount}%</span>
      </div>`;
    }
    return `<div class="shop-price-summary"><small>From</small><br><strong>${money(low.final)}</strong></div>`;
  }

  window.priceHTML = priceHTML = function(p, sizeOpt=null, fabricOpt=null){
    p = normalizeProduct(p || {});
    const before = priceBeforeVat(p, sizeOpt, fabricOpt);
    const vat = vatAmount(p, sizeOpt, fabricOpt);
    const incl = priceIncludingVat(p, sizeOpt, fabricOpt);
    const fp = finalPrice(p, sizeOpt, fabricOpt);
    const discount = n(p.discountPercent);

    let html = `<div class="price-detail">
      <div>Selected price before VAT: <strong>${money(before)}</strong></div>
      <div>VAT (${vatRate(p)}%): <strong>${money(vat)}</strong></div>`;

    if(discount > 0){
      html += `<div>Total before discount: <strong class="old-price" style="text-decoration:line-through;opacity:.65;">${money(incl)}</strong></div>
        <div>After discount: <strong class="discount-price">${money(fp)}</strong> <span class="discount-badge">-${discount}% OFF</span></div>`;
    }else{
      html += `<div>Total incl. VAT: <strong>${money(incl)}</strong></div>`;
    }

    html += `</div>`;
    return html;
  };

  function firstSafeImage(p){
    try{ return typeof firstImage === 'function' ? firstImage(p) : ''; }
    catch(e){ return ''; }
  }

  window.renderProducts = renderProducts = function(list){
    const grid = document.getElementById('productGrid');
    if(!grid) return;
    list = (list || []).map(normalizeProduct);

    if(!list.length){
      grid.innerHTML = `<div class="empty-products"><h3>No products showing yet</h3><p>No products are currently published.</p></div>`;
      return;
    }

    grid.innerHTML = list.map(p=>{
      const pid = String(p.id || p._dbId || '');
      const img = firstSafeImage(p) || 'assets/products/product_01.png';
      const name = typeof displayName === 'function' ? displayName(p) : p.name;
      const category = typeof displayCategory === 'function' ? displayCategory(p) : p.category;
      const wished = isWished(pid);
      return `<div class="card product-card" data-product-id="${esc(pid)}">
        <div class="product-card-image-wrap" style="position:relative;">
          <img src="${esc(img)}" alt="${esc(name)}">
          <button type="button" class="wishlist-heart ${wished?'active':''}" data-shop-action="wishlist" data-wishlist-id="${esc(pid)}" aria-label="${wished?'Remove from wishlist':'Add to wishlist'}" style="position:absolute;top:10px;right:10px;border:0;border-radius:50%;width:38px;height:38px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.12);font-size:22px;cursor:pointer;">${wished?'♥':'♡'}</button>
        </div>
        <div class="card-body">
          <h3>${esc(name)}</h3>
          <p>${esc(category || '')}</p>
          ${typeof starDisplay === 'function' ? starDisplay(pid) : ''}
          ${shopCardPriceHTML(p)}
          <div class="mini-swatches">
            ${Object.entries(p.colors || {}).map(([c,v])=>`<span title="${esc(c)}" style="background:${v.hex || '#ccc'}"></span>`).join('')}
          </div>
          <div class="cj-card-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
            <button class="btn secondary" type="button" data-shop-action="quick" data-product-id="${esc(pid)}">Quick View</button>
            <button class="btn primary" type="button" data-shop-action="customize" data-product-id="${esc(pid)}">Customize</button>
          </div>
        </div>
      </div>`;
    }).join('');
  };

  const oldApplySort36 = typeof applySortAndFilter === 'function' ? applySortAndFilter : null;
  window.applySortAndFilter = applySortAndFilter = function(){
    products = (products || []).map(normalizeProduct);
    let list = [...products];
    const catFilter = document.getElementById('categoryFilter');
    const sortSelect = document.getElementById('sortSelect');
    const selectedCategory = catFilter && catFilter.value ? catFilter.value : (window.CV_CATEGORY_FILTER || activeCategory);
    activeCategory = selectedCategory || 'All';

    if(activeCategory !== 'All') list = list.filter(p => p.category === activeCategory);
    const sort = sortSelect ? sortSelect.value : 'featured';

    if(sort === 'priceHigh') list.sort((a,b)=>lowestVariant(b).final-lowestVariant(a).final);
    else if(sort === 'priceLow') list.sort((a,b)=>lowestVariant(a).final-lowestVariant(b).final);
    else if(sort === 'discount') list.sort((a,b)=>n(b.discountPercent)-n(a.discountPercent));
    else if(sort === 'rating' && typeof productRating === 'function') list.sort((a,b)=>productRating(b.id).avg-productRating(a.id).avg);
    else if(sort === 'nameAZ' && typeof displayName === 'function') list.sort((a,b)=>displayName(a).localeCompare(displayName(b)));

    const title = document.getElementById('shopPageTitle');
    if(title && activeCategory && activeCategory !== 'All') title.textContent = activeCategory;
    renderProducts(list);
  };

  function optionSizeLabel(p, s, fabric){
    const dim = [s.width, s.depth, s.height].filter(Boolean).join(' × ');
    const price = priceBeforeVat(p, s, fabric || p.fabricOptions?.[0]);
    return `${s.label}${dim ? ' — ' + dim + ' cm' : ''} — ${money(price)} before VAT`;
  }

  function refreshSizeSelect(){
    const select = document.getElementById('sizeSelect');
    if(!select || !currentProduct) return;
    const current = select.value || '0';
    select.innerHTML = (currentProduct.sizeOptions || []).map((s,idx)=>`<option value="${idx}">${esc(optionSizeLabel(currentProduct, s, selectedFabricOption))}</option>`).join('');
    select.value = [...select.options].some(o => o.value === current) ? current : '0';
  }

  function refreshModalPrice(){
    const el = document.getElementById('modalPrice');
    if(el && currentProduct) el.innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
    const sticky = document.getElementById('stickyMobilePrice');
    if(sticky && el) sticky.textContent = el.textContent || '';
  }

  window.updateSelectedFabric = updateSelectedFabric = function(){
    const select = document.getElementById('fabricSelect');
    const idx = Number(select?.value || 0);
    selectedFabricOption = currentProduct.fabricOptions[idx] || currentProduct.fabricOptions[0];
    refreshSizeSelect();
    selectedSizeOption = currentProduct.sizeOptions[Number(document.getElementById('sizeSelect')?.value || 0)] || currentProduct.sizeOptions[0];
    refreshModalPrice();
    if(typeof updateFabricDescription === 'function') updateFabricDescription();
    if(typeof renderThumbs === 'function') renderThumbs();
    if(typeof updateModalImage === 'function') updateModalImage();
  };

  window.updateSelectedSize = updateSelectedSize = function(){
    const select = document.getElementById('sizeSelect');
    const idx = Number(select?.value || 0);
    selectedSizeOption = currentProduct.sizeOptions[idx] || currentProduct.sizeOptions[0];
    refreshModalPrice();
    if(typeof updateFabricDescription === 'function') updateFabricDescription();
  };

  function openProductInternal(id, mode){
    currentProduct = normalizeProduct((products || []).find(p=>String(p.id) === String(id)) || (products || []).find(p=>String(p._dbId) === String(id)) || {});
    if(!currentProduct || !currentProduct.id) return;

    selectedColor = Object.keys(currentProduct.colors || {})[0] || '';
    selectedSizeOption = currentProduct.sizeOptions[0] || {label:'Custom Size', price:n(currentProduct.price)};
    selectedFabricOption = currentProduct.fabricOptions[0] || {label:'Standard Fabric', sizePrices:{}, costPrices:{}};

    if(typeof getColorImages === 'function') selectedImage = getColorImages(selectedColor)[0] || firstSafeImage(currentProduct);
    else selectedImage = firstSafeImage(currentProduct);

    const nameEl = document.getElementById('modalName');
    const descEl = document.getElementById('modalDesc');
    const fabricSelect = document.getElementById('fabricSelect');
    const sizeSelect = document.getElementById('sizeSelect');

    if(nameEl) nameEl.textContent = typeof displayName === 'function' ? displayName(currentProduct) : currentProduct.name;
    if(descEl) descEl.textContent = typeof displayDesc === 'function' ? (displayDesc(currentProduct) || '') : (currentProduct.description || '');

    if(fabricSelect){
      fabricSelect.innerHTML = (currentProduct.fabricOptions || []).map((f,idx)=>`<option value="${idx}">${esc(f.label)}</option>`).join('');
      fabricSelect.value = '0';
      fabricSelect.onchange = updateSelectedFabric;
      fabricSelect.addEventListener('change', updateSelectedFabric);
    }

    refreshSizeSelect();
    if(sizeSelect){
      sizeSelect.value = '0';
      sizeSelect.onchange = updateSelectedSize;
      sizeSelect.addEventListener('change', updateSelectedSize);
    }

    refreshModalPrice();
    if(typeof updateFabricDescription === 'function') updateFabricDescription();

    const rating = document.getElementById('modalRating');
    if(rating && typeof starDisplay === 'function'){
      rating.innerHTML = `<strong>${T?.[lang]?.rating || 'Rating'}:</strong> ${starDisplay(currentProduct.id)}<div class="rate-stars">${[1,2,3,4,5].map(n=>`<button type="button" data-shop-action="rate" data-rate-stars="${n}">★</button>`).join('')}</div><small>${T?.[lang]?.rateItem || 'Rate this item'}</small>`;
    }

    if(typeof renderColors === 'function') renderColors();
    if(typeof renderThumbs === 'function') renderThumbs();
    if(typeof updateModalImage === 'function') updateModalImage();

    const modal = document.getElementById('productModal');
    if(modal) modal.classList.remove('hidden');

    let badge = document.getElementById('customizeModeBadge');
    if(mode === 'customize'){
      if(!badge){
        badge = document.createElement('div');
        badge.id = 'customizeModeBadge';
        badge.className = 'customize-mode-badge';
        badge.style.cssText = 'padding:10px 12px;margin:10px 0;border-radius:12px;background:#fff8e5;border:1px solid #f0d991;font-weight:700;';
        document.getElementById('modalPrice')?.insertAdjacentElement('afterend', badge);
      }
      badge.textContent = 'Customization mode: choose size, fabric, and color before adding to cart.';
    }else if(badge){
      badge.remove();
    }

    try{ if(typeof trackEvent === 'function') trackEvent(mode === 'customize' ? 'customize_open' : 'quick_view', {product_id:currentProduct.id, product_name:currentProduct.name}); }catch(e){}
  }

  window.openProduct = openProduct = function(id){ openProductInternal(id, 'quick'); };
  window.openCustomizeProduct = function(id){ openProductInternal(id, 'customize'); };

  const originalSelectColor36 = typeof selectColor === 'function' ? selectColor : null;
  window.selectColor = selectColor = function(color){
    selectedColor = color;
    if(typeof getColorImages === 'function') selectedImage = getColorImages(color)[0] || firstSafeImage(currentProduct);
    else selectedImage = firstSafeImage(currentProduct);
    if(typeof renderColors === 'function') renderColors();
    if(typeof renderThumbs === 'function') renderThumbs();
    if(typeof updateModalImage === 'function') updateModalImage();
  };

  window.addCurrentToCart = addCurrentToCart = function(){
    if(!currentProduct){ alert('Please select a product.'); return; }
    const colorObj = currentProduct.colors?.[selectedColor] || {};
    const item = lightweightCartItem({
      id: currentProduct.id,
      name: typeof displayName === 'function' ? displayName(currentProduct) : currentProduct.name,
      price: finalPrice(currentProduct, selectedSizeOption, selectedFabricOption),
      originalPrice: priceIncludingVat(currentProduct, selectedSizeOption, selectedFabricOption),
      priceBeforeVat: priceBeforeVat(currentProduct, selectedSizeOption, selectedFabricOption),
      costPrice: variantCost(currentProduct, selectedSizeOption, selectedFabricOption),
      discountPercent: n(currentProduct.discountPercent),
      vatRate: vatRate(currentProduct),
      color: selectedColor,
      colorCode: colorObj.code || '',
      fabric: selectedFabricOption?.label || '',
      size: selectedSizeOption?.label || '',
      qty: 1
    });
    cart.push(item);
    if(typeof saveCartSafe === 'function' && !saveCartSafe()){ cart.pop(); return; }
    if(typeof updateCartCount === 'function') updateCartCount();
    try{ if(typeof trackEvent === 'function') trackEvent('add_to_cart', {item_id:item.id, item_name:item.name, value:item.price, size:item.size, fabric:item.fabric}); }catch(e){}
    try{ if(typeof saveCRMActivity === 'function') saveCRMActivity('Add to Cart', item); }catch(e){}
    if(typeof showToast === 'function') showToast((item.name || 'Product') + ' added to cart');
    else alert('Added to cart');
  };

  document.addEventListener('click', function(e){
    const actionEl = e.target.closest('[data-shop-action]');
    if(!actionEl) return;

    const action = actionEl.getAttribute('data-shop-action');
    const productId = actionEl.getAttribute('data-product-id') || actionEl.closest('[data-product-id]')?.getAttribute('data-product-id');

    if(action === 'quick'){
      e.preventDefault(); e.stopPropagation();
      openProductInternal(productId, 'quick');
    }
    if(action === 'customize'){
      e.preventDefault(); e.stopPropagation();
      openProductInternal(productId, 'customize');
    }
    if(action === 'wishlist'){
      window.cvToggleWishlist(productId, e);
    }
    if(action === 'rate'){
      e.preventDefault(); e.stopPropagation();
      const stars = Number(actionEl.getAttribute('data-rate-stars') || 0);
      if(typeof rateCurrent === 'function') rateCurrent(stars);
    }
  }, true);

  function syncAfterLoad(){
    try{
      products = (products || []).map(normalizeProduct);
      if(document.getElementById('productGrid')) applySortAndFilter();
    }catch(e){ console.warn('v36 shop sync skipped', e); }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>setTimeout(syncAfterLoad, 350));
  else setTimeout(syncAfterLoad, 350);
})();


/* === CV ARABIC BUTTON CLICK FIX ONLY ===
   Purpose: make the top-right Arabic/English language button work when CSP blocks inline onclick.
   No layout, shop, admin, product, discount, or content logic is changed.
*/
(function(){
  function bindArabicButton(){
    try{
      if(typeof toggleLang === 'function') window.toggleLang = toggleLang;
      var buttons = Array.prototype.slice.call(document.querySelectorAll('.lang-btn'));
      var langButton = buttons.find(function(btn){
        if(btn.id === 'authBtn') return false;
        var txt = (btn.textContent || '').trim().toLowerCase();
        return txt === 'عربي' || txt === 'english' || btn.getAttribute('onclick') === 'toggleLang()';
      }) || buttons.find(function(btn){ return btn.id !== 'authBtn'; });
      if(!langButton || langButton.__cvArabicButtonBound) return;
      langButton.__cvArabicButtonBound = true;
      langButton.setAttribute('type','button');
      langButton.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        if(typeof window.toggleLang === 'function') window.toggleLang();
      }, true);
    }catch(e){ console.warn('Arabic button bind failed', e); }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindArabicButton);
  else bindArabicButton();
  setTimeout(bindArabicButton, 500);
})();

/* === CV EXISTING PAGE BODY DISPLAY FIX ONLY ===
   Purpose: display content saved in Admin > Page Builder for existing pages.
   Scope: frontend page content text only. Does not change shop cards, products, discounts,
   modal, page builder saving, or Shop by Room box rendering.
*/
(function(){
  function cvCurrentPageKey(){
    var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if(file === '' || file === 'index.html') return 'home';
    if(file === 'shop.html') return 'shop';
    if(file === 'discounted.html' || file === 'discounted-items.html') return 'discounted';
    if(file === 'contact.html') return 'contact';
    if(file === 'track-order.html') return 'track';
    if(file === 'account.html' || file === 'auth.html') return 'account';
    return file.replace(/\.html$/,'');
  }

  function cvReadStoredSettings(){
    try{
      if(window.settings && typeof window.settings === 'object') return window.settings;
    }catch(e){}
    try{
      var raw = localStorage.getItem('cms_settings') || sessionStorage.getItem('cms_settings');
      return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
  }

  function cvPickByLang(obj, base){
    if(!obj) return '';
    var isAr = (window.lang || localStorage.getItem('lang') || 'en') === 'ar';
    return isAr ? (obj[base + '_ar'] || obj[base] || obj[base + '_en'] || '') : (obj[base + '_en'] || obj[base] || obj[base + '_ar'] || '');
  }

  function cvSetText(id, value){
    var el = document.getElementById(id);
    if(el && value) el.textContent = value;
  }

  function cvEnsureManagedBlock(){
    var existing = document.getElementById('cvManagedPageContent');
    if(existing) return existing;
    var body = document.createElement('section');
    body.id = 'cvManagedPageContent';
    body.className = 'intro cv-managed-page-content';
    body.style.whiteSpace = 'pre-line';
    var target = document.querySelector('#custom') || document.querySelector('footer') || document.body.firstElementChild;
    if(target && target.parentNode) target.parentNode.insertBefore(body, target);
    else document.body.appendChild(body);
    return body;
  }

  function cvApplyExistingPageContent(){
    try{
      var st = cvReadStoredSettings();
      var key = cvCurrentPageKey();
      var content = st && st.page_content ? st.page_content[key] : null;
      if(!content) return;

      var title = cvPickByLang(content, 'title');
      var subtitle = cvPickByLang(content, 'subtitle');
      var body = cvPickByLang(content, 'body');
      var heroImage = content.hero_image || '';
      var mainText = body || subtitle;

      if(key === 'home'){
        cvSetText('heroTitle', title);
        cvSetText('heroText', subtitle);
        cvSetText('introTitle', title);
        cvSetText('introText', mainText);
        if(heroImage){
          var hero = document.querySelector('.hero');
          if(hero) hero.style.background = "linear-gradient(90deg,rgba(24,61,50,.88),rgba(24,61,50,.25)), url('" + heroImage + "') center/cover";
        }
        if(mainText){
          var managed = cvEnsureManagedBlock();
          managed.innerHTML = (title ? '<h2>' + String(title).replace(/[&<>]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}) + '</h2>' : '') + '<p>' + String(mainText).replace(/[&<>]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}) + '</p>';
        }
        return;
      }

      var pageTitle = document.querySelector('.page-hero h1, h1');
      var pageText = document.querySelector('.page-hero p');
      if(pageTitle && title) pageTitle.textContent = title;
      if(pageText && (subtitle || body)) pageText.textContent = subtitle || body;
      if(body){
        var block = cvEnsureManagedBlock();
        block.innerHTML = (title ? '<h2>' + String(title).replace(/[&<>]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}) + '</h2>' : '') + '<p>' + String(body).replace(/[&<>]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}) + '</p>';
      }
    }catch(e){ console.warn('Existing page content display skipped', e); }
  }

  var oldRenderCMS = typeof window.renderCMS === 'function' ? window.renderCMS : (typeof renderCMS === 'function' ? renderCMS : null);
  if(oldRenderCMS){
    window.renderCMS = renderCMS = function(){
      oldRenderCMS.apply(this, arguments);
      cvApplyExistingPageContent();
    };
  }

  var oldApplyLang = typeof window.applyLang === 'function' ? window.applyLang : (typeof applyLang === 'function' ? applyLang : null);
  if(oldApplyLang){
    window.applyLang = applyLang = function(){
      oldApplyLang.apply(this, arguments);
      setTimeout(cvApplyExistingPageContent, 0);
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(cvApplyExistingPageContent, 300); setTimeout(cvApplyExistingPageContent, 1200); });
  else { setTimeout(cvApplyExistingPageContent, 300); setTimeout(cvApplyExistingPageContent, 1200); }
})();

/* === CV CART ACTIVATION + CART DISCOUNT CODE ONLY FIX ===
   Scope: cart panel behavior only.
   - Activates cart/open/close/add-to-cart without relying on inline onclick.
   - Adds discount-code box inside the cart before checkout.
   - Discount codes apply before VAT only to non-discounted products.
   - Items already under product discount do not receive extra code discount.
*/
(function(){
  'use strict';
  if(window.__cvCartActivationDiscountCodeFix) return;
  window.__cvCartActivationDiscountCodeFix = true;

  var appliedCartDiscount = null;
  try{ appliedCartDiscount = JSON.parse(localStorage.getItem('appliedDiscount') || 'null'); }catch(e){ appliedCartDiscount = null; }

  function money(n){ return 'SAR ' + Math.round(Number(n || 0)).toLocaleString(); }
  function percentOf(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function itemQty(item){ return Math.max(1, Number(item && item.qty || 1)); }
  function itemVatRate(item){ return Number(item && item.vatRate || (window.settings && settings.vat_rate) || 15); }
  function itemBeforeVat(item){ return Number(item && (item.priceBeforeVat || item.originalPrice) || 0); }
  function itemHasProductDiscount(item){ return Number(item && item.discountPercent || 0) > 0; }
  function itemLineTotalCurrent(item){ return Number(item && item.price || 0) * itemQty(item); }
  function safeText(v){ return String(v == null ? '' : v).replace(/[&<>'"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]; }); }

  function normalizeDiscountCode(row){
    row = row || {};
    return {
      code: String(row.code || row.discount_code || '').trim().toUpperCase(),
      percent: Number(row.percent || row.discountPercent || row.discount_percent || row.value || 0),
      active: row.active === false || row.active === 0 ? false : true,
      expires_at: row.expires_at || row.expiry || row.expiresAt || null
    };
  }

  async function validateCartDiscountCode(code){
    try{
      var res = await fetch('/api/discounts/validate/' + encodeURIComponent(code), {cache:'no-store'});
      var data = await res.json().catch(function(){ return {}; });
      if(!res.ok || !data.valid) return null;
      return normalizeDiscountCode(data.discount || data);
    }catch(e){ return null; }
  }
  function isCodeExpired(code){
    if(!code || !code.expires_at) return false;
    var d = new Date(code.expires_at);
    return !isNaN(d.getTime()) && d < new Date();
  }

  function eligibleBeforeVatSubtotal(){
    return (window.cart || cart || []).reduce(function(sum,item){
      if(itemHasProductDiscount(item)) return sum;
      return sum + itemBeforeVat(item) * itemQty(item);
    }, 0);
  }

  function discountedItemsCount(){
    return (window.cart || cart || []).filter(itemHasProductDiscount).length;
  }

  function cartTotals(){
    var code = appliedCartDiscount && Number(appliedCartDiscount.percent || 0) > 0 ? appliedCartDiscount : null;
    var discountPercent = code ? Number(code.percent || 0) : 0;
    var subtotalBeforeVat = 0;
    var productDiscountedCount = 0;
    var codeDiscountBeforeVat = 0;
    var vatTotal = 0;
    var total = 0;

    (window.cart || cart || []).forEach(function(item){
      var qty = itemQty(item);
      var before = itemBeforeVat(item);
      var vatRate = itemVatRate(item);
      subtotalBeforeVat += before * qty;
      if(itemHasProductDiscount(item)){
        productDiscountedCount += qty;
        total += itemLineTotalCurrent(item);
        var lineCurrent = itemLineTotalCurrent(item);
        vatTotal += lineCurrent - (lineCurrent / (1 + vatRate / 100));
      }else{
        var lineBefore = before * qty;
        var lineDiscount = discountPercent ? (lineBefore * discountPercent / 100) : 0;
        var afterBeforeVat = Math.max(0, lineBefore - lineDiscount);
        codeDiscountBeforeVat += lineDiscount;
        vatTotal += afterBeforeVat * vatRate / 100;
        total += afterBeforeVat * (1 + vatRate / 100);
      }
    });

    return {
      subtotalBeforeVat: subtotalBeforeVat,
      codeDiscountBeforeVat: codeDiscountBeforeVat,
      vatTotal: vatTotal,
      total: total,
      productDiscountedCount: productDiscountedCount,
      code: code
    };
  }

  function saveCartDiscount(){
    if(appliedCartDiscount) localStorage.setItem('appliedDiscount', JSON.stringify(appliedCartDiscount));
    else localStorage.removeItem('appliedDiscount');
  }

  function cartPanel(){ return document.getElementById('cartPanel'); }
  function cartWrap(){ return document.getElementById('cartItems'); }

  function cartItemImageSafe(item){
    try{ return typeof cartItemImage === 'function' ? cartItemImage(item) : ''; }catch(e){ return ''; }
  }

  window.openCart = openCart = function(){
    var panel = cartPanel();
    var wrap = cartWrap();
    if(!panel || !wrap) return;

    window.cart = cart = (cart || []).map(function(i){ return typeof lightweightCartItem === 'function' ? lightweightCartItem(i) : i; });
    if(typeof saveCartSafe === 'function') saveCartSafe();

    if(!cart.length){
      appliedCartDiscount = null;
      saveCartDiscount();
      wrap.innerHTML = '<p>' + safeText((window.T && T[lang] && T[lang].empty) || 'Your cart is empty.') + '</p>';
    }else{
      wrap.innerHTML = cart.map(function(i,index){
        var img = cartItemImageSafe(i);
        var hasDiscount = itemHasProductDiscount(i);
        return '<div class="cart-item cart-item-rich">' +
          (img ? '<img src="' + safeText(img) + '" alt="' + safeText(i.name) + '">' : '') +
          '<div><strong>' + safeText(i.name) + '</strong><br>' +
          'Color: ' + safeText(i.color || '') + (i.colorCode ? ' (' + safeText(i.colorCode) + ')' : '') + '<br>' +
          'Fabric: ' + safeText(i.fabric || '') + '<br>' +
          'Size: ' + safeText(i.size || '') + '<br>' +
          (hasDiscount ? '<small class="discount-price">Product already under discount: ' + Number(i.discountPercent || 0) + '% — no additional code discount.</small><br>' : '') +
          '<strong>' + money(itemLineTotalCurrent(i)) + '</strong><br>' +
          '<button type="button" data-cart-action="qty-minus" data-cart-index="' + index + '">-</button> ' +
          '<span class="qty">' + itemQty(i) + '</span> ' +
          '<button type="button" data-cart-action="qty-plus" data-cart-index="' + index + '">+</button> ' +
          '<button type="button" data-cart-action="remove" data-cart-index="' + index + '">Remove</button>' +
          '</div></div>';
      }).join('') +
      '<div class="cart-discount-box" style="margin-top:14px;padding:12px;border:1px solid #e6d8c5;border-radius:14px;background:#fffaf2;">' +
        '<strong>Discount Code</strong>' +
        '<p style="margin:6px 0 10px;font-size:13px;">Code discount applies before VAT only to products without existing discounts.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<input id="cartDiscountCode" value="' + safeText(appliedCartDiscount && appliedCartDiscount.code || '') + '" placeholder="Enter code e.g. CV10" style="flex:1;min-width:160px;padding:10px;border:1px solid #ddd;border-radius:10px;">' +
          '<button type="button" class="btn secondary" data-cart-action="apply-code">Apply</button>' +
          '<button type="button" class="btn secondary" data-cart-action="clear-code">Clear</button>' +
        '</div>' +
        '<p id="cartDiscountMessage" style="margin:8px 0 0;font-size:13px;"></p>' +
      '</div>';
    }

    renderCartTotals();
    panel.classList.remove('hidden');
  };

  window.closeCart = closeCart = function(){
    var panel = cartPanel();
    if(panel) panel.classList.add('hidden');
  };

  function renderCartTotals(message, isError){
    var totalEl = document.getElementById('cartTotal');
    if(!totalEl) return;
    var t = cartTotals();
    var html = '<div class="cart-total-lines">' +
      '<div>Subtotal before VAT: <strong>' + money(t.subtotalBeforeVat) + '</strong></div>';
    if(t.code){
      html += '<div class="discount-price">Code discount before VAT (' + safeText(t.code.code) + ' - ' + Number(t.code.percent || 0) + '%): -<strong>' + money(t.codeDiscountBeforeVat) + '</strong></div>';
    }
    html += '<div>VAT after discount: <strong>' + money(t.vatTotal) + '</strong></div>' +
      '<div>Total incl. VAT: <strong>' + money(t.total) + '</strong></div>' +
      '</div>';
    totalEl.innerHTML = html;

    var msg = document.getElementById('cartDiscountMessage');
    if(msg){
      var baseMsg = '';
      if(t.productDiscountedCount && t.code){ baseMsg = 'Some products are already under discount, so no additional code discount was added to those products.'; }
      msg.textContent = message || baseMsg;
      msg.className = isError ? 'discount-red' : 'discount-price';
      msg.style.color = isError ? '#b00020' : '#b11226';
    }
  }

  async function applyCartDiscountCode(){
    var input = document.getElementById('cartDiscountCode');
    var codeText = String(input && input.value || '').trim().toUpperCase();
    if(!codeText){
      appliedCartDiscount = null;
      saveCartDiscount();
      renderCartTotals('Please add a discount code.', true);
      return;
    }
    var eligible = eligibleBeforeVatSubtotal();
    if(eligible <= 0){
      appliedCartDiscount = null;
      saveCartDiscount();
      renderCartTotals('This product is already under discount, so no additional discount will be added.', true);
      return;
    }
    var found = await validateCartDiscountCode(codeText);
    if(!found){
      appliedCartDiscount = null;
      saveCartDiscount();
      renderCartTotals('Invalid discount code.', true);
      return;
    }
    if(isCodeExpired(found)){
      appliedCartDiscount = null;
      saveCartDiscount();
      renderCartTotals('Discount code expired.', true);
      return;
    }
    appliedCartDiscount = found;
    saveCartDiscount();
    var msg = 'Code applied: ' + found.percent + '% discount before VAT.';
    if(discountedItemsCount()) msg += ' Products already under discount were excluded.';
    renderCartTotals(msg, false);
  }

  window.checkout = checkout = function(){
    if(!cart || !cart.length){ alert((window.T && T[lang] && T[lang].empty) || 'Your cart is empty.'); return; }
    localStorage.setItem('cartTotals', JSON.stringify(cartTotals()));
    if(typeof saveCartSafe === 'function') saveCartSafe();
    window.location.href = 'review.html';
  };

  document.addEventListener('click', function(e){
    var target = e.target.closest('button, a');
    if(!target) return;

    var action = target.getAttribute('data-cart-action');
    if(action){
      e.preventDefault();
      e.stopPropagation();
      var idx = Number(target.getAttribute('data-cart-index'));
      if(action === 'qty-minus' && cart[idx]){ cart[idx].qty = Math.max(1, itemQty(cart[idx]) - 1); if(typeof saveCartSafe === 'function') saveCartSafe(); if(typeof updateCartCount === 'function') updateCartCount(); openCart(); }
      if(action === 'qty-plus' && cart[idx]){ cart[idx].qty = itemQty(cart[idx]) + 1; if(typeof saveCartSafe === 'function') saveCartSafe(); if(typeof updateCartCount === 'function') updateCartCount(); openCart(); }
      if(action === 'remove' && cart[idx]){ cart.splice(idx,1); if(typeof saveCartSafe === 'function') saveCartSafe(); if(typeof updateCartCount === 'function') updateCartCount(); openCart(); }
      if(action === 'apply-code') applyCartDiscountCode();
      if(action === 'clear-code'){ appliedCartDiscount = null; saveCartDiscount(); renderCartTotals('Discount code removed.', false); }
      return;
    }

    var txt = (target.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
    var isCartButton = target.id === 'cartBtn' || target.getAttribute('href') === '#cart' || /^cart\s*\d*/i.test((target.textContent || '').trim()) || txt === 'السلة' || txt.indexOf('السلة') >= 0;
    if(isCartButton){ e.preventDefault(); e.stopPropagation(); openCart(); return; }

    if(target.closest('#cartPanel') && (txt === 'checkout' || txt === 'الدفع')){ e.preventDefault(); e.stopPropagation(); checkout(); return; }
    if(target.closest('#cartPanel') && (txt === '×' || txt === 'x')){ e.preventDefault(); e.stopPropagation(); closeCart(); return; }
    if(target.closest('#productModal') && (target.getAttribute('data-i18n') === 'addCart' || txt === 'add to cart' || txt === 'أضف للسلة')){
      e.preventDefault(); e.stopPropagation(); if(typeof addCurrentToCart === 'function') addCurrentToCart(); return;
    }
  }, true);

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeCart();
  });

  document.addEventListener('DOMContentLoaded', function(){
    if(typeof updateCartCount === 'function') updateCartCount();
  });
})();


/* CV COLOR SWITCH + MODAL TOOL DEDUPE ONLY FIX 20260613
   Scope: fixes product color image switching and removes duplicated modal tool button groups.
   No admin/backend/cart/auth behavior is changed.
*/
(function(){
  if(window.__cvColorSwitchToolDedupeFix20260613) return;
  window.__cvColorSwitchToolDedupeFix20260613 = true;

  function norm(v){ return String(v || '').trim().toLowerCase(); }
  function safeUrl(v){
    v = String(v || '').trim();
    return v && !v.startsWith('file://') && !v.includes('/Users/') ? v : '';
  }
  function unique(list){ return Array.from(new Set((list || []).map(safeUrl).filter(Boolean))); }

  function activeFabricLabel(){
    try{
      if(typeof selectedFabricOption !== 'undefined' && selectedFabricOption && selectedFabricOption.label) return String(selectedFabricOption.label);
      if(window.selectedFabricOption && window.selectedFabricOption.label) return String(window.selectedFabricOption.label);
      const sel = document.getElementById('fabricSelect');
      if(sel && sel.selectedOptions && sel.selectedOptions[0]) return sel.selectedOptions[0].textContent || '';
    }catch(e){}
    return '';
  }

  function findColorKey(product, color){
    const colors = product && product.colors ? product.colors : {};
    const keys = Object.keys(colors);
    if(!keys.length) return '';
    if(colors[color]) return color;
    const wanted = norm(color);
    return keys.find(k => norm(k) === wanted) ||
           keys.find(k => norm(k).includes(wanted) || wanted.includes(norm(k))) ||
           keys[0];
  }

  function urlsFromColorValue(value, requestedFabric){
    if(!value) return [];
    const fabric = norm(requestedFabric);
    const preferred = [];
    const fallback = [];

    if(Array.isArray(value.imageMeta)){
      value.imageMeta.forEach(item => {
        if(!item) return;
        const url = safeUrl(item.url || item.src || item.image);
        if(!url) return;
        const itemFabric = norm(item.fabric || item.fabricLabel || item.fabric_name);
        if(fabric && itemFabric && itemFabric === fabric) preferred.push(url);
        fallback.push(url);
      });
    }
    if(Array.isArray(value.images)) fallback.push(...value.images);
    if(value.image) fallback.push(value.image);
    if(value.url) fallback.push(value.url);
    if(value.src) fallback.push(value.src);
    return unique(preferred.length ? preferred : fallback);
  }

  function globalColorUrls(product, color){
    const wanted = norm(color);
    const out = [];
    const arrays = [product && product.imageMeta, product && product.galleryMeta, product && product.images, product && product.gallery];
    arrays.forEach(arr => {
      if(!Array.isArray(arr)) return;
      arr.forEach(item => {
        if(typeof item === 'string'){ return; }
        if(!item) return;
        const itemColor = norm(item.color || item.colorName || item.colour || item.label);
        if(itemColor && (itemColor === wanted || itemColor.includes(wanted) || wanted.includes(itemColor))){
          out.push(item.url || item.src || item.image);
        }
      });
    });
    return unique(out);
  }

  window.getColorImages = function(color){
    const product = (typeof currentProduct !== 'undefined' && currentProduct) ? currentProduct : (window.currentProduct || null);
    if(!product) return [];
    const actualKey = findColorKey(product, color);
    const colors = product.colors || {};
    const fabric = activeFabricLabel();
    const direct = urlsFromColorValue(colors[actualKey], fabric);
    if(direct.length) return direct;
    const global = globalColorUrls(product, actualKey || color);
    if(global.length) return global;
    try{ return window.firstImage ? [firstImage(product)].filter(Boolean) : []; }catch(e){ return []; }
  };

  window.selectColor = function(color){
    const product = (typeof currentProduct !== 'undefined' && currentProduct) ? currentProduct : (window.currentProduct || null);
    if(!product) return;
    const actualKey = findColorKey(product, color);
    window.selectedColor = actualKey;
    try{ selectedColor = actualKey; }catch(e){}
    const images = window.getColorImages(actualKey);
    const nextImage = images[0] || (window.firstImage ? firstImage(product) : '');
    window.selectedImage = nextImage;
    try{ selectedImage = nextImage; }catch(e){}
    if(typeof window.renderColors === 'function') renderColors();
    if(typeof window.renderThumbs === 'function') renderThumbs();
    const main = document.getElementById('modalImage') || document.getElementById('cvFinalMainImg');
    if(main && nextImage) main.src = nextImage;
    if(typeof window.updateModalImage === 'function') updateModalImage();
    if(typeof window.renderSelectionSummary === 'function') setTimeout(window.renderSelectionSummary, 20);
  };

  function removeDuplicateModalToolGroups(){
    const modal = document.getElementById('productModal');
    if(!modal) return;
    // Remove the secondary injected tool blocks, keeping the single native UX95 inline buttons only.
    modal.querySelectorAll('#cvModalTools, #cvPremiumTools, .cv-modal-tools, .cv-standalone-tools').forEach(el => el.remove());
    const groups = Array.from(modal.querySelectorAll('.ux95-tools-inline'));
    groups.slice(1).forEach(el => el.remove());
    // Last safety net: if any other wrapper contains the same 3 tool actions, keep only the first wrapper.
    const toolWrappers = Array.from(modal.querySelectorAll('div')).filter(el => {
      const btns = Array.from(el.querySelectorAll('button[data-ux95-tool],button[data-cv-tool]'));
      const types = new Set(btns.map(b => b.dataset.ux95Tool || b.dataset.cvTool).filter(Boolean));
      return types.has('360') && types.has('room') && types.has('measure');
    });
    toolWrappers.slice(1).forEach(el => el.remove());
  }

  document.addEventListener('click', function(e){
    const colorBtn = e.target && e.target.closest ? e.target.closest('.color-chip, [data-color], [data-product-color]') : null;
    if(!colorBtn) return;
    const color = colorBtn.getAttribute('data-color') || colorBtn.getAttribute('data-product-color') || (colorBtn.textContent || '').replace(/#[0-9a-fA-F]{3,8}/g,'').trim();
    const product = (typeof currentProduct !== 'undefined' && currentProduct) ? currentProduct : (window.currentProduct || null);
    if(color && product){
      e.preventDefault();
      e.stopPropagation();
      setTimeout(function(){ window.selectColor(color); }, 0);
    }
  }, true);

  const observer = new MutationObserver(removeDuplicateModalToolGroups);
  document.addEventListener('DOMContentLoaded', function(){
    removeDuplicateModalToolGroups();
    observer.observe(document.body, {childList:true, subtree:true});
  });
  setInterval(removeDuplicateModalToolGroups, 1000);
})();

/* CRAFTED VISUAL - SHOP SIZE + FABRIC + COLOR DISCOUNT DISPLAY PATCH
   Scope: shop frontend discount calculation/display only.
   Reads scoped rules saved by Discount Page as product.discountRules with scope=size_fabric_color.
*/
(function(){
  'use strict';
  if(window.__cvScopedVariantDiscountShopPatch) return;
  window.__cvScopedVariantDiscountShopPatch = true;

  function n(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
  function money(v){ return 'SAR ' + Math.round(n(v)).toLocaleString(); }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function norm(v){ return String(v || '').trim().toLowerCase(); }
  function parseData(value){
    if(!value) return {};
    if(typeof value === 'object') return value;
    try{ return JSON.parse(value); }catch(e){ return {}; }
  }
  function same(a,b){
    const A = norm(a), B = norm(b);
    if(!A || !B) return false;
    return A === B;
  }
  function sizeLabel(sizeOpt){ return typeof sizeOpt === 'object' ? (sizeOpt.label || sizeOpt.name || '') : String(sizeOpt || ''); }
  function fabricLabel(fabricOpt){ return typeof fabricOpt === 'object' ? (fabricOpt.label || fabricOpt.name || '') : String(fabricOpt || ''); }
  function colorNames(p){ return Object.keys((p && p.colors) || {}).filter(Boolean); }

  const previousApiMapper = typeof window.apiProductToFrontend === 'function' ? window.apiProductToFrontend : null;
  window.apiProductToFrontend = apiProductToFrontend = function(row){
    row = row || {};
    const data = Object.assign({}, parseData(row.data_json), parseData(row.data));
    let product = previousApiMapper ? previousApiMapper(Object.assign({}, row, {data})) : Object.assign({}, data);
    product = Object.assign({}, data, product || {});
    product._dbId = row.id || product._dbId;
    product.id = product.id || data.id || row.sku || String(row.id || '');
    product.name = product.name || data.name || row.name_en || row.name || '';
    product.name_ar = product.name_ar || data.name_ar || row.name_ar || '';
    product.category = product.category || data.category || row.category_name || row.category || '';
    product.category_ar = product.category_ar || data.category_ar || row.category_ar || '';
    product.description = product.description || data.description || row.description_en || '';
    product.description_ar = product.description_ar || data.description_ar || row.description_ar || '';
    product.price = n(product.price || data.price || row.base_price);
    product.vatRate = n(product.vatRate || data.vatRate || row.vat_rate || (window.settings && settings.vat_rate) || 15) || 15;
    product.discountPercent = n(product.discountPercent || data.discountPercent || data.discount || row.discount_percent || row.discountPercent);
    product.discountRules = Array.isArray(product.discountRules) ? product.discountRules : (Array.isArray(data.discountRules) ? data.discountRules : []);
    return typeof normalizeProduct === 'function' ? normalizeProduct(product) : product;
  };

  const previousNormalize = typeof window.normalizeProduct === 'function' ? window.normalizeProduct : null;
  window.normalizeProduct = normalizeProduct = function(p){
    p = previousNormalize ? previousNormalize(p || {}) : (p || {});
    p.discountPercent = n(p.discountPercent || p.discount || 0);
    p.discountRules = Array.isArray(p.discountRules) ? p.discountRules : [];
    return p;
  };

  function rulePercent(rule){ return n(rule && (rule.percent ?? rule.discountPercent ?? rule.discount_percent ?? rule.value)); }
  function isActiveRule(rule){ return !!rule && rule.active !== false && rule.enabled !== false && rulePercent(rule) > 0; }
  function scopedRules(p){ return ((p && p.discountRules) || []).filter(r => isActiveRule(r)); }
  function matchingRule(p, sizeOpt, fabricOpt, color){
    p = p || {};
    const s = sizeLabel(sizeOpt);
    const f = fabricLabel(fabricOpt);
    const c = color || '';
    const rules = scopedRules(p);
    let best = null;
    rules.forEach(r => {
      const scope = String(r.scope || r.type || '').toLowerCase();
      const sizeOk = !r.size || same(r.size, s);
      const fabricOk = !r.fabric || same(r.fabric, f);
      const colorOk = !r.color || same(r.color, c);
      let match = false;
      if(scope === 'size_fabric_color') match = !!s && !!f && !!c && sizeOk && fabricOk && colorOk;
      else if(scope === 'size_fabric') match = !!s && !!f && sizeOk && fabricOk;
      else if(scope === 'size') match = !!s && sizeOk;
      else if(scope === 'fabric') match = !!f && fabricOk;
      else if(scope === 'color') match = !!c && colorOk;
      else match = sizeOk && fabricOk && colorOk;
      if(match && (!best || rulePercent(r) > rulePercent(best))) best = r;
    });
    return best;
  }
  function activeDiscountPercent(p, sizeOpt, fabricOpt, color){
    const scoped = matchingRule(p, sizeOpt, fabricOpt, color);
    return scoped ? rulePercent(scoped) : n(p && p.discountPercent);
  }
  window.cvActiveDiscountPercent = activeDiscountPercent;

  const basePriceBeforeVat = typeof window.priceBeforeVat === 'function' ? window.priceBeforeVat : function(p){ return n(p && p.price); };
  const baseVatRate = typeof window.vatRate === 'function' ? window.vatRate : function(p){ return n((p && p.vatRate) || 15) || 15; };
  window.vatRate = vatRate = function(p){ return baseVatRate(p); };
  window.priceBeforeVat = priceBeforeVat = function(p, sizeOpt=null, fabricOpt=null){ return basePriceBeforeVat(p, sizeOpt, fabricOpt); };
  window.vatAmount = vatAmount = function(p, sizeOpt=null, fabricOpt=null){ return priceBeforeVat(p, sizeOpt, fabricOpt) * vatRate(p) / 100; };
  window.priceIncludingVat = priceIncludingVat = function(p, sizeOpt=null, fabricOpt=null){ return priceBeforeVat(p, sizeOpt, fabricOpt) + vatAmount(p, sizeOpt, fabricOpt); };
  window.finalPrice = finalPrice = function(p, sizeOpt=null, fabricOpt=null, color=null){
    const pct = activeDiscountPercent(p, sizeOpt, fabricOpt, color || ((p === currentProduct && typeof selectedColor !== 'undefined') ? selectedColor : ''));
    return Math.round(priceIncludingVat(p, sizeOpt, fabricOpt) * (1 - pct / 100));
  };

  function allVariantPrices(p){
    p = normalizeProduct(p || {});
    const sizes = (p.sizeOptions && p.sizeOptions.length) ? p.sizeOptions : [null];
    const fabrics = (p.fabricOptions && p.fabricOptions.length) ? p.fabricOptions : [null];
    const colors = colorNames(p).length ? colorNames(p) : [''];
    const values = [];
    sizes.forEach(s => fabrics.forEach(f => colors.forEach(c => {
      const before = priceBeforeVat(p, s, f);
      if(before > 0){
        const pct = activeDiscountPercent(p, s, f, c);
        values.push({before, final:Math.round((before * (1 + vatRate(p)/100)) * (1 - pct/100)), discount:pct, size:s, fabric:f, color:c});
      }
    })));
    if(!values.length){
      const before = n(p.price);
      const pct = activeDiscountPercent(p, null, null, '');
      values.push({before, final:Math.round((before * (1 + vatRate(p)/100)) * (1 - pct/100)), discount:pct, size:null, fabric:null, color:''});
    }
    return values;
  }
  function lowestVariant(p){ return allVariantPrices(p).sort((a,b)=>a.final-b.final)[0]; }
  window.cvHasAnyDiscount = function(p){ return allVariantPrices(p).some(v => n(v.discount) > 0); };

  window.priceHTML = priceHTML = function(p, sizeOpt=null, fabricOpt=null){
    p = normalizeProduct(p || {});
    const color = (p === currentProduct && typeof selectedColor !== 'undefined') ? selectedColor : '';
    const before = priceBeforeVat(p, sizeOpt, fabricOpt);
    const vat = vatAmount(p, sizeOpt, fabricOpt);
    const incl = priceIncludingVat(p, sizeOpt, fabricOpt);
    const pct = activeDiscountPercent(p, sizeOpt, fabricOpt, color);
    const fp = Math.round(incl * (1 - pct / 100));
    let html = `<div class="price-detail">
      <div>Selected price before VAT: <strong>${money(before)}</strong></div>
      <div>VAT (${vatRate(p)}%): <strong>${money(vat)}</strong></div>`;
    if(pct > 0){
      html += `<div>Total before discount: <strong class="old-price" style="text-decoration:line-through;opacity:.65;">${money(incl)}</strong></div>
        <div>After discount: <strong class="discount-price" style="color:#c62828;">${money(fp)}</strong> <span class="discount-badge" style="color:#c62828;">-${pct}% OFF</span></div>`;
    }else{
      html += `<div>Total incl. VAT: <strong>${money(incl)}</strong></div>`;
    }
    html += `</div>`;
    return html;
  };

  function shopPriceHTML(p){
    const low = lowestVariant(p);
    const oldIncl = Math.round(n(low.before) * (1 + vatRate(p)/100));
    if(n(low.discount) > 0){
      return `<div class="shop-price-summary">
        <small>From</small><br>
        <span class="old-price" style="text-decoration:line-through;opacity:.65;">${money(oldIncl)}</span><br>
        <strong class="discount-price" style="color:#c62828;">${money(low.final)}</strong>
        <span class="discount-badge" style="color:#c62828;">-${low.discount}% OFF</span>
      </div>`;
    }
    return `<div class="shop-price-summary"><small>From</small><br><strong>${money(low.final)}</strong></div>`;
  }

  window.renderProducts = renderProducts = function(list){
    const grid = document.getElementById('productGrid');
    if(!grid) return;
    list = (list || []).map(normalizeProduct);
    if(!list.length){
      grid.innerHTML = `<div class="empty-products"><h3>No products showing yet</h3><p>No products are currently published.</p></div>`;
      return;
    }
    grid.innerHTML = list.map(p => {
      const pid = String(p.id || p._dbId || '');
      const img = (typeof firstImage === 'function' ? firstImage(p) : '') || 'assets/products/product_01.png';
      const name = typeof displayName === 'function' ? displayName(p) : p.name;
      const category = typeof displayCategory === 'function' ? displayCategory(p) : p.category;
      let wished = false;
      try{ wished = (JSON.parse(localStorage.getItem('cv_wishlist_ids') || localStorage.getItem('cv_wishlist') || '[]').map(String)).includes(pid); }catch(e){}
      return `<div class="card product-card" data-product-id="${esc(pid)}">
        <div class="product-card-image-wrap" style="position:relative;">
          <img src="${esc(img)}" alt="${esc(name)}">
          <button type="button" class="wishlist-heart ${wished?'active':''}" data-shop-action="wishlist" data-wishlist-id="${esc(pid)}" aria-label="${wished?'Remove from wishlist':'Add to wishlist'}" style="position:absolute;top:10px;right:10px;border:0;border-radius:50%;width:38px;height:38px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.12);font-size:22px;cursor:pointer;">${wished?'♥':'♡'}</button>
        </div>
        <div class="card-body">
          <h3>${esc(name)}</h3>
          <p>${esc(category || '')}</p>
          ${typeof starDisplay === 'function' ? starDisplay(pid) : ''}
          ${shopPriceHTML(p)}
          <div class="mini-swatches">
            ${Object.entries(p.colors || {}).map(([c,v])=>`<span title="${esc(c)}" style="background:${(v && v.hex) || '#ccc'}"></span>`).join('')}
          </div>
          <div class="cj-card-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
            <button class="btn secondary" type="button" data-shop-action="quick" data-product-id="${esc(pid)}">Quick View</button>
            <button class="btn primary" type="button" data-shop-action="customize" data-product-id="${esc(pid)}">Customize</button>
          </div>
        </div>
      </div>`;
    }).join('');
  };

  const previousApplySort = typeof window.applySortAndFilter === 'function' ? window.applySortAndFilter : null;
  window.applySortAndFilter = applySortAndFilter = function(){
    products = (products || []).map(normalizeProduct);
    let list = [...products];
    const catFilter = document.getElementById('categoryFilter');
    const sortSelect = document.getElementById('sortSelect');
    const selectedCategory = catFilter && catFilter.value ? catFilter.value : (window.CV_CATEGORY_FILTER || activeCategory);
    activeCategory = selectedCategory || 'All';
    if(activeCategory !== 'All'){
      const wanted = norm(activeCategory);
      list = list.filter(p => norm(p.category) === wanted || norm(p.category_ar) === wanted);
    }
    const sort = sortSelect ? sortSelect.value : 'featured';
    if(sort === 'priceHigh') list.sort((a,b)=>lowestVariant(b).final-lowestVariant(a).final);
    else if(sort === 'priceLow') list.sort((a,b)=>lowestVariant(a).final-lowestVariant(b).final);
    else if(sort === 'discount') list.sort((a,b)=>Math.max(...allVariantPrices(b).map(v=>n(v.discount)))-Math.max(...allVariantPrices(a).map(v=>n(v.discount))));
    else if(sort === 'rating' && typeof productRating === 'function') list.sort((a,b)=>productRating(b.id).avg-productRating(a.id).avg);
    else if(sort === 'nameAZ' && typeof displayName === 'function') list.sort((a,b)=>displayName(a).localeCompare(displayName(b)));
    const title = document.getElementById('shopPageTitle');
    if(title && activeCategory && activeCategory !== 'All') title.textContent = activeCategory;
    renderProducts(list);
  };

  const previousUpdateFabric = typeof window.updateSelectedFabric === 'function' ? window.updateSelectedFabric : null;
  window.updateSelectedFabric = updateSelectedFabric = function(){
    if(previousUpdateFabric) previousUpdateFabric();
    const el = document.getElementById('modalPrice');
    if(el && currentProduct) el.innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
  };
  const previousUpdateSize = typeof window.updateSelectedSize === 'function' ? window.updateSelectedSize : null;
  window.updateSelectedSize = updateSelectedSize = function(){
    if(previousUpdateSize) previousUpdateSize();
    const el = document.getElementById('modalPrice');
    if(el && currentProduct) el.innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
  };
  const previousSelectColor = typeof window.selectColor === 'function' ? window.selectColor : null;
  window.selectColor = selectColor = function(color){
    if(previousSelectColor) previousSelectColor(color);
    const el = document.getElementById('modalPrice');
    if(el && currentProduct) el.innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
  };

  const previousAddToCart = typeof window.addCurrentToCart === 'function' ? window.addCurrentToCart : null;
  window.addCurrentToCart = addCurrentToCart = function(){
    if(!currentProduct){ alert('Please select a product.'); return; }
    const pct = activeDiscountPercent(currentProduct, selectedSizeOption, selectedFabricOption, selectedColor || '');
    const colorObj = (currentProduct.colors && currentProduct.colors[selectedColor]) || {};
    const item = lightweightCartItem({
      id: currentProduct.id,
      name: typeof displayName === 'function' ? displayName(currentProduct) : currentProduct.name,
      price: finalPrice(currentProduct, selectedSizeOption, selectedFabricOption, selectedColor || ''),
      originalPrice: priceIncludingVat(currentProduct, selectedSizeOption, selectedFabricOption),
      priceBeforeVat: priceBeforeVat(currentProduct, selectedSizeOption, selectedFabricOption),
      costPrice: typeof variantCost === 'function' ? variantCost(currentProduct, selectedSizeOption, selectedFabricOption) : 0,
      discountPercent: pct,
      vatRate: vatRate(currentProduct),
      color: selectedColor || '',
      colorCode: colorObj.code || '',
      fabric: fabricLabel(selectedFabricOption),
      size: sizeLabel(selectedSizeOption),
      qty: 1
    });
    cart.push(item);
    if(typeof saveCartSafe === 'function' && !saveCartSafe()){ cart.pop(); return; }
    if(typeof updateCartCount === 'function') updateCartCount();
    try{ if(typeof trackEvent === 'function') trackEvent('add_to_cart', {item_id:item.id, item_name:item.name, value:item.price, size:item.size, fabric:item.fabric, color:item.color}); }catch(e){}
    try{ if(typeof saveCRMActivity === 'function') saveCRMActivity('Add to Cart', item); }catch(e){}
    if(typeof showToast === 'function') showToast((item.name || 'Product') + ' added to cart'); else alert('Added to cart');
  };

  function refreshAfterPatch(){
    try{
      products = (products || []).map(normalizeProduct);
      if(document.getElementById('productGrid')) applySortAndFilter();
      const modalPrice = document.getElementById('modalPrice');
      if(modalPrice && currentProduct) modalPrice.innerHTML = priceHTML(currentProduct, selectedSizeOption, selectedFabricOption);
    }catch(e){ console.warn('Scoped variant discount shop refresh skipped', e); }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(refreshAfterPatch, 500); });
  else setTimeout(refreshAfterPatch, 500);
})();
