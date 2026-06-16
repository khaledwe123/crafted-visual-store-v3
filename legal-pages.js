/* Crafted Visual legal pages language support */
(function(){
  'use strict';
  function lang(){ return (localStorage.getItem('lang') || document.documentElement.lang || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en'; }
  function apply(){
    const l=lang();
    document.documentElement.lang=l;
    document.documentElement.dir=l==='ar'?'rtl':'ltr';
    document.querySelectorAll('[data-lang-block]').forEach(el=>{ el.hidden = el.getAttribute('data-lang-block') !== l; });
    document.querySelectorAll('[data-en][data-ar]').forEach(el=>{ el.textContent = l==='ar' ? el.getAttribute('data-ar') : el.getAttribute('data-en'); });
    document.querySelectorAll('.lang-btn,[data-cv-lang-toggle]').forEach(btn=>{ btn.textContent = l==='ar' ? 'English' : 'عربي'; });
    if(window.cvRenderLegalFooterLinks) window.cvRenderLegalFooterLinks();
  }
  window.toggleLang=function(){
    const next=lang()==='ar'?'en':'ar';
    localStorage.setItem('lang', next);
    apply();
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
