(function(){
  'use strict';

  const pageKey = document.body && document.body.getAttribute('data-policy-page');
  if (!pageKey || !['privacy','terms','cookie','help'].includes(pageKey)) return;

  function asObject(value){
    if (!value) return {};
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (_) { return {}; }
    }
    return {};
  }

  function cleanText(value){
    return String(value || '').trim();
  }

  function escapeHtml(value){
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function paragraphs(text){
    const safe = escapeHtml(text);
    return safe
      .split(/\n\s*\n/g)
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => '<p>' + part.replace(/\n/g, '<br>') + '</p>')
      .join('\n');
  }

  function updateHero(titleEn, titleAr){
    if (titleEn) {
      const h1En = document.querySelector('.page-hero h1[data-lang-block="en"]');
      if (h1En) h1En.textContent = titleEn;
    }
    if (titleAr) {
      const h1Ar = document.querySelector('.page-hero h1[data-lang-block="ar"]');
      if (h1Ar) h1Ar.textContent = titleAr;
    }
  }

  function renderSimple(section){
    if (!section) return;
    const titleEn = cleanText(section.title_en);
    const titleAr = cleanText(section.title_ar);
    const bodyEn = cleanText(section.body_en);
    const bodyAr = cleanText(section.body_ar);
    updateHero(titleEn, titleAr);

    const en = document.querySelector('.legal-content[data-lang-block="en"]');
    const ar = document.querySelector('.legal-content[data-lang-block="ar"]');
    if (en && bodyEn) en.innerHTML = paragraphs(bodyEn);
    if (ar && bodyAr) ar.innerHTML = paragraphs(bodyAr);
    if (ar) ar.setAttribute('dir', 'rtl');
  }

  function renderHelp(section){
    if (!section) return;
    updateHero(cleanText(section.title_en), cleanText(section.title_ar));
    const en = document.querySelector('.legal-content[data-lang-block="en"]');
    const ar = document.querySelector('.legal-content[data-lang-block="ar"]');

    const returnsEn = cleanText(section.returns_en);
    const warrantyEn = cleanText(section.warranty_en);
    const deliveryEn = cleanText(section.delivery_en);
    const returnsAr = cleanText(section.returns_ar);
    const warrantyAr = cleanText(section.warranty_ar);
    const deliveryAr = cleanText(section.delivery_ar);

    if (en && (returnsEn || warrantyEn || deliveryEn)) {
      en.innerHTML = ''
        + (returnsEn ? '<h2>1. Returns Process / Return Policy</h2>' + paragraphs(returnsEn) : '')
        + (warrantyEn ? '<h2>2. Warranty Policy</h2>' + paragraphs(warrantyEn) : '')
        + (deliveryEn ? '<h2>3. Delivery Information</h2>' + paragraphs(deliveryEn) : '');
    }
    if (ar && (returnsAr || warrantyAr || deliveryAr)) {
      ar.innerHTML = ''
        + (returnsAr ? '<h2>١. إجراءات الإرجاع / سياسة الإرجاع</h2>' + paragraphs(returnsAr) : '')
        + (warrantyAr ? '<h2>٢. سياسة الضمان</h2>' + paragraphs(warrantyAr) : '')
        + (deliveryAr ? '<h2>٣. معلومات التوصيل</h2>' + paragraphs(deliveryAr) : '');
      ar.setAttribute('dir', 'rtl');
    }
  }

  async function loadPoliciesLegal(){
    try {
      const res = await fetch('/api/settings', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return;
      const settings = await res.json();
      const policies = asObject(settings.policies_legal);
      if (!policies || !policies[pageKey]) return;
      if (pageKey === 'help') renderHelp(policies.help);
      else renderSimple(policies[pageKey]);
    } catch (_) {
      // Keep the static page content if backend settings are unavailable.
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadPoliciesLegal, { once:true });
  else loadPoliciesLegal();
})();
