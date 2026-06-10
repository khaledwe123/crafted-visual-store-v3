(function(){
  const LS = {
    wishlist:'cv_wishlist_ids',
    viewed:'cv_recently_viewed_products',
    reviews:'cv_product_reviews'
  };
  function safeJSON(key, fallback){ try{return JSON.parse(localStorage.getItem(key)||'')||fallback;}catch{return fallback;} }
  function saveJSON(key,val){ try{localStorage.setItem(key, JSON.stringify(val));}catch(e){} }
  function text(en, ar){ return (window.lang === 'ar') ? ar : en; }
  function esc(v){ return String(v==null?'':v).replace(/[&<>'"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }
  function productName(p){ try{return window.displayName ? displayName(p) : (p.name || p.name_en || 'Product');}catch{return p.name || p.name_en || 'Product';} }
  function productCat(p){ try{return window.displayCategory ? displayCategory(p) : (p.category || p.category_name || '');}catch{return p.category || p.category_name || '';}}
  function imgFor(p){ try{return window.firstImage ? firstImage(p) : ((p.gallery&&p.gallery[0]) || 'assets/products/product_01.png');}catch{return 'assets/products/product_01.png';}}
  function money(v){ return 'SAR ' + Number(v||0).toLocaleString(); }
  function eventTrack(event, meta){
    try{ if(window.trackEvent) window.trackEvent(event, meta||{}); }catch(e){}
    try{
      fetch('/api/journey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({event_type:event,page_url:location.pathname,page_title:document.title}, meta||{}))});
    }catch(e){}
  }

  function wishlist(){ return safeJSON(LS.wishlist, []); }
  function isWish(id){ return wishlist().map(String).includes(String(id)); }
  window.cvToggleWishlist = function(id, ev){
    if(ev) ev.stopPropagation();
    let list = wishlist();
    const sid = String(id);
    if(list.map(String).includes(sid)) list = list.filter(x=>String(x)!==sid); else list.push(id);
    saveJSON(LS.wishlist, list);
    eventTrack('wishlist_toggle', {product_id:id});
    if(window.applySortAndFilter) applySortAndFilter();
    renderWishlistShelf();
  };

  function pushRecent(p){
    if(!p || !p.id) return;
    let list = safeJSON(LS.viewed, []);
    list = list.filter(x=>String(x.id)!==String(p.id));
    list.unshift({id:p.id,name:p.name||p.name_en,name_ar:p.name_ar,category:p.category||p.category_name,image:imgFor(p),price:(window.finalPrice?finalPrice(p):p.price)});
    saveJSON(LS.viewed, list.slice(0,12));
  }

  function findProduct(id){ return (window.products||[]).find(p=>String(p.id)===String(id)); }
  function tinyCard(p){
    return `<div class="cj-tiny-card" onclick="${findProduct(p.id)?`openProduct('${esc(p.id)}')`:`location.href='shop.html'`}">
      <img src="${esc(p.image||imgFor(p))}" alt="${esc(p.name||'Product')}">
      <strong>${esc((window.lang==='ar' && p.name_ar) ? p.name_ar : (p.name||'Product'))}</strong>
      <small>${esc(p.category||'')}</small>
      <span>${money(p.price||0)}</span>
    </div>`;
  }
  function ensureShelf(id, titleEn, titleAr, afterSelector){
    let s = document.getElementById(id);
    if(!s){
      s = document.createElement('section');
      s.id = id;
      s.className = 'cj-shelf';
      s.innerHTML = `<div class="cj-section-head"><h2></h2><a href="shop.html">${text('View All','عرض الكل')}</a></div><div class="cj-shelf-grid"></div>`;
      const anchor = document.querySelector(afterSelector) || document.querySelector('footer') || document.body;
      anchor.parentNode.insertBefore(s, anchor.nextSibling);
    }
    s.querySelector('h2').textContent = text(titleEn,titleAr);
    return s;
  }
  function renderRecentlyViewed(){
    const list = safeJSON(LS.viewed, []);
    if(!list.length) return;
    const shelf = ensureShelf('recentlyViewedShelf','Recently Viewed','شوهدت مؤخراً','#shop, .intro, .page-hero');
    shelf.querySelector('.cj-shelf-grid').innerHTML = list.slice(0,4).map(tinyCard).join('');
  }
  function renderWishlistShelf(){
    const ids = wishlist();
    if(!ids.length){ const old=document.getElementById('wishlistShelf'); if(old) old.remove(); return; }
    const shelf = ensureShelf('wishlistShelf','Your Wishlist','قائمة المفضلة','#shop, .intro, .page-hero');
    const list = ids.map(findProduct).filter(Boolean).map(p=>({id:p.id,name:p.name||p.name_en,name_ar:p.name_ar,category:p.category,image:imgFor(p),price:(window.finalPrice?finalPrice(p):p.price)}));
    shelf.querySelector('.cj-shelf-grid').innerHTML = list.slice(0,4).map(tinyCard).join('');
  }

  function injectHomeJourneySections(){
    if(!document.body || !location.pathname.match(/index\.html$|\/$/)) return;
    if(!document.getElementById('shopByRoom')){
      const saved = (((window.settings || {}).page_content || {}).home || {}).home_shop_by_room || {};
      const defaultCards = [
        {key:'living', title_en:'Living Room', title_ar:'غرفة المعيشة', subtitle_en:'Explore', subtitle_ar:'استكشف', url:'shop.html?category=' + encodeURIComponent('L Shape Sofas')},
        {key:'bedroom', title_en:'Bedroom', title_ar:'غرفة النوم', subtitle_en:'Explore', subtitle_ar:'استكشف', url:'shop.html?category=' + encodeURIComponent('Beds')},
        {key:'majlis', title_en:'Majlis', title_ar:'المجلس', subtitle_en:'Explore', subtitle_ar:'استكشف', url:'shop.html?category=' + encodeURIComponent('Single Chairs')},
        {key:'custom', title_en:'Custom Made', title_ar:'تفصيل حسب الطلب', subtitle_en:'Explore', subtitle_ar:'استكشف', url:'shop.html'}
      ];
      const cards = defaultCards.map((card, i) => Object.assign({}, card, (Array.isArray(saved.cards) && saved.cards[i]) || {}));
      const sec = document.createElement('section');
      sec.id = 'shopByRoom'; sec.className = 'cj-room-section';
      sec.innerHTML = `<div class="cj-section-head"><h2>${text(saved.title_en || 'Shop by Room', saved.title_ar || 'تسوق حسب الغرفة')}</h2><a href="${esc(saved.shop_all_url || 'shop.html')}">${text(saved.shop_all_en || 'Shop All', saved.shop_all_ar || 'تسوق الكل')}</a></div>
        <div class="cj-room-grid">
          ${cards.map(r=>`<a class="cj-room" href="${esc(r.url || 'shop.html')}"><span>${text(r.title_en || '', r.title_ar || '')}</span><small>${text(r.subtitle_en || 'Explore', r.subtitle_ar || 'استكشف')}</small></a>`).join('')}
        </div>`;
      const intro = document.querySelector('.intro'); if(intro) intro.parentNode.insertBefore(sec, intro.nextSibling);
    }
  }

  function installWhatsApp(){
    if(document.getElementById('floatingExpertWhatsapp')) return;
    const n = (window.settings && settings.whatsapp_number) || '966500000000';
    const a = document.createElement('a');
    a.id = 'floatingExpertWhatsapp';
    a.href = 'https://wa.me/'+n+'?text='+encodeURIComponent(text('Hello, I need help choosing furniture from Crafted Visual.','مرحباً، أحتاج مساعدة في اختيار الأثاث من Crafted Visual.'));
    a.target='_blank';
    a.className='cj-floating-wa';
    a.innerHTML = `<strong>${text('Need Help?','تحتاج مساعدة؟')}</strong><span>${text('Chat with Furniture Expert','تحدث مع خبير الأثاث')}</span>`;
    a.onclick = ()=>eventTrack('whatsapp_click', {page_url:location.pathname});
    document.body.appendChild(a);
  }

  const originalRenderProducts = window.renderProducts;
  window.renderProducts = function(list){
    const grid = document.getElementById('productGrid');
    if(!grid || !Array.isArray(list)){ if(originalRenderProducts) return originalRenderProducts(list); return; }
    if(!list.length){
      grid.innerHTML = `<div class="empty-products"><h3>${text('No products showing yet','لا توجد منتجات حالياً')}</h3><p>${text('Add products from Super Admin and refresh this page.','أضف المنتجات من السوبر أدمن ثم حدّث الصفحة.')}</p></div>`;
      return;
    }
    grid.innerHTML = list.map(p=>{
      p = window.normalizeProduct ? normalizeProduct(p) : p;
      const price = window.finalPrice ? finalPrice(p) : p.price;
      const colors = Object.entries(p.colors||{}).slice(0,5).map(([c,v])=>`<span title="${esc(c)}" style="background:${esc(v.hex||'#ccc')}"></span>`).join('');
      const fabrics = (p.fabricOptions||[]).slice(0,3).map(f=>`<small>${esc(f.label||f)}</small>`).join('');
      return `<div class="card cj-product-card">
        <button class="cj-wish ${isWish(p.id)?'active':''}" onclick="cvToggleWishlist('${esc(p.id)}', event)" title="Wishlist">♥</button>
        <img src="${esc(imgFor(p))}" alt="${esc(productName(p))}">
        <div class="card-body">
          <h3>${esc(productName(p))}</h3>
          <p>${esc(productCat(p))}</p>
          ${window.starDisplay ? starDisplay(p.id) : ''}
          <div class="cj-starting">${text('Starting from','يبدأ من')} <strong>${money(price)}</strong></div>
          <div class="mini-swatches">${colors}</div>
          <div class="cj-fabric-tags">${fabrics}</div>
          <div class="cj-delivery">${text('Made to order: 15–20 working days','تفصيل حسب الطلب: 15–20 يوم عمل')}</div>
          <div class="cj-card-actions"><button class="btn secondary" onclick="openProduct('${esc(p.id)}')">${text('Quick View','عرض سريع')}</button><button class="btn primary" onclick="openProduct('${esc(p.id)}')">${text('Customize','خصص المنتج')}</button></div>
        </div>
      </div>`;
    }).join('');
  };

  const originalOpenProduct = window.openProduct;
  window.openProduct = function(id){
    if(originalOpenProduct) originalOpenProduct(id);
    setTimeout(()=>enhanceModal(id), 30);
  };
  function enhanceModal(id){
    const p = window.currentProduct || findProduct(id);
    if(!p || !document.getElementById('productModal')) return;
    pushRecent(p);
    eventTrack('product_view', {product_id:p.id, product_name:productName(p)});
    const actions = document.querySelector('#productModal .modal-actions');
    if(actions && !document.getElementById('modalWishlistBtn')){
      actions.insertAdjacentHTML('afterbegin', `<button id="modalWishlistBtn" class="btn secondary" type="button" onclick="cvToggleWishlist('${esc(p.id)}', event)">${isWish(p.id)?text('Saved','محفوظ'):text('Add to Wishlist','أضف للمفضلة')}</button>`);
    }
    const price = document.getElementById('modalPrice');
    if(price && !document.getElementById('cjSelectionSummary')){
      price.insertAdjacentHTML('afterend', `<div id="cjSelectionSummary" class="cj-selection-summary"></div><div class="cj-trust-row"><span>✓ ${text('VAT Included','شامل الضريبة')}</span><span>✓ ${text('Warranty Included','الضمان مشمول')}</span><span>✓ ${text('Secure Enquiry','استفسار آمن')}</span><span>✓ ${text('Made in Saudi Arabia','صنع في السعودية')}</span></div>`);
    }
    if(!document.getElementById('cjReviewBox')){
      document.querySelector('#productModal .modal-content').insertAdjacentHTML('beforeend', `<div id="cjReviewBox" class="cj-review-box"></div><div id="cjRelatedBox" class="cj-related-box"></div>`);
    }
    renderSelectionSummary(); renderReviews(p); renderRelated(p);
  }
  window.renderSelectionSummary = function(){
    const el = document.getElementById('cjSelectionSummary'); if(!el || !window.currentProduct) return;
    const size = window.selectedSizeOption || (currentProduct.sizeOptions||[])[0] || {};
    const fabric = window.selectedFabricOption || (currentProduct.fabricOptions||[])[0] || {};
    const dim = [size.width,size.depth,size.height].filter(Boolean).join(' × ');
    el.innerHTML = `<strong>${text('Selected','المحدد')}:</strong> ${text('Color','اللون')}: ${esc(window.selectedColor||'-')} | ${text('Fabric','القماش')}: ${esc(fabric.label||'-')} | ${text('Size','المقاس')}: ${esc(size.label||'-')}${dim?' - '+esc(dim)+' cm':''}`;
  };
  ['updateSelectedFabric','updateSelectedSize','selectColor'].forEach(fn=>{
    const old = window[fn];
    if(typeof old==='function') window[fn] = function(){ const r = old.apply(this, arguments); setTimeout(renderSelectionSummary, 20); eventTrack(fn, {product_id:window.currentProduct&&currentProduct.id}); return r; };
  });

  function reviewList(){ return safeJSON(LS.reviews, {}); }
  window.cvAddReview = function(id){
    const name = document.getElementById('cvReviewName')?.value || 'Customer';
    const stars = Number(document.getElementById('cvReviewStars')?.value || 5);
    const body = document.getElementById('cvReviewText')?.value || '';
    const all = reviewList(); all[id] = all[id] || []; all[id].unshift({name,stars,body,date:new Date().toISOString()}); saveJSON(LS.reviews, all);
    eventTrack('review_added', {product_id:id}); renderReviews(findProduct(id)||window.currentProduct);
  };
  function renderReviews(p){
    const box = document.getElementById('cjReviewBox'); if(!box || !p) return;
    const list = (reviewList()[p.id]||[]).slice(0,4);
    box.innerHTML = `<h3>${text('Customer Reviews','تقييمات العملاء')}</h3><div class="cj-review-form"><input id="cvReviewName" placeholder="${text('Your name','اسمك')}"><select id="cvReviewStars"><option value="5">★★★★★</option><option value="4">★★★★☆</option><option value="3">★★★☆☆</option></select><input id="cvReviewText" placeholder="${text('Write a short review','اكتب تقييم مختصر')}"><button class="btn secondary" onclick="cvAddReview('${esc(p.id)}')">${text('Add Review','أضف تقييم')}</button></div><div class="cj-review-list">${list.length?list.map(r=>`<div><strong>${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</strong> ${esc(r.name)}<p>${esc(r.body)}</p></div>`).join(''):`<p>${text('No written reviews yet. Be the first to review this item.','لا توجد تقييمات مكتوبة بعد. كن أول من يقيّم هذا المنتج.')}</p>`}</div>`;
  }
  function renderRelated(p){
    const box = document.getElementById('cjRelatedBox'); if(!box || !p) return;
    const rel = (window.products||[]).filter(x=>String(x.id)!==String(p.id) && (x.category===p.category || x.category_name===p.category_name)).slice(0,4);
    if(!rel.length){ box.innerHTML=''; return; }
    box.innerHTML = `<h3>${text('Related Products','منتجات مشابهة')}</h3><div class="cj-related-grid">${rel.map(x=>tinyCard({id:x.id,name:x.name||x.name_en,name_ar:x.name_ar,category:x.category,image:imgFor(x),price:window.finalPrice?finalPrice(x):x.price})).join('')}</div>`;
  }

  const oldAdd = window.addCurrentToCart;
  if(typeof oldAdd==='function') window.addCurrentToCart = function(){
    const r = oldAdd.apply(this, arguments); try{ fetch('/api/cart/abandoned',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cart:JSON.parse(localStorage.getItem('cart')||'[]'), status:'open'})}); }catch(e){} return r;
  };

  function boot(){ installWhatsApp(); injectHomeJourneySections(); renderRecentlyViewed(); renderWishlistShelf(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,300)); else setTimeout(boot,300);
})();
