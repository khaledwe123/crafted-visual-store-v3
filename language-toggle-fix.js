/* Crafted Visual Arabic/English toggle hardening
   IMPORTANT: This file is now a fallback only.
   The main site script already binds the Arabic button. Binding it again caused
   double-toggle behavior under CSP, so this file only binds if no existing
   Arabic button listener is detected. */
(function(){
  'use strict';

  function fallbackToggle(){
    try{
      var current = localStorage.getItem('lang') || document.documentElement.lang || 'en';
      var next = String(current).toLowerCase().startsWith('ar') ? 'en' : 'ar';
      localStorage.setItem('lang', next);
      document.documentElement.lang = next;
      document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';

      document.querySelectorAll('.lang-btn, [data-cv-lang-toggle]').forEach(function(btn){
        if(btn.id === 'authBtn') return;
        btn.textContent = next === 'ar' ? 'English' : 'عربي';
      });

      if(typeof window.applyLang === 'function') window.applyLang();
      if(typeof window.renderMenu === 'function') window.renderMenu();
      if(typeof window.renderDynamicCategories === 'function') window.renderDynamicCategories();
      if(typeof window.renderHomeQuickMenu === 'function') window.renderHomeQuickMenu();
      if(typeof window.renderCMS === 'function') window.renderCMS();
      if(typeof window.applySortAndFilter === 'function') window.applySortAndFilter();
      if(typeof window.updateAuthUI === 'function') window.updateAuthUI();
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
    if(!btn) return;

    btn.setAttribute('type','button');
    btn.setAttribute('data-cv-lang-toggle','true');

    // If script.js already attached the Arabic toggle listener, do NOT bind again.
    // Double-binding was causing Arabic -> English immediate toggling.
    if(btn.__cvArabicButtonBound) return;
    if(btn.__cvLanguageToggleBound) return;

    btn.__cvLanguageToggleBound = true;
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      if(typeof window.toggleLang === 'function') window.toggleLang();
      else fallbackToggle();
    }, true);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  setTimeout(bind, 300);
  setTimeout(bind, 900);
  setTimeout(bind, 1800);
})();
