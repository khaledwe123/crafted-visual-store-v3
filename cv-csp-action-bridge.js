(function(){
  'use strict';
  function parseArgs(argText){
    if(!argText || !argText.trim()) return [];
    var args = [];
    var cur = '';
    var quote = null;
    var esc = false;
    for(var i=0;i<argText.length;i++){
      var ch = argText[i];
      if(esc){ cur += ch; esc=false; continue; }
      if(ch === '\\'){ esc=true; cur += ch; continue; }
      if(quote){ cur += ch; if(ch === quote) quote = null; continue; }
      if(ch === '"' || ch === "'"){ quote = ch; cur += ch; continue; }
      if(ch === ','){ args.push(coerce(cur.trim())); cur=''; continue; }
      cur += ch;
    }
    if(cur.trim()) args.push(coerce(cur.trim()));
    return args;
  }
  function coerce(v){
    if(v === 'this') return null;
    if(v === 'true') return true;
    if(v === 'false') return false;
    if(v === 'null') return null;
    if(/^[-]?\d+(\.\d+)?$/.test(v)) return Number(v);
    var m = /^['"]([\s\S]*)['"]$/.exec(v);
    if(m) return m[1].replace(/\\'/g,"'").replace(/\\"/g,'"');
    return v;
  }
  function captureInlineActions(root){
    (root || document).querySelectorAll('[onclick],[onchange],[oninput]').forEach(function(el){
      ['click','change','input'].forEach(function(type){
        var attr = 'on' + type;
        var code = el.getAttribute(attr);
        if(code){ el.setAttribute('data-cv-' + type, code); el.removeAttribute(attr); }
      });
    });
  }
  function runAction(code, event){
    if(!code) return;
    var calls = String(code).split(';').map(function(x){ return x.trim(); }).filter(Boolean);
    calls.forEach(function(call){
      var m = /^([A-Za-z_$][\w$]*)\((.*)\)$/.exec(call);
      if(!m) return;
      var fn = window[m[1]];
      if(typeof fn !== 'function') return;
      var args = parseArgs(m[2]).map(function(a){ return a === null && /\bthis\b/.test(m[2]) ? event.currentTarget : a; });
      fn.apply(window, args);
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    captureInlineActions(document);
    new MutationObserver(function(muts){ muts.forEach(function(m){ m.addedNodes.forEach(function(n){ if(n.nodeType === 1) captureInlineActions(n); }); }); }).observe(document.documentElement, {childList:true, subtree:true});
  });
  document.addEventListener('click', function(e){
    var el = e.target.closest('[data-cv-click]');
    if(!el) return;
    e.preventDefault();
    runAction(el.getAttribute('data-cv-click'), e);
  }, true);
  document.addEventListener('change', function(e){
    var el = e.target.closest('[data-cv-change]');
    if(el) runAction(el.getAttribute('data-cv-change'), e);
  }, true);
  document.addEventListener('input', function(e){
    var el = e.target.closest('[data-cv-input]');
    if(el) runAction(el.getAttribute('data-cv-input'), e);
  }, true);
})();
