/* Crafted Visual UI Dedupe Fix - 20260611
   Keeps one mobile menu, one bottom navigation, and one Furniture Expert button.
   Loaded last to neutralize duplicate UI injected by legacy responsive packs. */
(function(){
  'use strict';
  var running = false;
  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function removeNode(el){ try{ if(el && el.parentNode) el.parentNode.removeChild(el); }catch(e){} }
  function setDisplay(el, value){ try{ if(el) el.style.display = value; }catch(e){} }

  function normalizeMobileMenu(){
    var nav = document.querySelector('.nav');
    if(!nav) return;
    var brand = nav.querySelector('.brand') || nav.firstElementChild;
    var mainMenu = document.getElementById('mainMenu');

    // Remove duplicate menu toggles created by multiple old packs.
    var toggles = Array.prototype.slice.call(nav.querySelectorAll('.cv-hamburger,.ux95-mobile-toggle,.mobile-menu-toggle'));
    var primary = document.getElementById('cvPrimaryMobileMenu');
    if(!primary){
      primary = document.createElement('button');
      primary.id = 'cvPrimaryMobileMenu';
      primary.type = 'button';
      primary.className = 'cv-hamburger cv-primary-mobile-menu';
      primary.setAttribute('aria-label','Open menu');
      primary.setAttribute('aria-expanded','false');
      primary.innerHTML = 'Menu ☰';
      if(brand && brand.nextSibling) nav.insertBefore(primary, brand.nextSibling);
      else nav.insertBefore(primary, nav.firstChild);
    }
    toggles.forEach(function(btn){ if(btn !== primary) removeNode(btn); });

    if(!primary.dataset.cvBound){
      primary.dataset.cvBound = '1';
      primary.addEventListener('click', function(e){
        e.preventDefault();
        var open = !(document.body.classList.contains('cv-menu-open') || document.body.classList.contains('ux95-menu-open') || document.body.classList.contains('mobile-menu-open'));
        document.body.classList.toggle('cv-menu-open', open);
        document.body.classList.toggle('ux95-menu-open', open);
        document.body.classList.toggle('mobile-menu-open', open);
        primary.setAttribute('aria-expanded', open ? 'true' : 'false');
        if(mainMenu) mainMenu.classList.toggle('cv-menu-visible', open);
      });
    }
  }

  function normalizeBottomNav(){
    var navs = Array.prototype.slice.call(document.querySelectorAll('#cvBottomNav,.ux95-bottom-nav,.mobile-bottom-nav'));
    if(!navs.length) return;
    // Keep the premium bottom nav if present; otherwise keep the first one.
    var keep = document.getElementById('cvBottomNav') || document.querySelector('.ux95-bottom-nav') || navs[0];
    navs.forEach(function(n){ if(n !== keep) removeNode(n); });
    if(keep){
      keep.id = 'cvBottomNav';
      keep.classList.add('cv-bottom-nav');
      keep.setAttribute('data-cv-primary-bottom-nav','true');
      setDisplay(keep, '');
    }
  }

  function normalizeFloatingExpert(){
    var widgets = Array.prototype.slice.call(document.querySelectorAll('#floatingExpertWhatsapp,#cvExpertWA,.cj-floating-wa,.ux95-floating-wa'));
    if(!widgets.length) return;
    // Keep the richer customer-journey widget when available.
    var keep = document.getElementById('floatingExpertWhatsapp') || document.getElementById('cvExpertWA') || widgets[0];
    widgets.forEach(function(w){ if(w !== keep) removeNode(w); });
    if(keep){
      keep.id = 'floatingExpertWhatsapp';
      keep.classList.remove('ux95-floating-wa');
      keep.classList.add('cj-floating-wa');
      keep.setAttribute('data-cv-primary-whatsapp','true');
      setDisplay(keep, '');
    }
  }

  function clean(){
    if(running) return;
    running = true;
    try{
      normalizeMobileMenu();
      normalizeBottomNav();
      normalizeFloatingExpert();
    }finally{
      running = false;
    }
  }

  ready(function(){
    clean();
    setTimeout(clean, 100);
    setTimeout(clean, 500);
    setTimeout(clean, 1200);
    setInterval(clean, 2500);
    try{
      new MutationObserver(function(){ clean(); }).observe(document.body, {childList:true, subtree:true});
    }catch(e){}
  });
})();
