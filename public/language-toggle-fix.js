/* CV language toggle bridge
   Restores Arabic/English button after CSP/maintainability cleanup.
   No design or content changes. */
(function(){
  'use strict';
  function currentLang(){ return localStorage.getItem('lang') || window.lang || 'en'; }
  function setButtonLabels(){
    var isAr = currentLang() === 'ar';
    document.querySelectorAll('.lang-btn, [data-lang-toggle]').forEach(function(btn){
      if(btn.id === 'authBtn') return;
      btn.textContent = isAr ? 'English' : 'عربي';
      btn.setAttribute('type','button');
      btn.setAttribute('aria-label', isAr ? 'Switch to English' : 'التبديل إلى العربية');
      btn.setAttribute('title', isAr ? 'Switch to English' : 'التبديل إلى العربية');
    });
  }
  function refreshKnownPages(){
    try{ if(typeof window.applyLang === 'function') window.applyLang(); }catch(e){}
    try{ if(typeof window.renderMenu === 'function') window.renderMenu(); }catch(e){}
    try{ if(typeof window.renderDynamicCategories === 'function') window.renderDynamicCategories(); }catch(e){}
    try{ if(typeof window.renderHomeQuickMenu === 'function') window.renderHomeQuickMenu(); }catch(e){}
    try{ if(typeof window.renderCMS === 'function') window.renderCMS(); }catch(e){}
    try{ if(typeof window.applySortAndFilter === 'function') window.applySortAndFilter(); }catch(e){}
    try{ if(typeof window.updateAuthUI === 'function') window.updateAuthUI(); }catch(e){}
    try{ if(typeof window.renderDynamicPage === 'function') window.renderDynamicPage(); }catch(e){}
    setButtonLabels();
  }
  function toggleLanguage(){
    var next = currentLang() === 'ar' ? 'en' : 'ar';
    localStorage.setItem('lang', next);
    try{ window.lang = next; }catch(e){}
    try{ window.pageLang = next; }catch(e){}
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    if(typeof window.toggleLang === 'function' && !window.toggleLang.__cvBridge){
      try{ window.toggleLang(); return; }catch(e){ console.warn('Native toggleLang failed, using bridge fallback.', e); }
    }
    refreshKnownPages();
  }
  toggleLanguage.__cvBridge = true;
  window.cvToggleLanguage = toggleLanguage;
  if(!window.toggleLang || window.toggleLang.__cvBridge){ window.toggleLang = toggleLanguage; }
  if(!window.togglePageLang || window.togglePageLang.__cvBridge){ window.togglePageLang = toggleLanguage; }
  function bind(){
    document.querySelectorAll('.lang-btn, [data-lang-toggle]').forEach(function(btn){
      if(btn.id === 'authBtn') return;
      btn.removeAttribute('onclick');
      btn.dataset.langToggle = 'true';
      if(btn.__cvLangBound) return;
      btn.__cvLangBound = true;
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        toggleLanguage();
      }, true);
    });
    setButtonLabels();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  setTimeout(bind, 300);
  setTimeout(bind, 1000);
})();
