
/* Crafted Visual Arabic Auto Translation Engine */
const CV_TRANSLATION_MAP = {
  "home":"الرئيسية","about us":"من نحن","shop":"المتجر","custom order":"طلب تفصيل","track order":"تتبع الطلب","my account":"حسابي","contact us":"اتصل بنا",
  "l shape sofas":"كنبات زاوية","l shape sofa":"كنبة زاوية","beds":"أسرة","bed":"سرير","single chairs":"كراسي مفردة","single chair":"كرسي مفرد",
  "dining tables":"طاولات طعام","coffee tables":"طاولات قهوة","tv units":"وحدات تلفاز","wardrobes":"خزائن ملابس","custom furniture":"أثاث حسب الطلب",
  "modern":"عصري","luxury":"فاخر","premium":"فاخر","classic":"كلاسيكي","contemporary":"معاصر","with storage":"مع تخزين","storage":"تخزين",
  "sofa":"كنبة","chair":"كرسي","table":"طاولة","green":"أخضر","dark green":"أخضر داكن","olive green":"أخضر زيتوني","beige":"بيج","white":"أبيض","black":"أسود","grey":"رمادي","gray":"رمادي","brown":"بني","yellow":"أصفر",
  "velvet":"مخمل","linen":"كتان","boucle":"بوكليه","bouclé":"بوكليه","leather":"جلد","performance fabric":"قماش عملي","fabric":"قماش",
  "soft":"ناعم","comfortable":"مريح","durable":"متين","elegant":"أنيق","natural":"طبيعي","wood":"خشب","custom size":"مقاس حسب الطلب",
  "queen":"كوين","king":"كينغ","super king":"سوبر كينغ"
};

function cvTitleCaseArabicFallback(text){
  return String(text || "").trim();
}

