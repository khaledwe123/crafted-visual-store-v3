
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
  const banners = Array.isArray(settings.hero_banners) ? settings.hero_banners.filter(Boolean) : [];
  const legacy = [settings.hero_banner_1, settings.hero_banner_2, settings.hero_banner_3, settings.hero_banner_4, settings.hero_banner_5, settings.hero_image].filter(Boolean);
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
