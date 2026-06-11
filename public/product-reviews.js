(function(){
  'use strict';
  const store = window.CV_PRODUCT_REVIEWS = window.CV_PRODUCT_REVIEWS || {reviews:{}, summaries:{}, loaded:false};
  const localKey = 'cv_product_reviews_fallback';
  function lang(){ return document.documentElement.getAttribute('lang') === 'ar' || document.documentElement.dir === 'rtl' || window.lang === 'ar' ? 'ar' : 'en'; }
  function t(en, ar){ return lang() === 'ar' ? ar : en; }
  function esc(v){ return String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function productId(){ return window.currentProduct && (window.currentProduct.id || window.currentProduct._dbId || window.currentProduct.sku); }
  function localReviews(){ try{return JSON.parse(localStorage.getItem(localKey)||'{}')||{};}catch(e){return{};} }
  function saveLocalReview(pid, review){ const data=localReviews(); (data[pid]=data[pid]||[]).unshift(review); localStorage.setItem(localKey, JSON.stringify(data)); }
  function allReviews(pid){ return (store.reviews[String(pid)] || localReviews()[String(pid)] || []).filter(Boolean); }
  function summary(pid){
    pid = String(pid || '');
    const reviews = allReviews(pid);
    if(reviews.length){ const avg = reviews.reduce((a,r)=>a+Number(r.rating||0),0)/reviews.length; return {avg, count:reviews.length}; }
    try{
      const old = window.ratings && window.ratings[pid];
      if(Array.isArray(old) && old.length){ return {avg: old.reduce((a,b)=>a+Number(b||0),0)/old.length, count: old.length}; }
    }catch(e){}
    return {avg:0,count:0};
  }
  window.productRating = function(pid){ return summary(pid); };
  window.starDisplay = function(pid){
    const r = summary(pid);
    const rounded = Math.max(0, Math.min(5, Math.round(r.avg || 0)));
    const empty = t('No ratings','لا توجد تقييمات');
    return `<div class="rating-line">${'★'.repeat(rounded)}${'☆'.repeat(5-rounded)} <small>${r.count ? (Number(r.avg).toFixed(1)+' ('+r.count+')') : empty}</small></div>`;
  };
  async function loadReviews(){
    try{
      const res = await fetch('/api/product-reviews', {credentials:'same-origin', cache:'no-store'});
      if(!res.ok) throw new Error('reviews api unavailable');
      const data = await res.json();
      store.reviews = data.reviews || {};
      store.summaries = data.summaries || {};
      store.loaded = true;
      if(typeof window.applySortAndFilter === 'function' && document.getElementById('productGrid')) window.applySortAndFilter();
      if(document.getElementById('productReviewBox')) mount();
    }catch(e){ store.loaded = true; }
  }
  function reviewListHtml(pid){
    const reviews = allReviews(pid).slice(0,5);
    if(!reviews.length) return `<div class="product-review-empty">${t('No written reviews yet. Be the first to review this product.','لا توجد مراجعات مكتوبة بعد. كن أول من يراجع هذا المنتج.')}</div>`;
    return reviews.map(r=>`<div class="product-review-item"><div><strong>${esc(r.customer_name || r.customerName || t('Customer','عميل'))}</strong> <span>${'★'.repeat(Number(r.rating||0))}${'☆'.repeat(5-Number(r.rating||0))}</span></div><p>${esc(r.review_text || r.reviewText || '')}</p></div>`).join('');
  }
  function mount(){
    const box = document.getElementById('modalRating');
    const pid = productId();
    if(!box || !pid) return;
    const selected = box.dataset.selectedStars || '';
    box.innerHTML = `
      <div class="product-review-box" id="productReviewBox">
        <strong>${t('Customer Rating','تقييم العملاء')}:</strong>
        ${window.starDisplay(pid)}
        <div class="rate-stars product-review-stars" aria-label="${t('Choose rating','اختر التقييم')}">
          ${[1,2,3,4,5].map(n=>`<button type="button" data-review-star="${n}" class="${String(selected)===String(n)?'active':''}" aria-label="${n} stars">★</button>`).join('')}
        </div>
        <div class="product-review-form">
          <input id="reviewerName" maxlength="80" placeholder="${t('Your name','اسمك')}" />
          <textarea id="reviewText" maxlength="1000" rows="3" placeholder="${t('Write your review here','اكتب مراجعتك هنا')}"></textarea>
          <button class="btn secondary" type="button" id="submitProductReview">${t('Submit Review','إرسال المراجعة')}</button>
          <small id="reviewStatus">${t('Select stars and write a review under the rating.','اختر النجوم واكتب مراجعة تحت التقييم.')}</small>
        </div>
        <div class="product-review-list">${reviewListHtml(pid)}</div>
      </div>`;
    box.querySelectorAll('[data-review-star]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        box.dataset.selectedStars = btn.dataset.reviewStar;
        box.querySelectorAll('[data-review-star]').forEach(b=>b.classList.toggle('active', Number(b.dataset.reviewStar)<=Number(btn.dataset.reviewStar)));
      });
    });
    const submit = document.getElementById('submitProductReview');
    if(submit) submit.addEventListener('click', submitReview);
  }
  async function submitReview(){
    const pid = productId();
    const box = document.getElementById('modalRating');
    const status = document.getElementById('reviewStatus');
    const rating = Number(box && box.dataset.selectedStars || 0);
    const name = document.getElementById('reviewerName')?.value.trim() || t('Customer','عميل');
    const text = document.getElementById('reviewText')?.value.trim() || '';
    if(!rating){ if(status) status.textContent = t('Please select a star rating.','يرجى اختيار تقييم بالنجوم.'); return; }
    if(text.length < 3){ if(status) status.textContent = t('Please write a short review.','يرجى كتابة مراجعة قصيرة.'); return; }
    const payload = {product_id:String(pid), customer_name:name, rating, review_text:text};
    try{
      const res = await fetch('/api/product-reviews', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || 'Could not save review');
      (store.reviews[String(pid)] = store.reviews[String(pid)] || []).unshift(data.review || payload);
      if(status) status.textContent = t('Thank you. Your review was submitted.','شكراً لك. تم إرسال مراجعتك.');
    }catch(e){
      const review = Object.assign({}, payload, {created_at:new Date().toISOString()});
      saveLocalReview(String(pid), review);
      (store.reviews[String(pid)] = store.reviews[String(pid)] || []).unshift(review);
      if(status) status.textContent = t('Review saved in this browser.','تم حفظ المراجعة في هذا المتصفح.');
    }
    mount();
    if(typeof window.applySortAndFilter === 'function' && document.getElementById('productGrid')) window.applySortAndFilter();
  }
  const oldRate = window.rateCurrent;
  window.rateCurrent = function(stars){
    const box = document.getElementById('modalRating');
    if(box){ box.dataset.selectedStars = String(stars); mount(); return; }
    if(typeof oldRate === 'function') return oldRate(stars);
  };
  function wrapOpenProduct(){
    if(typeof window.openProduct !== 'function' || window.openProduct.__cvReviewsWrapped) return;
    const oldOpen = window.openProduct;
    window.openProduct = function(){ const out = oldOpen.apply(this, arguments); setTimeout(mount, 0); return out; };
    window.openProduct.__cvReviewsWrapped = true;
  }
  document.addEventListener('DOMContentLoaded', ()=>{ loadReviews(); wrapOpenProduct(); setTimeout(wrapOpenProduct, 500); });
  window.CV_mountProductReviews = mount;
})();
