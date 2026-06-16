document.addEventListener('DOMContentLoaded', function(){
  const actionMap = {
    'toggle-lang': function(){ if (typeof toggleLang === 'function') toggleLang(); },
    'open-cart': function(){ if (typeof openCart === 'function') openCart(); },
    'close-cart': function(){ if (typeof closeCart === 'function') closeCart(); },
    'checkout': function(){ if (typeof checkout === 'function') checkout(); }
  };
  document.querySelectorAll('[data-action]').forEach(function(el){
    const handler = actionMap[el.dataset.action];
    if(handler) el.addEventListener('click', handler);
  });
});
