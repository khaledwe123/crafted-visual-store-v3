(function(){
  function bindPageActions(){
    var actionMap = {
      // Language toggle is handled by script.js/language-toggle-fix.js only.
      // Keeping it here caused double-toggle behavior on the Arabic button.
      'open-cart': function(){ if (typeof window.openCart === 'function') window.openCart(); },
      'close-cart': function(){ if (typeof window.closeCart === 'function') window.closeCart(); },
      'checkout': function(){ if (typeof window.checkout === 'function') window.checkout(); }
    };
    document.querySelectorAll('[data-action]').forEach(function(el){
      var action = el.dataset.action;
      if(action === 'toggle-lang') return;
      var handler = actionMap[action];
      if (handler && !el.dataset.cvActionBound) {
        el.dataset.cvActionBound = '1';
        el.addEventListener('click', function(ev){ ev.preventDefault(); handler(ev); });
      }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindPageActions);
  else bindPageActions();
})();
