// Admin inline-handler replacement bridge
// Keeps the same admin functions while removing inline onclick/onchange/oninput attributes from admin.html.
(function () {
  'use strict';

  function runNamedAction(actionName, event, element) {
    if (!actionName) return;

    if (actionName === 'prototypeAddToCart') {
      alert('Prototype: item added to cart preview');
      return;
    }

    var fn = window[actionName];
    if (typeof fn === 'function') {
      fn.call(element, event);
      return;
    }

    console.warn('[Admin] Action is not available:', actionName);
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-admin-action]');
    if (!trigger) return;
    event.preventDefault();
    runNamedAction(trigger.getAttribute('data-admin-action'), event, trigger);
  });

  document.addEventListener('input', function (event) {
    var trigger = event.target.closest('[data-admin-input-action]');
    if (!trigger) return;
    runNamedAction(trigger.getAttribute('data-admin-input-action'), event, trigger);
  });

  document.addEventListener('change', function (event) {
    var trigger = event.target.closest('[data-admin-change-action]');
    if (!trigger) return;
    runNamedAction(trigger.getAttribute('data-admin-change-action'), event, trigger);
  });
})();
