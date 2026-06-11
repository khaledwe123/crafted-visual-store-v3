(function(){
  function ready(fn){ if(document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    var nav = document.querySelector('.nav');
    if(nav && !document.querySelector('.mobile-menu-toggle')){
      var btn = document.createElement('button');
      btn.type='button';
      btn.className='mobile-menu-toggle';
      btn.setAttribute('aria-label','Open menu');
      btn.innerHTML='☰ Menu';
      btn.addEventListener('click', function(){ document.body.classList.toggle('mobile-menu-open'); });
      var brand = nav.querySelector('.brand') || nav.firstElementChild;
      if(brand && brand.nextSibling) nav.insertBefore(btn, brand.nextSibling); else nav.appendChild(btn);
    }

    if(!document.querySelector('.mobile-bottom-nav')){
      var bottom = document.createElement('div');
      bottom.className='mobile-bottom-nav';
      bottom.innerHTML = '<a href="index.html"><span>⌂</span>Home</a>'+
        '<a href="shop.html"><span>▦</span>Shop</a>'+
        '<button type="button" data-open-cart><span>🛒</span>Cart</button>'+
        '<a href="account.html"><span>👤</span>Account</a>';
      document.body.appendChild(bottom);
      var cartButton = bottom.querySelector('[data-open-cart]');
      cartButton.addEventListener('click', function(){ if(typeof window.openCart==='function') window.openCart(); else location.href='shop.html'; });
    }

    // Convert product detail actions into a mobile sticky CTA while modal is open.
    var modal = document.getElementById('productModal');
    var cta;
    function syncSticky(){
      if(!modal) return;
      var isOpen = !modal.classList.contains('hidden') && window.innerWidth <= 760;
      if(isOpen && !cta){
        cta = document.createElement('div');
        cta.className='sticky-mobile-cta';
        cta.innerHTML='<div><strong id="stickyMobilePrice">Selected item</strong><small>VAT included</small></div><button type="button">Add to Cart</button>';
        cta.querySelector('button').addEventListener('click', function(){ if(typeof window.addCurrentToCart==='function') window.addCurrentToCart(); });
        document.body.appendChild(cta);
      }
      if(cta){
        cta.style.display = isOpen ? 'grid' : 'none';
        var price = document.getElementById('modalPrice');
        var stickyPrice = document.getElementById('stickyMobilePrice');
        if(price && stickyPrice) stickyPrice.textContent = price.textContent || 'Selected item';
      }
    }
    if(modal){
      new MutationObserver(syncSticky).observe(modal, {attributes:true, attributeFilter:['class']});
      document.addEventListener('click', function(){ setTimeout(syncSticky, 80); });
      window.addEventListener('resize', syncSticky);
      setInterval(syncSticky, 1000);
    }

    // Improve image loading performance on all product/gallery images.
    document.querySelectorAll('img').forEach(function(img){
      if(!img.hasAttribute('loading')) img.setAttribute('loading','lazy');
      if(!img.hasAttribute('decoding')) img.setAttribute('decoding','async');
    });
  });
})();


/* CV RESPONSIVE V2 - embedded menu/bottom nav/sticky CTA */
(function(){
  function ready(fn){ if(document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    var nav = document.querySelector('.nav');
    if(nav && !document.querySelector('.mobile-menu-toggle')){
      var btn = document.createElement('button');
      btn.type='button'; btn.className='mobile-menu-toggle'; btn.setAttribute('aria-label','Open menu'); btn.innerHTML='☰ Menu';
      btn.addEventListener('click', function(){ document.body.classList.toggle('mobile-menu-open'); });
      var brand = nav.querySelector('.brand') || nav.firstElementChild;
      if(brand && brand.nextSibling) nav.insertBefore(btn, brand.nextSibling); else nav.appendChild(btn);
    }
    if(!document.querySelector('.mobile-bottom-nav')){
      var bottom = document.createElement('div');
      bottom.className='mobile-bottom-nav';
      bottom.innerHTML = '<a href="index.html"><span>⌂</span>Home</a><a href="shop.html"><span>▦</span>Shop</a><button type="button" data-open-cart><span>🛒</span>Cart</button><a href="account.html"><span>👤</span>Account</a>';
      document.body.appendChild(bottom);
      var cartButton = bottom.querySelector('[data-open-cart]');
      if(cartButton) cartButton.addEventListener('click', function(){ if(typeof window.openCart==='function') window.openCart(); else location.href='shop.html'; });
    }
    var modal = document.getElementById('productModal');
    var cta;
    function syncSticky(){
      if(!modal) return;
      var isOpen = !modal.classList.contains('hidden') && window.innerWidth <= 760;
      if(isOpen && !cta){
        cta = document.createElement('div'); cta.className='sticky-mobile-cta';
        cta.innerHTML='<div><strong id="stickyMobilePrice">Selected item</strong><small>VAT included</small></div><button type="button">Add to Cart</button>';
        cta.querySelector('button').addEventListener('click', function(){ if(typeof window.addCurrentToCart==='function') window.addCurrentToCart(); });
        document.body.appendChild(cta);
      }
      if(cta){
        cta.style.display = isOpen ? 'grid' : 'none';
        var price = document.getElementById('modalPrice'); var stickyPrice = document.getElementById('stickyMobilePrice');
        if(price && stickyPrice) stickyPrice.textContent = price.textContent || 'Selected item';
      }
    }
    if(modal){ new MutationObserver(syncSticky).observe(modal, {attributes:true, attributeFilter:['class']}); document.addEventListener('click', function(){ setTimeout(syncSticky, 80); }); window.addEventListener('resize', syncSticky); setInterval(syncSticky, 1000); }
    document.querySelectorAll('img').forEach(function(img){ if(!img.hasAttribute('loading')) img.setAttribute('loading','lazy'); if(!img.hasAttribute('decoding')) img.setAttribute('decoding','async'); });
  });
})();
