/* Crafted Visual Arabic/English toggle hardening
   Keeps the existing design and translation logic. This file only binds the
   language button safely when inline onclick is blocked by CSP or older cached
   handlers are not available. */
(function(){
  'use strict';
  function fallbackToggle(){
    try{
      var current = localStorage.getItem('lang') || document.documentElement.lang || 'en';
      var next = String(current).toLowerCase().startsWith('ar') ? 'en' : 'ar';
      localStorage.setItem('lang', next);
      document.documentElement.lang = next;
      document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
      document.querySelectorAll('.lang-btn').forEach(function(btn){
        if(btn.id === 'authBtn') return;
        btn.textContent = next === 'ar' ? 'English' : 'عربي';
      });
      if(typeof window.applyLang === 'function') window.applyLang();
      if(typeof window.renderMenu === 'function') window.renderMenu();
      if(typeof window.renderDynamicCategories === 'function') window.renderDynamicCategories();
      if(typeof window.renderHomeQuickMenu === 'function') window.renderHomeQuickMenu();
      if(typeof window.applySortAndFilter === 'function') window.applySortAndFilter();
    }catch(e){ console.warn('Arabic toggle fallback failed', e); }
  }

  function findLanguageButton(){
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.lang-btn, [data-cv-lang-toggle]'));
    return buttons.find(function(btn){
      if(btn.id === 'authBtn') return false;
      var txt = (btn.textContent || '').trim().toLowerCase();
      return btn.hasAttribute('data-cv-lang-toggle') || txt === 'عربي' || txt === 'english' || btn.getAttribute('onclick') === 'toggleLang()';
    });
  }

  function bind(){
    var btn = findLanguageButton();
    if(!btn || btn.__cvLanguageToggleBound) return;
    btn.__cvLanguageToggleBound = true;
    btn.setAttribute('type','button');
    btn.setAttribute('data-cv-lang-toggle','true');
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      if(typeof window.toggleLang === 'function') window.toggleLang();
      else fallbackToggle();
    }, true);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  setTimeout(bind, 300);
  setTimeout(bind, 900);
})();
