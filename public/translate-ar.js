
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
