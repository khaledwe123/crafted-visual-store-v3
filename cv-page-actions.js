/* Crafted Visual page action bindings
   Externalized from index.html so strict CSP does not block Arabic/cart actions. */
(function(){
  'use strict';
  function bindPageActions(){
    var actionMap = {
      'toggle-lang': function(){ if (typeof window.toggleLang === 'function') window.toggleLang(); },
      'open-cart': function(){ if (typeof window.openCart === 'function') window.openCart(); },
      'close-cart': function(){ if (typeof window.closeCart === 'function') window.closeCart(); },
      'checkout': function(){ if (typeof window.checkout === 'function') window.checkout(); }
    };
    document.querySelectorAll('[data-action]').forEach(function(el){
      if(el.__cvPageActionBound) return;
      var handler = actionMap[el.dataset.action];
      if(!handler) return;
      el.__cvPageActionBound = true;
      el.addEventListener('click', function(e){
        e.preventDefault();
        handler(e);
      });
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindPageActions);
  else bindPageActions();
  setTimeout(bindPageActions, 300);
})();
