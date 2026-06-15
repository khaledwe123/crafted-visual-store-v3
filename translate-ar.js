/* Crafted Visual Arabic Auto Translation Engine
   Scope: translation only. Does not change layout, pricing, discounts, login, payment, or backend logic. */
(function(){
  'use strict';

  const CV_TRANSLATION_MAP = {
    "crafted visual":"كرافتد فيزوال",
    "crafted visuals":"كرافتد فيزوال",
    "crafted visual cms":"كرافتد فيزوال CMS",
    "crafted visual furniture":"كرافتد فيزوال للأثاث",
    "contact crafted visual":"تواصل مع كرافتد فيزوال",
    "home":"الرئيسية",
    "about us":"من نحن",
    "shop":"المتجر",
    "custom order":"طلب تفصيل",
    "track order":"تتبع الطلب",
    "my account":"حسابي",
    "contact us":"تواصل معنا",
    "discounts":"التخفيضات",
    "discounted items":"التخفيضات",
    "sign in":"تسجيل الدخول",
    "register":"تسجيل الدخول",
    "cart":"السلة",
    "checkout":"الدفع",
    "submit order":"إرسال الطلب",
    "pay now":"الدفع الآن",
    "open shop":"فتح المتجر",
    "quick view":"عرض سريع",
    "customize":"تخصيص",
    "add to cart":"إضافة إلى السلة",
    "add to wishlist":"إضافة إلى المفضلة",
    "whatsapp inquiry":"استفسار واتساب",
    "whatsapp furniture expert":"خبير الأثاث عبر واتساب",
    "furniture expert":"خبير الأثاث",

    "premium sofas":"كنبات فخمة",
    "luxury furniture":"مفروشات فخمة",
    "l shape sofas":"كنبات زاوية",
    "l shape sofa":"كنبة زاوية",
    "beds":"أسرة",
    "bed":"سرير",
    "single chairs":"كراسي مفردة",
    "single chair":"كرسي مفرد",
    "dining tables":"طاولات طعام",
    "coffee tables":"طاولات قهوة",
    "tv units":"وحدات تلفاز",
    "wardrobes":"خزائن ملابس",
    "custom furniture":"أثاث حسب الطلب",
    "modern":"عصري",
    "luxury":"فاخر",
    "premium":"فاخر",
    "classic":"كلاسيكي",
    "contemporary":"معاصر",
    "with storage":"مع تخزين",
    "storage":"تخزين",
    "sofa":"كنبة",
    "chair":"كرسي",
    "table":"طاولة",
    "green":"أخضر",
    "dark green":"أخضر داكن",
    "olive green":"أخضر زيتوني",
    "beige":"بيج",
    "white":"أبيض",
    "black":"أسود",
    "grey":"رمادي",
    "gray":"رمادي",
    "brown":"بني",
    "yellow":"أصفر",
    "velvet":"مخمل",
    "linen":"كتان",
    "boucle":"بوكليه",
    "bouclé":"بوكليه",
    "leather":"جلد",
    "performance fabric":"قماش عملي",
    "fabric":"قماش",
    "soft":"ناعم",
    "comfortable":"مريح",
    "durable":"متين",
    "elegant":"أنيق",
    "natural":"طبيعي",
    "wood":"خشب",
    "custom size":"مقاس حسب الطلب",
    "queen":"كوين",
    "king":"كينغ",
    "super king":"سوبر كينغ",

    "contact information":"معلومات التواصل",
    "send inquiry":"إرسال استفسار",
    "whatsapp":"واتساب",
    "whatsapp:":"واتساب:",
    "chat with us":"تواصل معنا",
    "email":"البريد الإلكتروني",
    "email:":"البريد الإلكتروني:",
    "location":"الموقع",
    "location:":"الموقع:",
    "riyadh, saudi arabia":"الرياض، المملكة العربية السعودية",
    "location: riyadh, saudi arabia":"الموقع: الرياض، المملكة العربية السعودية",
    "working hours":"ساعات العمل",
    "working hours:":"ساعات العمل:",
    "saturday to thursday":"السبت إلى الخميس",
    "saturday to thursday, 9:00 am - 9:00 pm":"السبت إلى الخميس، ٩:٠٠ صباحاً - ٩:٠٠ مساءً",
    "working hours: saturday to thursday, 9:00 am - 9:00 pm":"ساعات العمل: السبت إلى الخميس، ٩:٠٠ صباحاً - ٩:٠٠ مساءً",
    "for furniture inquiries, custom orders, delivery, after-sales support, and project requests.":"لاستفسارات الأثاث والطلبات الخاصة والتوصيل وخدمة ما بعد البيع وطلبات المشاريع.",
    "full name":"الاسم الكامل",
    "mobile number":"رقم الجوال",
    "phone number":"رقم الجوال",
    "message":"الرسالة",
    "product inquiry":"استفسار عن منتج",
    "custom furniture":"أثاث حسب الطلب",
    "delivery follow-up":"متابعة التوصيل",
    "after-sales support":"خدمة ما بعد البيع",
    "project / b2b request":"طلب مشروع / شركات",
    "please add name, mobile and message.":"يرجى إضافة الاسم ورقم الجوال والرسالة.",
    "inquiry saved and whatsapp message prepared.":"تم حفظ الاستفسار وتجهيز رسالة واتساب.",

    "view product":"عرض المنتج",
    "view all":"عرض الكل",
    "all categories":"كل الفئات",
    "product category":"فئة المنتج",
    "color":"اللون",
    "size":"المقاس",
    "price":"السعر",
    "price before vat":"السعر قبل الضريبة",
    "vat":"ضريبة القيمة المضافة",
    "total incl. vat":"الإجمالي شامل الضريبة",
    "selected price before vat":"السعر المحدد قبل الضريبة",
    "customer rating":"تقييم العملاء",
    "rate this item":"قيّم هذا المنتج",
    "rating":"التقييم",
    "write first review":"اكتب أول تقييم",
    "no ratings":"لا توجد تقييمات",
    "made to order":"تفصيل حسب الطلب",
    "made to order: 15–20 working days":"تفصيل حسب الطلب: ١٥–٢٠ يوم عمل",
    "vat included":"شامل ضريبة القيمة المضافة",
    "custom dimensions":"مقاسات مخصصة",
    "room visualizer":"تصور الغرفة",
    "measure-in-room":"القياس داخل الغرفة",
    "360° view":"عرض ٣٦٠°",

    "track your order":"تتبع طلبك",
    "enter the full order number exactly as received.":"أدخل رقم الطلب الكامل كما وصل إليك.",
    "delivery address":"عنوان التوصيل",
    "building / villa / apartment":"المبنى / الفيلا / الشقة",
    "additional notes":"ملاحظات إضافية",
    "save account":"حفظ الحساب",
    "logout":"تسجيل الخروج"
  };

  function normalizeKey(text){
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function escapeRegExp(value){
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function cvTitleCaseArabicFallback(text){
    return String(text || '').trim();
  }

  function autoTranslateToArabic(text){
    if(!text) return '';
    let original = String(text);
    let trimmed = original.trim();
    if(!trimmed) return original;
    let lower = normalizeKey(trimmed);
    if(CV_TRANSLATION_MAP[lower]) return CV_TRANSLATION_MAP[lower];

    let result = trimmed;
    Object.keys(CV_TRANSLATION_MAP).sort((a,b)=>b.length-a.length).forEach(key=>{
      const re = new RegExp('(^|\\b)' + escapeRegExp(key) + '(\\b|$)', 'gi');
      result = result.replace(re, function(match, pre, post){
        const clean = match.replace(/^\b|\b$/g, '');
        return (pre || '') + (CV_TRANSLATION_MAP[normalizeKey(clean)] || CV_TRANSLATION_MAP[key]) + (post || '');
      });
    });

    result = result
      .replace(/Crafted Visuals?/gi, 'كرافتد فيزوال')
      .replace(/cm\b/gi, 'سم')
      .replace(/SAR\b/gi, 'ريال')
      .replace(/\bAM\b/g, 'صباحاً')
      .replace(/\bPM\b/g, 'مساءً')
      .replace(/\bx\b/gi, '×')
      .replace(/custom/gi, 'حسب الطلب')
      .replace(/request/gi, 'طلب')
      .replace(/description/gi, 'الوصف')
      .replace(/color/gi, 'اللون')
      .replace(/size/gi, 'المقاس');

    return result === trimmed ? cvTitleCaseArabicFallback(trimmed) : result;
  }

  function ensureArabic(en, ar){
    return String(ar || '').trim() || autoTranslateToArabic(en || '');
  }

  function isArabicActive(){
    return (localStorage.getItem('lang') || document.documentElement.lang || 'en').toLowerCase().startsWith('ar');
  }

  function shouldSkipElement(el){
    if(!el || !el.tagName) return true;
    return ['SCRIPT','STYLE','NOSCRIPT','CODE','PRE','TEXTAREA'].includes(el.tagName) || el.closest('[data-no-auto-translate], .no-translate');
  }

  function translateTextNode(node){
    if(!node || !node.nodeValue || !node.nodeValue.trim()) return;
    const parent = node.parentElement;
    if(!parent || shouldSkipElement(parent)) return;
    const value = node.nodeValue;
    const leading = value.match(/^\s*/)[0];
    const trailing = value.match(/\s*$/)[0];
    const translated = autoTranslateToArabic(value.trim());
    if(translated && translated !== value.trim()) node.nodeValue = leading + translated + trailing;
  }

  function translateAttributes(root){
    const phMap = CV_TRANSLATION_MAP;
    (root.querySelectorAll ? root.querySelectorAll('input, textarea, select, option, img, a, button') : []).forEach(el=>{
      if(shouldSkipElement(el)) return;
      ['placeholder','title','alt','aria-label'].forEach(attr=>{
        const val = el.getAttribute && el.getAttribute(attr);
        if(val && val.trim()){
          const translated = autoTranslateToArabic(val);
          if(translated && translated !== val) el.setAttribute(attr, translated);
        }
      });
      if(el.tagName === 'OPTION'){
        const t = (el.textContent || '').trim();
        const translated = autoTranslateToArabic(t);
        if(translated && translated !== t) el.textContent = translated;
      }
    });
  }

  function translateBrandEverywhere(root){
    (root.querySelectorAll ? root.querySelectorAll('body *') : []).forEach(el=>{
      if(shouldSkipElement(el)) return;
      if(el.childNodes && el.childNodes.length === 1 && el.childNodes[0].nodeType === 3){
        const t = el.textContent || '';
        if(/Crafted Visual/i.test(t)) el.textContent = t.replace(/Crafted Visuals?/gi, 'كرافتد فيزوال');
      }
    });
  }

  let observer = null;
  let scheduled = false;
  function translatePage(){
    if(!isArabicActive() || !document.body) return;
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if(!p || shouldSkipElement(p)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(translateTextNode);
    translateAttributes(document.body);
    translateBrandEverywhere(document);
  }

  function scheduleTranslate(){
    if(!isArabicActive()) return;
    if(scheduled) return;
    scheduled = true;
    setTimeout(function(){ scheduled = false; translatePage(); }, 60);
  }

  function startObserver(){
    if(observer || !document.body) return;
    observer = new MutationObserver(scheduleTranslate);
    observer.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['placeholder','title','alt','aria-label']});
  }

  function init(){
    translatePage();
    startObserver();
    setTimeout(translatePage, 250);
    setTimeout(translatePage, 900);
    setTimeout(translatePage, 1800);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Expose existing helper names used by the main site scripts.
  window.CV_TRANSLATION_MAP = CV_TRANSLATION_MAP;
  window.cvTitleCaseArabicFallback = cvTitleCaseArabicFallback;
  window.autoTranslateToArabic = autoTranslateToArabic;
  window.ensureArabic = ensureArabic;
  window.cvApplyArabicAutoTranslation = translatePage;
})();
