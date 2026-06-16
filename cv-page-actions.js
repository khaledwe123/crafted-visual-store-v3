(function(){
  function bindPageActions(){
    var actionMap = {
      'toggle-lang': function(){ if (typeof window.toggleLang === 'function') window.toggleLang(); },
      'open-cart': function(){ if (typeof window.openCart === 'function') window.openCart(); },
      'close-cart': function(){ if (typeof window.closeCart === 'function') window.closeCart(); },
      'checkout': function(){ if (typeof window.checkout === 'function') window.checkout(); }
    };
    document.querySelectorAll('[data-action]').forEach(function(el){
      var handler = actionMap[el.dataset.action];
      if (handler && !el.dataset.cvActionBound) {
        el.dataset.cvActionBound = '1';
        el.addEventListener('click', function(ev){ ev.preventDefault(); handler(ev); });
      }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindPageActions);
  else bindPageActions();
})();