function autoTranslateToArabic(text){
  if(!text) return "";
  let original = String(text).trim();
  let lower = original.toLowerCase().trim();
  if(CV_TRANSLATION_MAP[lower]) return CV_TRANSLATION_MAP[lower];

  // phrase replacement, longest first
  let result = original;
  Object.keys(CV_TRANSLATION_MAP).sort((a,b)=>b.length-a.length).forEach(key=>{
    const re = new RegExp("\\b" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi");
    result = result.replace(re, CV_TRANSLATION_MAP[key]);
  });

  // Common furniture copy enhancements
  result = result
    .replace(/cm/gi, "سم")
    .replace(/SAR/gi, "ريال")
    .replace(/x/gi, "×")
    .replace(/custom/gi, "حسب الطلب")
    .replace(/request/gi, "طلب")
    .replace(/description/gi, "الوصف")
    .replace(/color/gi, "اللون")
    .replace(/size/gi, "المقاس");

  return result === original ? cvTitleCaseArabicFallback(original) : result;
}

function ensureArabic(en, ar){
  return String(ar || "").trim() || autoTranslateToArabic(en || "");
}

/* === CV UNIVERSAL ARABIC TOGGLE FIX ===
   Scope: Arabic/English text rendering only.
   Keeps original text in data attributes so English can be restored.
   Does not change business logic, pricing, discounts, admin auth, products, or payment.
*/
(function(){
  'use strict';
  if(window.__cvUniversalArabicToggleFix) return;
  window.__cvUniversalArabicToggleFix = true;

  var TEXT = {
    'Crafted Visual':'كرافتد فيجوال',
    'Bayt Crafted':'بيت كرافتد',
    'Home':'الرئيسية',
    'Shop':'المتجر',
    'Discounted Items':'العروض والخصومات',
    'Custom Order':'طلب تفصيل',
    'Track Order':'تتبع الطلب',
    'Contact Us':'تواصل معنا',
    'My Account':'حسابي',
    'Account':'الحساب',
    'Login':'تسجيل الدخول',
    'Logout':'تسجيل الخروج',
    'Sign In':'تسجيل الدخول',
    'Sign Up':'إنشاء حساب',
    'Register':'إنشاء حساب',
    'Submit':'إرسال',
    'Save':'حفظ',
    'Cancel':'إلغاء',
    'Edit':'تعديل',
    'Delete':'حذف',
    'Close':'إغلاق',
    'Search':'بحث',
    'Clear':'مسح',
    'Apply':'تطبيق',
    'Active':'نشط',
    'Inactive':'غير نشط',

    'Contact Crafted Visual':'تواصل مع كرافتد فيجوال',
    'For furniture inquiries, custom orders, delivery, after-sales support, and project requests.':'لاستفسارات الأثاث والطلبات الخاصة والتوصيل وخدمة ما بعد البيع وطلبات المشاريع.',
    'Contact Information':'معلومات التواصل',
    'Send Inquiry':'إرسال الاستفسار',
    'Send inquiry':'إرسال الاستفسار',
    'Inquiry Type':'نوع الاستفسار',
    'Product Inquiry':'استفسار عن منتج',
    'Custom Order Inquiry':'استفسار عن طلب تفصيل',
    'Delivery Inquiry':'استفسار عن التوصيل',
    'After Sales Support':'خدمة ما بعد البيع',
    'Project Inquiry':'استفسار عن مشروع',
    'WhatsApp:':'واتساب:',
    'Email:':'البريد الإلكتروني:',
    'Location:':'الموقع:',
    'Working Hours:':'ساعات العمل:',
    'Chat with us':'تواصل معنا',
    'Riyadh, Saudi Arabia':'الرياض، المملكة العربية السعودية',
    'Saturday to Thursday, 9:00 AM - 9:00 PM':'من السبت إلى الخميس، ٩:٠٠ صباحاً - ٩:٠٠ مساءً',
    'Saturday to Thursday':'من السبت إلى الخميس',
    '9:00 AM - 9:00 PM':'٩:٠٠ صباحاً - ٩:٠٠ مساءً',
    'Inquiry saved and WhatsApp message prepared.':'تم حفظ الاستفسار وتجهيز رسالة واتساب.',

    'Full Name':'الاسم الكامل',
    'Mobile Number':'رقم الجوال',
    'Phone Number':'رقم الجوال',
    'Email':'البريد الإلكتروني',
    'Message':'الرسالة',
    'City':'المدينة',
    'Delivery Address':'عنوان التوصيل',
    'Building / Villa / Apartment':'المبنى / الفيلا / الشقة',
    'Additional Notes':'ملاحظات إضافية',
    'Save Account':'حفظ الحساب',
    'Manage your saved delivery details.':'إدارة بيانات التوصيل المحفوظة.',

    'Track Your Order':'تتبع طلبك',
    'Enter the full order number exactly as received.':'أدخل رقم الطلب الكامل كما وصل إليك.',
    'No order found.':'لم يتم العثور على الطلب.',
    'Order Number':'رقم الطلب',
    'Order Status':'حالة الطلب',
    'Payment Status':'حالة الدفع',
    'Pending Payment':'بانتظار الدفع',
    'Awaiting Payment Verification':'بانتظار التحقق من الدفع',
    'Submit Order':'إرسال الطلب',
    'Order Received':'تم استلام الطلب',
    'Thank You':'شكراً لك',
    'Continue Shopping':'متابعة التسوق',

    'Browse products by category, fabric, color, size, and price.':'تصفح المنتجات حسب الفئة والقماش واللون والمقاس والسعر.',
    'Quick View':'عرض سريع',
    'Customize':'تخصيص',
    'Add to Cart':'إضافة إلى السلة',
    'Add to Wishlist':'إضافة إلى المفضلة',
    'WhatsApp Inquiry':'استفسار واتساب',
    'Customer Rating:':'تقييم العملاء:',
    'Rate this item':'قيّم هذا المنتج',
    'Color':'اللون',
    'Fabric':'القماش',
    'Size':'المقاس',
    'Selected price before VAT:':'السعر المختار قبل الضريبة:',
    'Price before VAT:':'السعر قبل الضريبة:',
    'VAT':'ضريبة القيمة المضافة',
    'Total incl. VAT:':'الإجمالي شامل الضريبة:',
    'After discount:':'بعد الخصم:',
    'VAT included':'شامل ضريبة القيمة المضافة',
    'Made to order: 15–20 working days':'تفصيل حسب الطلب: ١٥–٢٠ يوم عمل',
    'Starting from':'يبدأ من',
    'No ratings':'لا توجد تقييمات',
    'Write first review':'اكتب أول تقييم',
    '360° View':'عرض ٣٦٠°',
    'Room Visualizer':'معاينة في الغرفة',
    'Measure-in-Room':'القياس داخل الغرفة',
    'Featured':'مميز',
    'Price: High to Low':'السعر: من الأعلى إلى الأقل',
    'Price: Low to High':'السعر: من الأقل إلى الأعلى',
    'Highest Discount':'أعلى خصم',
    'Best Rating':'أفضل تقييم',
    'Name A-Z':'الاسم أ-ي',

    'Beds':'أسرة',
    'L Shape Sofas':'كنبات زاوية',
    'Single Chairs':'كراسي مفردة',
    'Dining Tables':'طاولات طعام',
    'Coffee Tables':'طاولات قهوة',
    'TV Units':'وحدات تلفاز',
    'Wardrobes':'خزائن ملابس',
    'Custom Furniture':'أثاث حسب الطلب',
    'Dark Green':'أخضر داكن',
    'Beige':'بيج',
    'White':'أبيض',
    'Black':'أسود',
    'Brown':'بني',
    'Grey':'رمادي',
    'Gray':'رمادي',
    'Velvet':'مخمل',
    'Linen':'كتان',
    'Boucle':'بوكليه',
    'Bouclé':'بوكليه',
    'Leather':'جلد',
    'Microfiber':'مايكروفايبر',

    'WhatsApp Furniture expert':'خبير الأثاث عبر واتساب',
    'Furniture expert':'خبير الأثاث'
  };

  var PLACEHOLDERS = {
    'Full Name':'الاسم الكامل',
    'Mobile Number':'رقم الجوال',
    'Phone Number':'رقم الجوال',
    'Email':'البريد الإلكتروني',
    'Message':'الرسالة',
    'Full Order Number e.g. CV-...':'رقم الطلب الكامل مثال CV-...',
    'Full delivery address':'عنوان التوصيل الكامل',
    'Building, villa or apartment':'المبنى أو الفيلا أو الشقة',
    'Preferred delivery notes':'ملاحظات التوصيل المفضلة',
    'Search products':'ابحث عن المنتجات',
    'Search':'بحث',
    'Code e.g. CV10':'الكود مثال CV10',
    'Discount %':'نسبة الخصم %',
    'Menu Label English':'اسم القائمة بالإنجليزية',
    'Menu Label Arabic':'اسم القائمة بالعربية',
    'URL e.g. index.html#shop':'الرابط مثال index.html#shop'
  };

  function currentLang(){
    return String(localStorage.getItem('lang') || document.documentElement.lang || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }

  function translateText(text){
    if(!text) return text;
    var original = String(text);
    var trimmed = original.trim();
    if(!trimmed) return original;
    if(TEXT[trimmed]) return original.replace(trimmed, TEXT[trimmed]);
    var translated = trimmed;
    Object.keys(TEXT).sort(function(a,b){ return b.length - a.length; }).forEach(function(key){
      if(translated.indexOf(key) !== -1) translated = translated.split(key).join(TEXT[key]);
    });
    return translated === trimmed ? original : original.replace(trimmed, translated);
  }

  function rememberTextNode(node){
    if(!node || node.nodeType !== 3 || !node.parentElement) return;
    if(!node.parentElement.__cvOriginalTextNodes) node.parentElement.__cvOriginalTextNodes = new WeakMap();
    if(!node.parentElement.__cvOriginalTextNodes.has(node)) node.parentElement.__cvOriginalTextNodes.set(node, node.nodeValue);
  }

  function applyToTextNode(node, toArabic){
    if(!node || node.nodeType !== 3 || !node.parentElement) return;
    var parent = node.parentElement;
    if(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','SELECT','OPTION'].indexOf(parent.tagName) !== -1) return;
    rememberTextNode(node);
    var original = parent.__cvOriginalTextNodes.get(node);
    node.nodeValue = toArabic ? translateText(original) : original;
  }

  function walk(node, toArabic){
    if(!node) return;
    if(node.nodeType === 3){ applyToTextNode(node, toArabic); return; }
    if(node.nodeType !== 1) return;
    if(['SCRIPT','STYLE','NOSCRIPT','IFRAME','SVG'].indexOf(node.tagName) !== -1) return;
    Array.prototype.slice.call(node.childNodes).forEach(function(child){ walk(child, toArabic); });
  }

  function applyAttributes(toArabic){
    document.querySelectorAll('input, textarea').forEach(function(el){
      if(!el.dataset.cvOriginalPlaceholder) el.dataset.cvOriginalPlaceholder = el.getAttribute('placeholder') || '';
      var original = el.dataset.cvOriginalPlaceholder;
      el.setAttribute('placeholder', toArabic ? (PLACEHOLDERS[original] || translateText(original)) : original);
    });
    document.querySelectorAll('select option').forEach(function(el){
      if(!el.dataset.cvOriginalText) el.dataset.cvOriginalText = el.textContent || '';
      var original = el.dataset.cvOriginalText;
      el.textContent = toArabic ? (TEXT[original.trim()] || translateText(original)) : original;
    });
    document.querySelectorAll('[aria-label]').forEach(function(el){
      if(!el.dataset.cvOriginalAriaLabel) el.dataset.cvOriginalAriaLabel = el.getAttribute('aria-label') || '';
      var original = el.dataset.cvOriginalAriaLabel;
      el.setAttribute('aria-label', toArabic ? translateText(original) : original);
    });
  }

  function applyUniversalLanguage(){
    var toArabic = currentLang() === 'ar';
    document.documentElement.lang = toArabic ? 'ar' : 'en';
    document.documentElement.dir = toArabic ? 'rtl' : 'ltr';
    walk(document.body, toArabic);
    applyAttributes(toArabic);
    document.querySelectorAll('.lang-btn, [data-cv-lang-toggle]').forEach(function(btn){
      if(btn.id === 'authBtn') return;
      btn.textContent = toArabic ? 'English' : 'عربي';
    });
  }

  window.cvApplyArabicTranslations = applyUniversalLanguage;

  var previousApplyLang = window.applyLang;
  window.applyLang = function(){
    if(typeof previousApplyLang === 'function') previousApplyLang.apply(this, arguments);
    setTimeout(applyUniversalLanguage, 0);
  };

  if(typeof window.toggleLang !== 'function'){
    window.toggleLang = function(){
      var next = currentLang() === 'ar' ? 'en' : 'ar';
      localStorage.setItem('lang', next);
      applyUniversalLanguage();
    };
  } else {
    var previousToggleLang = window.toggleLang;
    window.toggleLang = function(){
      var result = previousToggleLang.apply(this, arguments);
      setTimeout(applyUniversalLanguage, 0);
      return result;
    };
  }

  function start(){
    applyUniversalLanguage();
    setTimeout(applyUniversalLanguage, 300);
    setTimeout(applyUniversalLanguage, 1000);
    var observer = new MutationObserver(function(){
      if(currentLang() === 'ar') setTimeout(applyUniversalLanguage, 0);
    });
    if(document.body) observer.observe(document.body, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
