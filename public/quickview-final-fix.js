/* Crafted Visual - Quick View / Customize final recovery
   Scope: product card buttons and product modal only. No pricing/admin/backend changes. */
(function(){
  'use strict';
  if(window.__cvQuickViewFinalFix) return;
  window.__cvQuickViewFinalFix = true;

  function norm(v){ return String(v == null ? '' : v).trim(); }
  function lower(v){ return norm(v).toLowerCase(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function money(v){ return 'SAR ' + Math.round(Number(v || 0)).toLocaleString(); }

  function productList(){
    try{ if(Array.isArray(products)) return products; }catch(e){}
    try{ if(Array.isArray(window.products)) return window.products; }catch(e){}
    return [];
  }

  function findProductByAny(id, fromEl){
    const list = productList();
    const sid = norm(id);
    if(sid){
      const found = list.find(function(p){
        return String(p && (p.id || p._dbId || p.sku || p.code)) === sid || String(p && p._dbId) === sid;
      });
      if(found) return found;
    }
    if(fromEl){
      const card = fromEl.closest('[data-product-id], .product-card, .cj-product-card, .card');
      const title = card && card.querySelector('h3, .product-title, [data-product-name]');
      const name = lower(title ? title.textContent : '');
      if(name){
        const byName = list.find(function(p){ return lower(p.name || p.name_en || p.name_ar) === name; });
        if(byName) return byName;
      }
    }
    return null;
  }

  function productIdFrom(el){
    if(!el) return '';
    return el.getAttribute('data-product-id') ||
      el.getAttribute('data-cj-open-product') ||
      el.getAttribute('data-id') ||
      (el.closest('[data-product-id]') && el.closest('[data-product-id]').getAttribute('data-product-id')) ||
      (el.closest('[data-cj-open-product]') && el.closest('[data-cj-open-product]').getAttribute('data-cj-open-product')) || '';
  }

  function actionFromClick(target){
    if(!target || !target.closest) return null;
    const explicit = target.closest('[data-shop-action="quick"], [data-shop-action="customize"], [data-cj-open-product], .quick-view-btn, .customize-btn');
    if(explicit) return explicit;
    const btn = target.closest('button, a');
    if(!btn) return null;
    const t = lower(btn.textContent);
    if(t.includes('quick view') || t.includes('customize') || t.includes('عرض سريع') || t.includes('خصص')) return btn;
    return null;
  }

  function isCustomize(el){
    const action = lower(el.getAttribute('data-shop-action') || el.getAttribute('data-cj-mode') || '');
    const t = lower(el.textContent);
    return action === 'customize' || t.includes('customize') || t.includes('خصص');
  }

  function getName(p){
    try{ if(typeof displayName === 'function') return displayName(p); }catch(e){}
    return p.name || p.name_en || p.name_ar || 'Product';
  }
  function getDesc(p){
    try{ if(typeof displayDesc === 'function') return displayDesc(p) || ''; }catch(e){}
    return p.description || p.description_en || p.description_ar || '';
  }
  function getImage(p, color){
    try{ if(typeof firstImage === 'function' && !color) return firstImage(p); }catch(e){}
    const colors = p.colors || {};
    if(color && colors[color]){
      const set = colors[color];
      if(Array.isArray(set.images) && set.images.length) return set.images[0];
      if(set.image) return set.image;
      if(Array.isArray(set.imageMeta) && set.imageMeta[0] && set.imageMeta[0].url) return set.imageMeta[0].url;
    }
    for(const key in colors){
      const set = colors[key] || {};
      if(Array.isArray(set.images) && set.images.length) return set.images[0];
      if(set.image) return set.image;
      if(Array.isArray(set.imageMeta) && set.imageMeta[0] && set.imageMeta[0].url) return set.imageMeta[0].url;
    }
    if(Array.isArray(p.gallery) && p.gallery.length) return p.gallery[0];
    if(p.image) return p.image;
    return 'assets/products/product_01.png';
  }
  function imageList(p, color){
    const colors = p.colors || {};
    const set = color && colors[color] ? colors[color] : null;
    let arr = [];
    if(set){
      if(Array.isArray(set.images)) arr = arr.concat(set.images);
      if(Array.isArray(set.imageMeta)) arr = arr.concat(set.imageMeta.map(function(m){ return m && m.url; }).filter(Boolean));
      if(set.image) arr.push(set.image);
    }
    if(!arr.length && Array.isArray(p.gallery)) arr = arr.concat(p.gallery);
    const first = getImage(p, color);
    if(first) arr.unshift(first);
    return Array.from(new Set(arr.filter(Boolean)));
  }

  function normalizeForModal(p){
    try{ if(typeof normalizeProduct === 'function') return normalizeProduct(p); }catch(e){}
    return p || {};
  }

  function directOpenProduct(rawProduct, customizeMode){
    const p = normalizeForModal(rawProduct || {});
    if(!p || !(p.id || p._dbId || p.name)) return false;
    try{ currentProduct = p; }catch(e){ window.currentProduct = p; }

    const colorKeys = Object.keys(p.colors || {});
    const initialColor = colorKeys[0] || '';
    try{ window.selectedColor = initialColor; }catch(e){}
    try{ selectedColor = initialColor; }catch(e){}

    const sizeOptions = Array.isArray(p.sizeOptions) && p.sizeOptions.length ? p.sizeOptions : [{label:'Custom Size', price:Number(p.price || 0)}];
    const fabricOptions = Array.isArray(p.fabricOptions) && p.fabricOptions.length ? p.fabricOptions : [{label:'Standard Fabric', sizePrices:{}}];
    try{ selectedSizeOption = sizeOptions[0]; selectedFabricOption = fabricOptions[0]; }catch(e){ window.selectedSizeOption = sizeOptions[0]; window.selectedFabricOption = fabricOptions[0]; }

    const modal = document.getElementById('productModal');
    if(!modal) return false;
    const nameEl = document.getElementById('modalName');
    const descEl = document.getElementById('modalDesc');
    const priceEl = document.getElementById('modalPrice');
    const imageEl = document.getElementById('modalImage');
    const thumbsEl = document.getElementById('thumbs');
    const colorEl = document.getElementById('colorOptions');
    const fabricSelect = document.getElementById('fabricSelect');
    const sizeSelect = document.getElementById('sizeSelect');
    const fabricDesc = document.getElementById('fabricDescription');

    if(nameEl) nameEl.textContent = getName(p);
    if(descEl) descEl.textContent = getDesc(p);

    function setPrice(){
      if(!priceEl) return;
      try{ if(typeof priceHTML === 'function'){ priceEl.innerHTML = priceHTML(p, window.selectedSizeOption || sizeOptions[0], window.selectedFabricOption || fabricOptions[0]); return; } }catch(e){}
      const base = Number((window.selectedSizeOption && window.selectedSizeOption.price) || p.price || 0);
      priceEl.textContent = money(base);
    }
    function setImages(color){
      const imgs = imageList(p, color);
      if(imageEl) imageEl.src = imgs[0] || getImage(p, color);
      if(thumbsEl){
        thumbsEl.innerHTML = imgs.map(function(img, idx){ return '<img src="'+esc(img)+'" class="'+(idx===0?'active':'')+'" data-qv-thumb="'+esc(img)+'" alt="">'; }).join('');
      }
    }
    if(colorEl){
      colorEl.innerHTML = colorKeys.map(function(c, idx){
        const set = p.colors[c] || {};
        return '<button type="button" class="color-chip '+(idx===0?'active':'')+'" data-qv-color="'+esc(c)+'"><span class="color-dot" style="background:'+esc(set.hex || '#ccc')+'"></span><span>'+esc(c)+'</span>'+(set.code ? '<small>'+esc(set.code)+'</small>' : '')+'</button>';
      }).join('');
    }
    if(fabricSelect){
      fabricSelect.innerHTML = fabricOptions.map(function(f, i){ return '<option value="'+i+'">'+esc(f.label || f)+'</option>'; }).join('');
      fabricSelect.value = '0';
    }
    if(sizeSelect){
      sizeSelect.innerHTML = sizeOptions.map(function(s, i){ return '<option value="'+i+'">'+esc(s.label || s)+'</option>'; }).join('');
      sizeSelect.value = '0';
    }
    if(fabricDesc) fabricDesc.textContent = (fabricOptions[0] && (fabricOptions[0].description || fabricOptions[0].description_ar)) || '';
    setImages(initialColor);
    setPrice();

    const badgeId = 'customizeModeBadge';
    let badge = document.getElementById(badgeId);
    if(customizeMode){
      if(!badge && priceEl){
        badge = document.createElement('div');
        badge.id = badgeId;
        badge.className = 'customize-mode-badge';
        badge.style.cssText = 'padding:10px 12px;margin:10px 0;border-radius:12px;background:#fff8e5;border:1px solid #f0d991;font-weight:700;';
        priceEl.insertAdjacentElement('afterend', badge);
      }
      if(badge) badge.textContent = 'Customization mode: choose size, fabric, and color before adding to cart.';
    }else if(badge){
      badge.remove();
    }

    modal.classList.remove('hidden');
    modal.style.display = '';
    document.body.classList.add('modal-open');
    ensureModalStructureVisible();
    cleanDuplicateToolButtons();
    return true;
  }


  function ensureModalStructureVisible(){
    const modal = document.getElementById('productModal');
    if(!modal) return;
    const content = modal.querySelector('.modal-content');
    const grid = modal.querySelector('.modal-grid');
    if(content){
      content.style.maxWidth = content.style.maxWidth || '980px';
      content.style.width = content.style.width || 'min(92vw, 980px)';
      content.style.maxHeight = content.style.maxHeight || '88vh';
      content.style.overflow = content.style.overflow || 'auto';
    }
    if(grid){
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = window.innerWidth < 760 ? '1fr' : '1.05fr .95fr';
      grid.style.gap = '24px';
      grid.style.alignItems = 'start';
    }
  }

  function openProductSafe(product, productId, customizeMode){
    // Production-safe fix: do not call older openProduct/openCustomizeProduct handlers here.
    // Several legacy scripts also patch those functions and can open a half-empty modal.
    // This recovery script owns Quick View / Customize and fills the existing #productModal directly.
    directOpenProduct(product, customizeMode);
    setTimeout(cleanDuplicateToolButtons, 80);
  }

  function cleanDuplicateToolButtons(){
    const modal = document.getElementById('productModal');
    if(!modal) return;
    const keys = [
      {rx:/360/i, seen:false},
      {rx:/room visualizer|مصمم الغرفة/i, seen:false},
      {rx:/measure-in-room|measure in room|القياس/i, seen:false}
    ];
    const buttons = Array.from(modal.querySelectorAll('button, a'));
    buttons.forEach(function(btn){
      const txt = norm(btn.textContent);
      keys.forEach(function(k){
        if(k.rx.test(txt)){
          if(k.seen){
            const wrapper = btn.closest('.ux95-tool-card, .premium-tool-card, .tool-card, .cv-tool-card, .room-tool-card, .cj-tool-card') || btn;
            wrapper.remove();
          }else{
            k.seen = true;
          }
        }
      });
    });
  }

  document.addEventListener('click', function(e){
    const action = actionFromClick(e.target);
    if(!action) return;
    const customize = isCustomize(action);
    const id = productIdFrom(action);
    const product = findProductByAny(id, action);
    if(!product) return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    openProductSafe(product, id || product.id || product._dbId, customize);
  }, true);

  document.addEventListener('click', function(e){
    const colorBtn = e.target && e.target.closest ? e.target.closest('[data-qv-color]') : null;
    if(colorBtn){
      e.preventDefault();
      const color = colorBtn.getAttribute('data-qv-color');
      try{ window.selectedColor = color; }catch(err){}
      document.querySelectorAll('[data-qv-color], #colorOptions .color-chip').forEach(function(b){ b.classList.remove('active'); });
      colorBtn.classList.add('active');
      let p = null; try{ p = currentProduct; }catch(err){ p = window.currentProduct; }
      if(p){
        const imgs = imageList(p, color);
        const main = document.getElementById('modalImage');
        const thumbs = document.getElementById('thumbs');
        if(main) main.src = imgs[0] || getImage(p, color);
        if(thumbs) thumbs.innerHTML = imgs.map(function(img, idx){ return '<img src="'+esc(img)+'" class="'+(idx===0?'active':'')+'" data-qv-thumb="'+esc(img)+'" alt="">'; }).join('');
      }
      return;
    }
    const thumb = e.target && e.target.closest ? e.target.closest('[data-qv-thumb], #thumbs img') : null;
    if(thumb){
      const src = thumb.getAttribute('data-qv-thumb') || thumb.getAttribute('src');
      const main = document.getElementById('modalImage');
      if(main && src) main.src = src;
      document.querySelectorAll('#thumbs img').forEach(function(img){ img.classList.remove('active'); });
      thumb.classList.add('active');
    }
  }, true);

  function closeModalSafe(){
    const modal = document.getElementById('productModal');
    if(!modal) return;
    modal.classList.add('hidden');
    modal.style.display = '';
    document.body.classList.remove('modal-open');
  }
  window.closeModal = closeModalSafe;
  document.addEventListener('click', function(e){
    const modal = document.getElementById('productModal');
    if(!modal || modal.classList.contains('hidden')) return;
    if(e.target === modal || (e.target.closest && e.target.closest('.modal-close, .close, [data-close-modal], [aria-label="Close"], [aria-label="close"]'))){
      e.preventDefault();
      e.stopPropagation();
      closeModalSafe();
    }
  }, true);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeModalSafe(); }, true);

  setInterval(cleanDuplicateToolButtons, 1000);
})();
