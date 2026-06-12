(function(){
  'use strict';

  const store = window.CV_PRODUCT_REVIEWS = window.CV_PRODUCT_REVIEWS || {reviews:{}, summaries:{}, loaded:false};
  const localKey = 'cv_product_reviews_fallback';

  function lang(){ return document.documentElement.getAttribute('lang') === 'ar' || document.documentElement.dir === 'rtl' || window.lang === 'ar' ? 'ar' : 'en'; }
  function t(en, ar){ return lang() === 'ar' ? ar : en; }
  function esc(v){ return String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function pid(v){ return String(v || '').trim(); }
  function nowIso(){ return new Date().toISOString(); }
  function localReviews(){ try{return JSON.parse(localStorage.getItem(localKey)||'{}')||{};}catch(e){return{};} }
  function saveLocalReview(productId, review){ const data=localReviews(); (data[productId]=data[productId]||[]).unshift(review); localStorage.setItem(localKey, JSON.stringify(data)); }
  function allReviews(productId){ productId = pid(productId); return (store.reviews[productId] || localReviews()[productId] || []).filter(Boolean); }

  function summary(productId){
    productId = pid(productId);
    const reviews = allReviews(productId);
    if(reviews.length){
      const avg = reviews.reduce((a,r)=>a+Number(r.rating||0),0)/reviews.length;
      return {avg, count:reviews.length};
    }
    try{
      const old = window.ratings && window.ratings[productId];
      if(Array.isArray(old) && old.length){ return {avg: old.reduce((a,b)=>a+Number(b||0),0)/old.length, count: old.length}; }
    }catch(e){}
    return {avg:0,count:0};
  }

  window.productRating = function(productId){ return summary(productId); };
  window.starDisplay = function(productId){
    const r = summary(productId);
    const rounded = Math.max(0, Math.min(5, Math.round(r.avg || 0)));
    const empty = t('No ratings','لا توجد تقييمات');
    return `<div class="rating-line" data-review-rating-for="${esc(productId)}">${'★'.repeat(rounded)}${'☆'.repeat(5-rounded)} <small>${r.count ? (Number(r.avg).toFixed(1)+' ('+r.count+')') : empty}</small></div>`;
  };

  function reviewListHtml(productId, limit=3){
    const reviews = allReviews(productId).slice(0,limit);
    if(!reviews.length) return `<div class="product-review-empty">${t('No written reviews yet.','لا توجد مراجعات مكتوبة بعد.')}</div>`;
    return reviews.map(r=>`<div class="product-review-item"><div><strong>${esc(r.customer_name || r.customerName || t('Customer','عميل'))}</strong> <span>${'★'.repeat(Number(r.rating||0))}${'☆'.repeat(5-Number(r.rating||0))}</span></div><p>${esc(r.review_text || r.reviewText || '')}</p></div>`).join('');
  }

  function cardReviewHtml(productId){
    productId = pid(productId);
    return `<div class="product-card-review" data-product-review-card="${esc(productId)}">
      <button class="product-review-toggle" type="button" data-review-toggle="${esc(productId)}">${t('Write a review','اكتب مراجعة')}</button>
      <div class="product-review-card-form hidden" data-review-form="${esc(productId)}">
        <div class="product-review-stars" aria-label="${t('Choose rating','اختر التقييم')}">
          ${[1,2,3,4,5].map(n=>`<button type="button" data-review-star="${n}" data-review-product="${esc(productId)}" aria-label="${n} stars">★</button>`).join('')}
        </div>
        <input maxlength="80" data-review-name="${esc(productId)}" placeholder="${t('Your name','اسمك')}">
        <textarea maxlength="1000" rows="2" data-review-text="${esc(productId)}" placeholder="${t('Write your review under the rating','اكتب مراجعتك تحت التقييم')}"></textarea>
        <button class="btn secondary" type="button" data-review-submit="${esc(productId)}">${t('Submit Review','إرسال المراجعة')}</button>
        <small data-review-status="${esc(productId)}">${t('Select stars and write a review.','اختر النجوم واكتب مراجعة.')}</small>
      </div>
      <div class="product-review-list">${reviewListHtml(productId,2)}</div>
    </div>`;
  }

  function injectCardReviews(){
    document.querySelectorAll('.product-card[data-product-id]').forEach(card=>{
      const productId = pid(card.getAttribute('data-product-id'));
      if(!productId) return;
      const old = card.querySelector('.product-card-review');
      if(old) old.remove();
      const rating = card.querySelector('.rating-line') || card.querySelector('[data-review-rating-for]');
      if(rating) rating.insertAdjacentHTML('afterend', cardReviewHtml(productId));
    });
  }

  function modalProductId(){
    return pid(window.CV_REVIEW_CURRENT_PRODUCT_ID || document.getElementById('productModal')?.getAttribute('data-review-product-id'));
  }

  function modalReviewHtml(productId){
    productId = pid(productId);
    return `<div class="product-review-box" id="productReviewBox" data-product-review-modal="${esc(productId)}">
      <strong>${t('Customer Rating','تقييم العملاء')}:</strong>
      ${window.starDisplay(productId)}
      <div class="rate-stars product-review-stars" aria-label="${t('Choose rating','اختر التقييم')}">
        ${[1,2,3,4,5].map(n=>`<button type="button" data-review-star="${n}" data-review-product="${esc(productId)}" aria-label="${n} stars">★</button>`).join('')}
      </div>
      <div class="product-review-form">
        <input maxlength="80" data-review-name="${esc(productId)}" placeholder="${t('Your name','اسمك')}">
        <textarea maxlength="1000" rows="3" data-review-text="${esc(productId)}" placeholder="${t('Write your review here','اكتب مراجعتك هنا')}"></textarea>
        <button class="btn secondary" type="button" data-review-submit="${esc(productId)}">${t('Submit Review','إرسال المراجعة')}</button>
        <small data-review-status="${esc(productId)}">${t('Select stars and write a review under the rating.','اختر النجوم واكتب مراجعة تحت التقييم.')}</small>
      </div>
      <div class="product-review-list">${reviewListHtml(productId,5)}</div>
    </div>`;
  }

  function mountModal(){
    const box = document.getElementById('modalRating');
    const productId = modalProductId();
    if(!box || !productId) return;
    box.innerHTML = modalReviewHtml(productId);
  }

  async function loadReviews(){
    try{
      const res = await fetch('/api/product-reviews', {credentials:'same-origin', cache:'no-store'});
      if(!res.ok) throw new Error('reviews api unavailable');
      const data = await res.json();
      store.reviews = data.reviews || {};
      store.summaries = data.summaries || {};
    }catch(e){}
    store.loaded = true;
    try{ if(typeof window.applySortAndFilter === 'function' && document.getElementById('productGrid')) window.applySortAndFilter(); }catch(e){}
    setTimeout(injectCardReviews, 100);
    setTimeout(mountModal, 100);
  }

  function setStars(productId, selected){
    document.querySelectorAll(`[data-review-product="${CSS.escape(productId)}"][data-review-star]`).forEach(btn=>{
      btn.classList.toggle('active', Number(btn.getAttribute('data-review-star')) <= Number(selected));
    });
    document.querySelectorAll(`[data-product-review-card="${CSS.escape(productId)}"], [data-product-review-modal="${CSS.escape(productId)}"]`).forEach(box=>box.dataset.selectedStars = String(selected));
  }

  async function submitReview(productId){
    productId = pid(productId);
    const box = document.querySelector(`[data-product-review-card="${CSS.escape(productId)}"]`) || document.querySelector(`[data-product-review-modal="${CSS.escape(productId)}"]`);
    const status = document.querySelector(`[data-review-status="${CSS.escape(productId)}"]`);
    const rating = Number(box && box.dataset.selectedStars || 0);
    const name = document.querySelector(`[data-review-name="${CSS.escape(productId)}"]`)?.value.trim() || t('Customer','عميل');
    const text = document.querySelector(`[data-review-text="${CSS.escape(productId)}"]`)?.value.trim() || '';
    if(!rating){ if(status) status.textContent = t('Please select a star rating.','يرجى اختيار تقييم بالنجوم.'); return; }
    if(text.length < 3){ if(status) status.textContent = t('Please write a short review.','يرجى كتابة مراجعة قصيرة.'); return; }
    const payload = {product_id:productId, customer_name:name, rating, review_text:text};
    try{
      const res = await fetch('/api/product-reviews', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || 'Could not save review');
      (store.reviews[productId] = store.reviews[productId] || []).unshift(data.review || payload);
      if(status) status.textContent = t('Thank you. Your review was submitted.','شكراً لك. تم إرسال مراجعتك.');
    }catch(e){
      const review = Object.assign({}, payload, {created_at:nowIso()});
      saveLocalReview(productId, review);
      (store.reviews[productId] = store.reviews[productId] || []).unshift(review);
      if(status) status.textContent = t('Review saved in this browser.','تم حفظ المراجعة في هذا المتصفح.');
    }
    try{ if(typeof window.applySortAndFilter === 'function') window.applySortAndFilter(); }catch(e){}
    setTimeout(()=>{ injectCardReviews(); mountModal(); }, 100);
  }

  function bindShopCspActions(){
    document.querySelectorAll('[onclick],[onchange],[oninput]').forEach(el=>{
      el.removeAttribute('onclick'); el.removeAttribute('onchange'); el.removeAttribute('oninput');
    });
    const sort = document.getElementById('sortSelect');
    const cat = document.getElementById('categoryFilter');
    if(sort && !sort.__cvReviewChangeBound){ sort.__cvReviewChangeBound = true; sort.addEventListener('change', ()=>window.applySortAndFilter && window.applySortAndFilter()); }
    if(cat && !cat.__cvReviewChangeBound){ cat.__cvReviewChangeBound = true; cat.addEventListener('change', ()=>window.applySortAndFilter && window.applySortAndFilter()); }
  }

  function wrapProductOpeners(){
    ['openProduct','openCustomizeProduct'].forEach(name=>{
      const fn = window[name];
      if(typeof fn !== 'function' || fn.__cvReviewsWrapped) return;
      window[name] = function(id){
        window.CV_REVIEW_CURRENT_PRODUCT_ID = pid(id);
        const modal = document.getElementById('productModal');
        if(modal) modal.setAttribute('data-review-product-id', pid(id));
        const out = fn.apply(this, arguments);
        setTimeout(mountModal, 100);
        return out;
      };
      window[name].__cvReviewsWrapped = true;
    });
  }

  document.addEventListener('click', function(e){
    const action = e.target.closest('[data-cv-action]');
    if(action){
      const a = action.getAttribute('data-cv-action');
      e.preventDefault(); e.stopPropagation();
      if(a === 'open-cart' && typeof window.openCart === 'function') window.openCart();
      if(a === 'close-cart' && typeof window.closeCart === 'function') window.closeCart();
      if(a === 'close-modal' && typeof window.closeModal === 'function') window.closeModal();
      if(a === 'add-cart' && typeof window.addCurrentToCart === 'function') window.addCurrentToCart();
      if(a === 'whatsapp-current' && typeof window.whatsappCurrent === 'function') window.whatsappCurrent();
      if(a === 'checkout' && typeof window.checkout === 'function') window.checkout();
    }
    const toggle = e.target.closest('[data-review-toggle]');
    if(toggle){
      e.preventDefault();
      const productId = pid(toggle.getAttribute('data-review-toggle'));
      const form = document.querySelector(`[data-review-form="${CSS.escape(productId)}"]`);
      if(form) form.classList.toggle('hidden');
    }
    const star = e.target.closest('[data-review-star][data-review-product]');
    if(star){
      e.preventDefault(); e.stopPropagation();
      setStars(pid(star.getAttribute('data-review-product')), Number(star.getAttribute('data-review-star')||0));
    }
    const submit = e.target.closest('[data-review-submit]');
    if(submit){
      e.preventDefault(); e.stopPropagation();
      submitReview(submit.getAttribute('data-review-submit'));
    }
  }, true);

  const observer = new MutationObserver(()=>{ wrapProductOpeners(); injectCardReviews(); bindShopCspActions(); });
  function init(){
    bindShopCspActions();
    wrapProductOpeners();
    loadReviews();
    const grid = document.getElementById('productGrid');
    if(grid) observer.observe(grid, {childList:true, subtree:false});
    setTimeout(()=>{ wrapProductOpeners(); injectCardReviews(); bindShopCspActions(); }, 700);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.CV_mountProductReviews = function(){ injectCardReviews(); mountModal(); };
})();
