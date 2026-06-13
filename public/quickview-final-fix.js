/* Crafted Visual - Stable Quick View / Customize recovery
   Scope: shop product action buttons + standalone product modal only.
   Does not change admin, backend, pricing rules, discounts, products, or cart storage. */
(function(){
  'use strict';
  if(window.__cvStableQuickViewModalFix) return;
  window.__cvStableQuickViewModalFix = true;

  function norm(v){ return String(v == null ? '' : v).trim(); }
  function lower(v){ return norm(v).toLowerCase(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function money(v){ return 'SAR ' + Math.round(Number(v || 0)).toLocaleString(); }

  function listProducts(){
    try{ if(Array.isArray(products)) return products; }catch(e){}
    try{ if(Array.isArray(window.products)) return window.products; }catch(e){}
    return [];
  }

  function getProductName(p){
    try{ if(typeof displayName === 'function') return displayName(p); }catch(e){}
    return p.name || p.name_en || p.name_ar || 'Product';
  }
  function getProductDesc(p){
    try{ if(typeof displayDesc === 'function') return displayDesc(p) || ''; }catch(e){}
    return p.description || p.description_en || p.description_ar || '';
  }
  function normalizeProductSafe(p){
    try{ if(typeof normalizeProduct === 'function') return normalizeProduct(p || {}); }catch(e){}
    return p || {};
  }
  function productId(p){ return norm(p && (p.id || p._dbId || p.sku || p.code)); }

  function findProduct(id, fromEl){
    var sid = norm(id);
    var list = listProducts();
    if(sid){
      var found = list.find(function(p){
        return productId(p) === sid || norm(p && p._dbId) === sid || norm(p && p.sku) === sid || norm(p && p.code) === sid;
      });
      if(found) return normalizeProductSafe(found);
    }
    if(fromEl){
      var card = fromEl.closest && fromEl.closest('[data-product-id], .product-card, .cj-product-card, .card');
      var title = card && card.querySelector('h3, .product-title, [data-product-name]');
      var name = lower(title ? title.textContent : '');
      if(name){
        var byName = list.find(function(p){ return lower(p.name || p.name_en || p.name_ar) === name; });
        if(byName) return normalizeProductSafe(byName);
      }
      var img = card && card.querySelector('img');
      if(title || img){
        return normalizeProductSafe({
          id: sid || 'card-' + Date.now(),
          name: title ? title.textContent : 'Product',
          price: 0,
          colors: {Standard:{hex:'#cccccc', images: img && img.src ? [img.src] : []}},
          gallery: img && img.src ? [img.src] : []
        });
      }
    }
    return null;
  }

  function buttonAction(target){
    if(!target || !target.closest) return null;
    var el = target.closest('[data-cj-open-product], [data-shop-action="quick"], [data-shop-action="customize"], .quick-view-btn, .customize-btn, button, a');
    if(!el) return null;
    var action = lower(el.getAttribute('data-shop-action') || el.getAttribute('data-cj-mode') || '');
    var text = lower(el.textContent || '');
    var isQuick = action === 'quick' || text.indexOf('quick view') >= 0 || text.indexOf('عرض سريع') >= 0 || el.hasAttribute('data-cj-open-product');
    var isCustomize = action === 'customize' || text.indexOf('customize') >= 0 || text.indexOf('خصص') >= 0;
    if(!isQuick && !isCustomize) return null;
    return {el:el, customize:isCustomize};
  }
  function idFromButton(el){
    return norm(el.getAttribute('data-product-id') || el.getAttribute('data-cj-open-product') || el.getAttribute('data-id') ||
      (el.closest('[data-product-id]') && el.closest('[data-product-id]').getAttribute('data-product-id')) || '');
  }

  function colorKeys(p){ return Object.keys(p.colors || {}); }
  function colorSet(p, color){ return (p.colors || {})[color] || {}; }
  function imagesForColor(p, color){
    var set = color ? colorSet(p, color) : null;
    var out = [];
    function add(v){ if(v && out.indexOf(v) < 0) out.push(v); }
    if(set){
      if(Array.isArray(set.images)) set.images.forEach(add);
      if(Array.isArray(set.imageMeta)) set.imageMeta.forEach(function(m){ add(m && m.url); });
      add(set.image);
    }
    if(!out.length){
      colorKeys(p).forEach(function(c){
        var s = colorSet(p, c);
        if(Array.isArray(s.images)) s.images.forEach(add);
        if(Array.isArray(s.imageMeta)) s.imageMeta.forEach(function(m){ add(m && m.url); });
        add(s.image);
      });
    }
    if(Array.isArray(p.gallery)) p.gallery.forEach(add);
    add(p.image);
    if(!out.length) add('assets/products/product_01.png');
    return out;
  }

  function sizeOptions(p){
    return Array.isArray(p.sizeOptions) && p.sizeOptions.length ? p.sizeOptions : [{label:'Custom Size', price:Number(p.price || 0)}];
  }
  function fabricOptions(p){
    return Array.isArray(p.fabricOptions) && p.fabricOptions.length ? p.fabricOptions : [{label:'Standard Fabric', description:'', sizePrices:{}}];
  }

  function priceHtml(p, size, fabric){
    try{ if(typeof priceHTML === 'function') return priceHTML(p, size, fabric); }catch(e){}
    var base = Number((size && size.price) || p.price || 0);
    var vat = Number(p.vatRate || (window.settings && settings.vat_rate) || 15);
    return '<div class="price-detail"><div>Total incl. VAT: <strong>'+money(base * (1 + vat/100))+'</strong></div></div>';
  }

  function ensureModal(){
    var modal = document.getElementById('cvStableQuickViewModal');
    if(modal) return modal;
    modal = document.createElement('div');
    modal.id = 'cvStableQuickViewModal';
    modal.className = 'cv-stable-qv-modal hidden';
    modal.innerHTML = '<div class="cv-stable-qv-backdrop" data-cv-qv-close="true"></div><div class="cv-stable-qv-dialog" role="dialog" aria-modal="true"><button type="button" class="cv-stable-qv-close" data-cv-qv-close="true" aria-label="Close">×</button><div id="cvStableQuickViewBody"></div></div>';
    document.body.appendChild(modal);
    if(!document.getElementById('cvStableQuickViewStyles')){
      var style = document.createElement('style');
      style.id = 'cvStableQuickViewStyles';
      style.textContent = '\n.cv-stable-qv-modal.hidden{display:none!important}.cv-stable-qv-modal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center}.cv-stable-qv-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.58)}.cv-stable-qv-dialog{position:relative;background:#fff;border-radius:24px;width:min(92vw,980px);max-height:88vh;overflow:auto;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:24px}.cv-stable-qv-close{position:absolute;top:16px;right:16px;z-index:3;width:42px;height:42px;border-radius:50%;border:1px solid #e3ddd4;background:#fff;font-size:28px;line-height:1;cursor:pointer}.cv-stable-qv-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:26px;align-items:start}.cv-stable-qv-main-img{width:100%;max-height:560px;object-fit:cover;border-radius:18px;background:#f5f2ec}.cv-stable-qv-thumbs{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.cv-stable-qv-thumbs img{width:74px;height:58px;object-fit:cover;border-radius:10px;border:2px solid transparent;cursor:pointer}.cv-stable-qv-thumbs img.active{border-color:#174a3d}.cv-stable-qv-info h2{margin:0 44px 12px 0;font-size:34px;color:#211d1a}.cv-stable-qv-desc{color:#4f4b46;margin-bottom:16px}.cv-stable-qv-label{display:block;margin:14px 0 8px;font-weight:700}.cv-stable-qv-colors{display:flex;gap:10px;flex-wrap:wrap}.cv-stable-qv-color{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid #dfd7ca;border-radius:12px;background:#fff;cursor:pointer}.cv-stable-qv-color.active{border-color:#174a3d;box-shadow:0 0 0 2px rgba(23,74,61,.12)}.cv-stable-qv-dot{width:18px;height:18px;border-radius:50%;display:inline-block;border:1px solid rgba(0,0,0,.12)}.cv-stable-qv-select{width:100%;padding:13px;border-radius:12px;border:1px solid #dfd7ca;background:#fff}.cv-stable-qv-fabric-desc{background:#f5efe6;border-radius:10px;padding:10px;margin:8px 0 0;color:#665f57}.cv-stable-qv-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.cv-stable-qv-actions .btn{border-radius:999px;padding:13px 24px;font-weight:800}.cv-stable-qv-tools{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.cv-stable-qv-tools button{border-radius:14px;border:1px solid #eadcc8;background:#fbf5ec;padding:12px;font-weight:800;color:#174a3d}.cv-stable-qv-trust{margin-top:18px;border:1px solid #eee4d8;border-radius:18px;padding:16px}.cv-stable-qv-stars{color:#b78728;font-size:22px;letter-spacing:2px}@media(max-width:760px){.cv-stable-qv-dialog{padding:16px;width:94vw}.cv-stable-qv-grid{grid-template-columns:1fr}.cv-stable-qv-info h2{font-size:26px}.cv-stable-qv-tools{grid-template-columns:1fr}}\n';
      document.head.appendChild(style);
    }
    return modal;
  }

  function closeOurModal(){
    var modal = document.getElementById('cvStableQuickViewModal');
    if(modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function hideLegacyModal(){
    var legacy = document.getElementById('productModal');
    if(legacy){ legacy.classList.add('hidden'); legacy.style.display = 'none'; }
  }

  function openStableModal(product, customize){
    var p = normalizeProductSafe(product);
    if(!p) return;
    try{ window.currentProduct = p; currentProduct = p; }catch(e){}
    var sizes = sizeOptions(p);
    var fabrics = fabricOptions(p);
    var colors = colorKeys(p);
    var selectedColor = colors[0] || '';
    var selectedSize = sizes[0];
    var selectedFabric = fabrics[0];
    try{ window.selectedColor = selectedColor; window.selectedSizeOption = selectedSize; window.selectedFabricOption = selectedFabric; selectedColor = selectedColor; selectedSizeOption = selectedSize; selectedFabricOption = selectedFabric; }catch(e){}

    var modal = ensureModal();
    var body = document.getElementById('cvStableQuickViewBody');
    var imgs = imagesForColor(p, selectedColor);
    body.innerHTML = '<div class="cv-stable-qv-grid">'+
      '<div class="cv-stable-qv-media"><img class="cv-stable-qv-main-img" id="cvStableQvMainImg" src="'+esc(imgs[0])+'" alt="'+esc(getProductName(p))+'"><div class="cv-stable-qv-thumbs" id="cvStableQvThumbs">'+imgs.map(function(img,i){return '<img src="'+esc(img)+'" data-cv-qv-thumb="'+esc(img)+'" class="'+(i===0?'active':'')+'" alt="">';}).join('')+'</div></div>'+
      '<div class="cv-stable-qv-info"><h2>'+esc(getProductName(p))+'</h2><p class="cv-stable-qv-desc">'+esc(getProductDesc(p))+'</p><div id="cvStableQvPrice">'+priceHtml(p, selectedSize, selectedFabric)+'</div>'+(customize?'<div class="customize-mode-badge" style="padding:10px 12px;margin:10px 0;border-radius:12px;background:#fff8e5;border:1px solid #f0d991;font-weight:700;">Customization mode: choose size, fabric, and color before adding to cart.</div>':'')+
      '<div class="cv-stable-qv-rating"><strong>Customer Rating:</strong><div class="cv-stable-qv-stars">★★★★★</div><small>Rate this item</small></div>'+ 
      '<label class="cv-stable-qv-label">Color</label><div class="cv-stable-qv-colors" id="cvStableQvColors">'+colors.map(function(c,i){var s=colorSet(p,c);return '<button type="button" class="cv-stable-qv-color '+(i===0?'active':'')+'" data-cv-qv-color="'+esc(c)+'"><span class="cv-stable-qv-dot" style="background:'+esc(s.hex || '#ccc')+'"></span><span>'+esc(c)+'</span>'+(s.code?'<small>'+esc(s.code)+'</small>':'')+'</button>';}).join('')+'</div>'+ 
      '<label class="cv-stable-qv-label">Fabric</label><select class="cv-stable-qv-select" id="cvStableQvFabric">'+fabrics.map(function(f,i){return '<option value="'+i+'">'+esc(f.label || f)+'</option>';}).join('')+'</select><div class="cv-stable-qv-fabric-desc" id="cvStableQvFabricDesc">'+esc((selectedFabric && (selectedFabric.description || selectedFabric.description_ar)) || '')+'</div>'+ 
      '<label class="cv-stable-qv-label">Size</label><select class="cv-stable-qv-select" id="cvStableQvSize">'+sizes.map(function(s,i){return '<option value="'+i+'">'+esc(s.label || s)+'</option>';}).join('')+'</select>'+ 
      '<div class="cv-stable-qv-tools"><button type="button" data-ux95-tool="360">360° View</button><button type="button" data-ux95-tool="room">Room Visualizer</button><button type="button" data-ux95-tool="measure">Measure-in-Room</button></div>'+ 
      '<div class="cv-stable-qv-actions"><button type="button" class="btn primary" id="cvStableQvAddCart">Add to Cart</button><button type="button" class="btn secondary" id="cvStableQvWhatsapp">WhatsApp Inquiry</button></div>'+ 
      '<div class="cv-stable-qv-trust"><div class="cv-stable-qv-stars">★★★★★</div><strong>Reviews & Trust</strong><p>Warranty included • Secure inquiry • Furniture specialist support</p></div></div></div>';

    function syncGlobals(){
      try{ window.currentProduct = p; currentProduct = p; window.selectedColor = selectedColor; selectedColor = selectedColor; window.selectedSizeOption = selectedSize; selectedSizeOption = selectedSize; window.selectedFabricOption = selectedFabric; selectedFabricOption = selectedFabric; }catch(e){}
    }
    function refreshPrice(){
      var price = document.getElementById('cvStableQvPrice');
      if(price) price.innerHTML = priceHtml(p, selectedSize, selectedFabric);
      syncGlobals();
    }
    document.getElementById('cvStableQvColors')?.addEventListener('click', function(e){
      var btn = e.target.closest('[data-cv-qv-color]');
      if(!btn) return;
      selectedColor = btn.getAttribute('data-cv-qv-color') || '';
      syncGlobals();
      body.querySelectorAll('[data-cv-qv-color]').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var nextImgs = imagesForColor(p, selectedColor);
      var main = document.getElementById('cvStableQvMainImg');
      var thumbs = document.getElementById('cvStableQvThumbs');
      if(main) main.src = nextImgs[0] || '';
      if(thumbs) thumbs.innerHTML = nextImgs.map(function(img,i){return '<img src="'+esc(img)+'" data-cv-qv-thumb="'+esc(img)+'" class="'+(i===0?'active':'')+'" alt="">';}).join('');
    });
    document.getElementById('cvStableQvThumbs')?.addEventListener('click', function(e){
      var thumb = e.target.closest('[data-cv-qv-thumb]');
      if(!thumb) return;
      var src = thumb.getAttribute('data-cv-qv-thumb');
      var main = document.getElementById('cvStableQvMainImg');
      if(main && src) main.src = src;
      body.querySelectorAll('[data-cv-qv-thumb]').forEach(function(t){ t.classList.remove('active'); });
      thumb.classList.add('active');
    });
    document.getElementById('cvStableQvFabric')?.addEventListener('change', function(e){
      selectedFabric = fabrics[Number(e.target.value || 0)] || fabrics[0];
      var desc = document.getElementById('cvStableQvFabricDesc');
      if(desc) desc.textContent = (selectedFabric && (selectedFabric.description || selectedFabric.description_ar)) || '';
      refreshPrice();
    });
    document.getElementById('cvStableQvSize')?.addEventListener('change', function(e){
      selectedSize = sizes[Number(e.target.value || 0)] || sizes[0];
      refreshPrice();
    });
    document.getElementById('cvStableQvAddCart')?.addEventListener('click', function(){
      syncGlobals();
      if(typeof addCurrentToCart === 'function') addCurrentToCart();
    });
    document.getElementById('cvStableQvWhatsapp')?.addEventListener('click', function(){
      syncGlobals();
      if(typeof whatsappCurrent === 'function') whatsappCurrent();
    });

    hideLegacyModal();
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function handleProductAction(e){
    var action = buttonAction(e.target);
    if(!action) return;
    var id = idFromButton(action.el);
    var p = findProduct(id, action.el);
    if(!p) return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    openStableModal(p, action.customize);
  }

  // Use window capture so this handler runs before older document-level handlers.
  window.addEventListener('click', handleProductAction, true);

  // Override legacy functions too, so any older scripts that call openProduct/openCustomizeProduct use this stable modal.
  window.openProduct = function(id){ var p = findProduct(id, null); if(p) openStableModal(p, false); };
  window.openCustomizeProduct = function(id){ var p = findProduct(id, null); if(p) openStableModal(p, true); };

  window.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('[data-cv-qv-close]')){
      e.preventDefault();
      closeOurModal();
    }
  }, true);
  window.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeOurModal(); }, true);
})();
