(function(){
  'use strict';
  if(window.__cvProductReviewsEnabled) return;
  window.__cvProductReviewsEnabled = true;

  const API = '/api/product-reviews';
  const STORE_KEY = 'cv_product_reviews_fallback';
  const state = window.CV_PRODUCT_REVIEWS = window.CV_PRODUCT_REVIEWS || {reviews:{}, summaries:{}, loaded:false, currentProductId:''};
  const text = (en, ar) => (document.documentElement.dir === 'rtl' || document.documentElement.lang === 'ar' || window.lang === 'ar') ? ar : en;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cleanId = v => String(v == null ? '' : v).trim();
  const cssEsc = v => (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&');

  function injectStyles(){
    if(document.getElementById('cvProductReviewStyles')) return;
    const style = document.createElement('style');
    style.id = 'cvProductReviewStyles';
    style.textContent = `
      .cv-review-summary{margin:10px 0;color:#7a5c35;font-weight:700;}
      .cv-review-panel{margin-top:18px;padding:16px;border:1px solid rgba(0,0,0,.10);border-radius:16px;background:#fffaf2;}
      .cv-review-panel h3{margin:0 0 10px;font-size:1.05rem;}
      .cv-review-stars{display:flex;gap:4px;margin:8px 0;}
      .cv-review-stars button{border:0;background:transparent;font-size:24px;line-height:1;color:#b8a27d;cursor:pointer;padding:2px;}
      .cv-review-stars button.active{color:#b87333;}
      .cv-review-form{display:grid;gap:8px;margin:10px 0;}
      .cv-review-form input,.cv-review-form textarea{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.18);border-radius:10px;padding:10px;font:inherit;background:white;}
      .cv-review-status{display:block;color:#6b5a45;min-height:18px;}
      .cv-review-list{display:grid;gap:10px;margin-top:12px;}
      .cv-review-item{padding:10px;border-radius:12px;background:white;border:1px solid rgba(0,0,0,.08);}
      .cv-review-item p{margin:6px 0 0;}
      .cv-review-item small{color:#777;}
      .cv-review-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;}
      .cv-review-link{border:0;background:transparent;color:#8a5f2f;text-decoration:underline;cursor:pointer;padding:0;font-weight:700;}
      .cv-card-review{margin-top:8px;font-size:.92rem;}
      .cv-card-review .cv-review-link{font-size:.9rem;}
    `;
    document.head.appendChild(style);
  }

  function localData(){ try{return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};}catch(_e){return{};} }
  function saveLocal(productId, review){ const data = localData(); (data[productId] = data[productId] || []).unshift(review); localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
  function reviewsFor(productId){
    productId = cleanId(productId);
    const server = Array.isArray(state.reviews[productId]) ? state.reviews[productId] : [];
    const local = Array.isArray(localData()[productId]) ? localData()[productId] : [];
    const seen = new Set();
    return server.concat(local).filter(r => {
      const key = `${r.id || ''}|${r.created_at || ''}|${r.customer_name || ''}|${r.review_text || ''}`;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function summaryFor(productId){
    const list = reviewsFor(productId);
    if(list.length){
      const avg = list.reduce((sum, r) => sum + Number(r.rating || 0), 0) / list.length;
      return {avg, count:list.length};
    }
    try{
      const old = window.ratings && window.ratings[productId];
      if(Array.isArray(old) && old.length){ return {avg: old.reduce((a,b)=>a+Number(b||0),0)/old.length, count: old.length}; }
    }catch(_e){}
    return {avg:0, count:0};
  }

  window.productRating = function(productId){ return summaryFor(productId); };
  window.starDisplay = function(productId){
    const r = summaryFor(productId);
    const rounded = Math.max(0, Math.min(5, Math.round(r.avg || 0)));
    return `<div class="rating-line cv-review-summary" data-review-rating-for="${esc(productId)}">${'★'.repeat(rounded)}${'☆'.repeat(5-rounded)} <small>${r.count ? `${Number(r.avg).toFixed(1)} (${r.count})` : text('No ratings','لا توجد تقييمات')}</small></div>`;
  };

  function reviewItemsHtml(productId, limit){
    const list = reviewsFor(productId);
    const use = Number(limit) > 0 ? list.slice(0, Number(limit)) : list;
    if(!use.length) return `<div class="cv-review-empty">${text('No customer reviews yet. Be the first to review this item.','لا توجد مراجعات بعد. كن أول من يراجع هذا المنتج.')}</div>`;
    return use.map(r => {
      const rating = Math.max(0, Math.min(5, Number(r.rating || 0)));
      const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : '';
      return `<div class="cv-review-item"><div><strong>${esc(r.customer_name || text('Customer','عميل'))}</strong> <span>${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</span></div><p>${esc(r.review_text || '')}</p>${date ? `<small>${esc(date)}</small>` : ''}</div>`;
    }).join('');
  }

  function reviewPanelHtml(productId){
    productId = cleanId(productId);
    const list = reviewsFor(productId);
    return `<section class="cv-review-panel" data-cv-review-panel="${esc(productId)}">
      <h3>${text('Customer Reviews','مراجعات العملاء')}</h3>
      ${window.starDisplay(productId)}
      <div class="cv-review-form" data-selected-stars="0">
        <label>${text('Rate this item','قيّم هذا المنتج')}</label>
        <div class="cv-review-stars" aria-label="${text('Choose rating','اختر التقييم')}">${[1,2,3,4,5].map(n=>`<button type="button" data-cv-review-star="${n}" data-product-id="${esc(productId)}" aria-label="${n} stars">★</button>`).join('')}</div>
        <input maxlength="80" data-cv-review-name="${esc(productId)}" placeholder="${text('Your name','اسمك')}">
        <textarea maxlength="1000" rows="3" data-cv-review-text="${esc(productId)}" placeholder="${text('Write your review here','اكتب مراجعتك هنا')}"></textarea>
        <div class="cv-review-actions">
          <button class="btn secondary" type="button" data-cv-review-submit="${esc(productId)}">${text('Submit Review','إرسال المراجعة')}</button>
          ${list.length > 3 ? `<button class="cv-review-link" type="button" data-cv-review-view-all="${esc(productId)}">${text('View all reviews','عرض جميع المراجعات')}</button>` : ''}
        </div>
        <small class="cv-review-status" data-cv-review-status="${esc(productId)}">${text('Select stars, then write your review.','اختر النجوم ثم اكتب مراجعتك.')}</small>
      </div>
      <div class="cv-review-list" data-cv-review-list="${esc(productId)}">${reviewItemsHtml(productId,3)}</div>
    </section>`;
  }

  function mountModalReviews(productId){
    productId = cleanId(productId || state.currentProductId);
    const target = document.getElementById('modalRating');
    if(!target || !productId) return;
    target.innerHTML = reviewPanelHtml(productId);
  }

  function injectCardReviewLinks(){
    document.querySelectorAll('.product-card[data-product-id], .card[data-product-id]').forEach(card => {
      const productId = cleanId(card.getAttribute('data-product-id'));
      if(!productId || card.querySelector('.cv-card-review')) return;
      const r = summaryFor(productId);
      const label = r.count ? text('View reviews','عرض المراجعات') : text('Write first review','اكتب أول مراجعة');
      const html = `<div class="cv-card-review"><button class="cv-review-link" type="button" data-cv-open-reviews="${esc(productId)}">${label}</button></div>`;
      const rating = card.querySelector('.rating-line') || card.querySelector('.shop-price-summary');
      if(rating) rating.insertAdjacentHTML('afterend', html);
    });
  }

  async function loadReviews(){
    try{
      const res = await fetch(API, {cache:'no-store', credentials:'same-origin'});
      if(res.ok){
        const data = await res.json();
        state.reviews = data.reviews || {};
        state.summaries = data.summaries || {};
      }
    }catch(_e){}
    state.loaded = true;
    try{ if(typeof window.applySortAndFilter === 'function' && document.getElementById('productGrid')) window.applySortAndFilter(); }catch(_e){}
    setTimeout(injectCardReviewLinks, 100);
    setTimeout(() => mountModalReviews(), 100);
  }

  function setStars(productId, rating){
    const panel = document.querySelector(`[data-cv-review-panel="${cssEsc(productId)}"]`);
    if(panel){
      const form = panel.querySelector('.cv-review-form');
      if(form) form.dataset.selectedStars = String(rating);
    }
    document.querySelectorAll(`[data-cv-review-star][data-product-id="${cssEsc(productId)}"]`).forEach(btn => {
      btn.classList.toggle('active', Number(btn.getAttribute('data-cv-review-star')) <= Number(rating));
    });
  }

  async function submitReview(productId){
    productId = cleanId(productId);
    const panel = document.querySelector(`[data-cv-review-panel="${cssEsc(productId)}"]`);
    const status = panel && panel.querySelector(`[data-cv-review-status="${cssEsc(productId)}"]`);
    const rating = Number(panel?.querySelector('.cv-review-form')?.dataset.selectedStars || 0);
    const name = panel?.querySelector(`[data-cv-review-name="${cssEsc(productId)}"]`)?.value.trim() || text('Customer','عميل');
    const reviewText = panel?.querySelector(`[data-cv-review-text="${cssEsc(productId)}"]`)?.value.trim() || '';
    if(!rating){ if(status) status.textContent = text('Please select a star rating.','يرجى اختيار تقييم بالنجوم.'); return; }
    if(reviewText.length < 3){ if(status) status.textContent = text('Please write a short review.','يرجى كتابة مراجعة قصيرة.'); return; }
    const payload = {product_id:productId, customer_name:name, rating, review_text:reviewText};
    let saved;
    try{
      const res = await fetch(API, {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || 'Could not save review');
      saved = data.review || Object.assign({}, payload, {created_at:new Date().toISOString()});
      if(status) status.textContent = text('Thank you. Your review was submitted.','شكراً لك. تم إرسال مراجعتك.');
    }catch(_e){
      saved = Object.assign({}, payload, {created_at:new Date().toISOString()});
      saveLocal(productId, saved);
      if(status) status.textContent = text('Review saved in this browser.','تم حفظ المراجعة في هذا المتصفح.');
    }
    state.reviews[productId] = state.reviews[productId] || [];
    state.reviews[productId].unshift(saved);
    mountModalReviews(productId);
    injectCardReviewLinks();
  }

  function wrapOpeners(){
    ['openProduct','openCustomizeProduct'].forEach(name => {
      const fn = window[name];
      if(typeof fn !== 'function' || fn.__cvReviewWrapped) return;
      const wrapped = function(id){
        state.currentProductId = cleanId(id);
        const modal = document.getElementById('productModal');
        if(modal) modal.setAttribute('data-review-product-id', state.currentProductId);
        const out = fn.apply(this, arguments);
        setTimeout(() => mountModalReviews(state.currentProductId), 120);
        return out;
      };
      wrapped.__cvReviewWrapped = true;
      window[name] = wrapped;
    });
  }

  document.addEventListener('click', function(e){
    const open = e.target.closest('[data-cv-open-reviews]');
    if(open){
      e.preventDefault();
      const productId = open.getAttribute('data-cv-open-reviews');
      if(typeof window.openProduct === 'function') window.openProduct(productId);
      setTimeout(() => mountModalReviews(productId), 150);
      return;
    }
    const star = e.target.closest('[data-cv-review-star][data-product-id]');
    if(star){
      e.preventDefault();
      setStars(star.getAttribute('data-product-id'), Number(star.getAttribute('data-cv-review-star') || 0));
      return;
    }
    const submit = e.target.closest('[data-cv-review-submit]');
    if(submit){
      e.preventDefault();
      submitReview(submit.getAttribute('data-cv-review-submit'));
      return;
    }
    const viewAll = e.target.closest('[data-cv-review-view-all]');
    if(viewAll){
      e.preventDefault();
      const productId = viewAll.getAttribute('data-cv-review-view-all');
      const list = document.querySelector(`[data-cv-review-list="${cssEsc(productId)}"]`);
      if(list) list.innerHTML = reviewItemsHtml(productId, 0);
      viewAll.remove();
    }
  }, true);

  const observer = new MutationObserver(() => { wrapOpeners(); injectCardReviewLinks(); });
  function init(){
    injectStyles();
    wrapOpeners();
    loadReviews();
    const grid = document.getElementById('productGrid');
    if(grid) observer.observe(grid, {childList:true, subtree:true});
    setInterval(wrapOpeners, 1000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
