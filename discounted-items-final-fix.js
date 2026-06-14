/* Crafted Visual - Discounted Items End-to-End Runtime Fix
   Scope: discounted-items.html only. Does not change main shop, admin, cart core, menu, page builder, or analytics. */
(function(){
  'use strict';
  if(!window.CV_DISCOUNTED_ONLY || window.__cvDiscountedItemsRedoFinal) return;
  window.__cvDiscountedItemsRedoFinal = true;

  const state = { products: [], entries: [], activeEntry: null, activeProduct: null, activeSize: null, activeFabric: null, activeColor: '' };
  const norm = v => String(v == null ? '' : v).trim();
  const low = v => norm(v).toLowerCase();
  const num = v => { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; };
  const arr = v => Array.isArray(v) ? v : [];
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = v => { try { return typeof window.money === 'function' ? window.money(v) : 'SAR ' + Math.round(num(v)).toLocaleString(); } catch(_) { return 'SAR ' + Math.round(num(v)).toLocaleString(); } };
  const label = v => norm(v && (v.label || v.name || v.value || v.size || v.fabric) || v || '');
  const idOf = p => norm(p && (p.id || p._dbId || p.sku || p.code));
  const nameOf = p => { try { return typeof window.displayName === 'function' ? window.displayName(p) : (p.name || p.name_en || p.name_ar || 'Product'); } catch(_) { return p.name || p.name_en || p.name_ar || 'Product'; } };
  const catOf = p => { try { return typeof window.displayCategory === 'function' ? window.displayCategory(p) : (p.category || p.category_en || ''); } catch(_) { return p.category || p.category_en || ''; } };

  function parseMaybeJson(v){
    if(!v) return null;
    if(typeof v === 'object') return v;
    if(typeof v === 'string'){
      try { return JSON.parse(v); } catch(_) { return null; }
    }
    return null;
  }
  function normalizeProduct(raw){
    let p = raw || {};
    const data = parseMaybeJson(p.data_json || p.data || p.product_data);
    if(data && typeof data === 'object') p = Object.assign({}, data, p, { data_json: undefined });
    try { if(typeof window.normalizeProduct === 'function') p = window.normalizeProduct(p); } catch(_) {}
    if(!p.id) p.id = p._dbId || p.sku || p.code || p.slug || p.name;
    if(!Array.isArray(p.sizeOptions) && Array.isArray(p.sizes)) p.sizeOptions = p.sizes;
    if(!Array.isArray(p.fabricOptions) && Array.isArray(p.fabrics)) p.fabricOptions = p.fabrics;
    if(!p.colors && Array.isArray(p.colorOptions)){
      p.colors = {};
      p.colorOptions.forEach(c => { const n = label(c); if(n) p.colors[n] = typeof c === 'object' ? c : { hex:'#ccc' }; });
    }
    return p;
  }
  function responseProducts(payload){
    if(Array.isArray(payload)) return payload;
    if(Array.isArray(payload?.products)) return payload.products;
    if(Array.isArray(payload?.data)) return payload.data;
    if(Array.isArray(payload?.items)) return payload.items;
    if(Array.isArray(payload?.rows)) return payload.rows;
    return [];
  }
  function sizes(p){ return arr(p.sizeOptions).length ? arr(p.sizeOptions) : [{ label: 'Default', price: num(p.price || p.priceBeforeVat || p.beforeVat) }]; }
  function fabrics(p){ return arr(p.fabricOptions).length ? arr(p.fabricOptions) : [{ label: 'Standard', description: '', sizePrices: {} }]; }
  function colorNames(p){
    let keys = p && p.colors && typeof p.colors === 'object' ? Object.keys(p.colors) : [];
    if(!keys.length && arr(p.colorOptions).length) keys = p.colorOptions.map(label).filter(Boolean);
    return keys.length ? keys : [''];
  }
  function colorSet(p, c){ return (p.colors || {})[c] || {}; }
  function imagesForColor(p, c){
    const out = [];
    const add = v => { if(v && !out.includes(v)) out.push(v); };
    const set = c ? colorSet(p,c) : null;
    if(set){ arr(set.images).forEach(add); arr(set.imageMeta).forEach(m => add(m && m.url)); add(set.image); add(set.url); }
    if(!out.length){
      colorNames(p).forEach(k => { const s=colorSet(p,k); arr(s.images).forEach(add); arr(s.imageMeta).forEach(m=>add(m && m.url)); add(s.image); add(s.url); });
    }
    arr(p.gallery).forEach(add); arr(p.images).forEach(add); add(p.image); add(p.imageUrl);
    if(!out.length) add('assets/products/product_01.png');
    return out;
  }
  function findByLabel(list, wanted){
    const w = low(wanted);
    return arr(list).find(x => low(label(x)) === w) || arr(list)[0] || null;
  }
  function beforeVat(p, s, f){
    try { if(typeof window.priceBeforeVat === 'function') return window.priceBeforeVat(p, s, f); } catch(_) {}
    const sl = label(s);
    const sfp = f && f.sizePrices && sl && f.sizePrices[sl] != null ? num(f.sizePrices[sl]) : 0;
    return sfp || num((s && (s.price || s.beforeVat || s.value)) || p.priceBeforeVat || p.price || p.basePrice);
  }
  function vatRate(p){ try { if(typeof window.vatRate === 'function') return window.vatRate(p); } catch(_) {} return num(p.vatRate || p.vat || 15) || 15; }
  function inclVat(p, s, f){ try { if(typeof window.priceIncludingVat === 'function') return window.priceIncludingVat(p, s, f); } catch(_) {} return beforeVat(p,s,f) * (1 + vatRate(p)/100); }
  function rulePct(r){ return num(r && (r.percent || r.discountPercent || r.discount_percent || r.value || r.amount)); }
  function activeRule(r){
    if(!r || rulePct(r) <= 0) return false;
    if(r.active === false || r.enabled === false || low(r.status) === 'inactive' || low(r.status) === 'disabled') return false;
    const now = Date.now();
    const start = r.startDate || r.start_date || r.starts_at || r.startAt;
    const end = r.endDate || r.end_date || r.expires_at || r.expiry || r.endAt;
    if(start && !Number.isNaN(Date.parse(start)) && Date.parse(start) > now) return false;
    if(end && !Number.isNaN(Date.parse(end)) && Date.parse(end) < now) return false;
    return true;
  }
  function scopeOf(r){ return low(r.scope || r.applyScope || r.type || r.targetScope || 'product').replace(/\s+/g,'_'); }
  function ruleMatches(r, p, s, f, c){
    if(!activeRule(r)) return false;
    const scope = scopeOf(r);
    const rs = low(r.size || r.sizeLabel || r.variantSize || r.selectedSize);
    const rf = low(r.fabric || r.fabricLabel || r.variantFabric || r.selectedFabric);
    const rc = low(r.color || r.colour || r.colorLabel || r.variantColor || r.selectedColor);
    const ss = low(label(s)), ff = low(label(f)), cc = low(c);
    if(scope === 'product') return true;
    if(scope === 'size') return rs && rs === ss;
    if(scope === 'fabric') return rf && rf === ff;
    if(scope === 'color') return rc && rc === cc;
    if(scope === 'combo' || scope === 'size_fabric' || scope === 'size_+_fabric_combination') return rs === ss && rf === ff && (!rc || rc === cc);
    if(scope === 'combo_color' || scope === 'variant' || scope === 'size_fabric_color' || scope === 'size_+_fabric_+_color_combination') return rs === ss && rf === ff && rc === cc;
    if(rs || rf || rc){ if(rs && rs !== ss) return false; if(rf && rf !== ff) return false; if(rc && rc !== cc) return false; return true; }
    return false;
  }
  function matchingPercent(p, s, f, c){
    let best = num(p.discountPercent || p.discount_percent || p.discount);
    arr(p.discountRules).forEach(r => { if(ruleMatches(r,p,s,f,c)) best = Math.max(best, rulePct(r)); });
    arr(p.discounts).forEach(r => { if(ruleMatches(r,p,s,f,c)) best = Math.max(best, rulePct(r)); });
    return Math.max(0, Math.min(95, best));
  }
  function bestDiscountEntries(p){
    p = normalizeProduct(p);
    const entries = [];
    const pid = idOf(p);
    function addEntry(s,f,c,pct,source){
      if(!pct || pct <= 0) return;
      const original = inclVat(p,s,f);
      entries.push({ key: pid+'|'+label(s)+'|'+label(f)+'|'+c+'|'+pct+'|'+source, product:p, size:s, fabric:f, color:c, percent:pct, original, final: original*(1-pct/100), source });
    }
    const productPct = num(p.discountPercent || p.discount_percent || p.discount);
    if(productPct > 0){
      // Show one direct lowest-price discounted variant for product-level discounts.
      let best = null;
      sizes(p).forEach(s=>fabrics(p).forEach(f=>colorNames(p).forEach(c=>{ const original = inclVat(p,s,f); if(!best || original < best.original) best = {s,f,c,original}; })));
      if(best) addEntry(best.s,best.f,best.c,productPct,'product');
    }
    const rules = arr(p.discountRules).concat(arr(p.discounts));
    rules.forEach((r,idx)=>{
      if(!activeRule(r)) return;
      const pct = rulePct(r);
      const candidates = [];
      sizes(p).forEach(s=>fabrics(p).forEach(f=>colorNames(p).forEach(c=>{ if(ruleMatches(r,p,s,f,c)) candidates.push({s,f,c,original:inclVat(p,s,f)}); })));
      if(!candidates.length){
        const s = findByLabel(sizes(p), r.size || r.sizeLabel || r.variantSize);
        const f = findByLabel(fabrics(p), r.fabric || r.fabricLabel || r.variantFabric);
        const c = colorNames(p).find(x=>low(x) === low(r.color || r.colour || r.colorLabel || r.variantColor)) || colorNames(p)[0] || '';
        candidates.push({s,f,c,original:inclVat(p,s,f)});
      }
      candidates.sort((a,b)=>a.original-b.original);
      const v = candidates[0];
      addEntry(v.s,v.f,v.c,pct,'rule'+idx);
    });
    const seen = new Set();
    return entries.filter(e => { const k=low(e.key); if(seen.has(k)) return false; seen.add(k); return true; });
  }
  async function loadProducts(){
    let list = [];
    try { if(Array.isArray(window.products) && window.products.length) list = window.products; } catch(_) {}
    if(!list.length){
      try {
        const res = await fetch('/api/products', { credentials: 'include', cache: 'no-store' });
        if(res.ok) list = responseProducts(await res.json());
      } catch(e){ console.warn('Discounted page products API unavailable', e); }
    }
    state.products = list.map(normalizeProduct).filter(p => {
      const status = low(p.status || p.visibility || (p.published === false ? 'draft' : 'active'));
      if(p.deleted || p.isDeleted || p.archived) return false;
      if(status === 'inactive' || status === 'disabled' || status === 'draft' || status === 'unpublished') return false;
      return true;
    });
    try { window.products = state.products; } catch(_) {}
  }
  function renderCards(){
    const grid = document.getElementById('productGrid');
    if(!grid) return;
    state.entries = [];
    state.products.forEach(p => { bestDiscountEntries(p).forEach(e => state.entries.push(e)); });
    const sort = (document.getElementById('sortSelect') || {}).value || 'discount';
    if(sort === 'priceHigh') state.entries.sort((a,b)=>b.final-a.final);
    else if(sort === 'priceLow') state.entries.sort((a,b)=>a.final-b.final);
    else if(sort === 'nameAZ') state.entries.sort((a,b)=>nameOf(a.product).localeCompare(nameOf(b.product)));
    else state.entries.sort((a,b)=>b.percent-a.percent);
    if(!state.entries.length){
      grid.innerHTML = '<div class="empty-products"><h3>No discounted products yet</h3><p>Active product or variant discounts will appear here automatically.</p></div>';
      return;
    }
    grid.innerHTML = state.entries.map((e,i)=>{
      const p=e.product, pid=idOf(p), img=imagesForColor(p,e.color)[0];
      const tags = [label(e.size)&&'Size: '+label(e.size), label(e.fabric)&&'Fabric: '+label(e.fabric), e.color&&'Color: '+e.color].filter(Boolean).map(x=>'<span class="tag">'+esc(x)+'</span>').join('');
      return '<div class="card product-card discounted-product-card" data-discount-entry-index="'+i+'" data-product-id="'+esc(pid)+'">'+
        '<div class="product-card-image-wrap" style="position:relative"><img src="'+esc(img)+'" alt="'+esc(nameOf(p))+'"><span class="discount-badge" style="position:absolute;left:12px;top:12px;">-'+esc(e.percent)+'% OFF</span></div>'+
        '<div class="card-body"><h3>'+esc(nameOf(p))+'</h3><p>'+esc(catOf(p))+'</p><div class="discounted-variant-tags">'+tags+'</div>'+priceBlock(e)+
        '<div class="cj-card-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn secondary" type="button" data-discounted-action="quick" data-discount-entry-index="'+i+'">Quick View</button><button class="btn primary" type="button" data-discounted-action="customize" data-discount-entry-index="'+i+'">Customize</button></div></div></div>';
    }).join('');
  }
  function priceBlock(e){ return '<div class="shop-price-summary"><span class="old-price" style="text-decoration:line-through;opacity:.65">'+money(e.original)+'</span><br><strong class="discount-price" style="color:#c62828">'+money(e.final)+'</strong> <span class="discount-badge">-'+e.percent+'% OFF</span></div>'; }
  function ensureModal(){
    let modal = document.getElementById('cvDiscountedQuickViewModal');
    if(modal) return modal;
    modal = document.createElement('div');
    modal.id = 'cvDiscountedQuickViewModal';
    modal.className = 'cv-stable-qv-modal hidden';
    modal.innerHTML = '<div class="cv-stable-qv-backdrop" data-disc-close="1"></div><div class="cv-stable-qv-dialog" role="dialog" aria-modal="true"><button type="button" class="cv-stable-qv-close" data-disc-close="1">×</button><div id="cvDiscountedQuickViewBody"></div></div>';
    document.body.appendChild(modal);
    if(!document.getElementById('cvDiscountedQuickViewStyles')){
      const style=document.createElement('style'); style.id='cvDiscountedQuickViewStyles';
      style.textContent='.cv-stable-qv-modal.hidden{display:none!important}.cv-stable-qv-modal{position:fixed;inset:0;z-index:999999;display:grid;place-items:center}.cv-stable-qv-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.58)}.cv-stable-qv-dialog{position:relative;background:#fff;border-radius:24px;width:min(92vw,980px);max-height:88vh;overflow:auto;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:24px}.cv-stable-qv-close{position:absolute;top:16px;right:16px;z-index:5;width:42px;height:42px;border-radius:50%;border:1px solid #e3ddd4;background:#fff;font-size:28px;cursor:pointer}.cv-stable-qv-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:26px}.cv-stable-qv-main-img{width:100%;max-height:560px;object-fit:cover;border-radius:18px}.cv-stable-qv-thumbs{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.cv-stable-qv-thumbs img{width:74px;height:58px;object-fit:cover;border-radius:10px;border:2px solid transparent;cursor:pointer}.cv-stable-qv-thumbs img.active{border-color:#174a3d}.cv-stable-qv-info h2{margin:0 44px 12px 0;font-size:34px}.cv-stable-qv-label{display:block;margin:14px 0 8px;font-weight:700}.cv-stable-qv-colors{display:flex;gap:10px;flex-wrap:wrap}.cv-stable-qv-color{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid #dfd7ca;border-radius:12px;background:#fff;cursor:pointer}.cv-stable-qv-color.active{border-color:#174a3d;box-shadow:0 0 0 2px rgba(23,74,61,.12)}.cv-stable-qv-dot{width:18px;height:18px;border-radius:50%;display:inline-block}.cv-stable-qv-select{width:100%;padding:13px;border-radius:12px;border:1px solid #dfd7ca;background:#fff}.cv-stable-qv-fabric-desc{background:#f5efe6;border-radius:10px;padding:10px;margin-top:8px}.cv-stable-qv-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.cv-stable-qv-tools{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.cv-stable-qv-tools button{border-radius:14px;border:1px solid #eadcc8;background:#fbf5ec;padding:12px;font-weight:800;color:#174a3d}.cv-stable-qv-trust{margin-top:18px;border:1px solid #eee4d8;border-radius:18px;padding:16px}.cv-stable-qv-stars{color:#b78728;font-size:22px}@media(max-width:760px){.cv-stable-qv-dialog{padding:16px;width:94vw}.cv-stable-qv-grid{grid-template-columns:1fr}.cv-stable-qv-info h2{font-size:26px}.cv-stable-qv-tools{grid-template-columns:1fr}}';
      document.head.appendChild(style);
    }
    return modal;
  }
  function currentPriceInfo(p,s,f,c){ const pct=matchingPercent(p,s,f,c); const original=inclVat(p,s,f); return {pct, original, final: pct ? original*(1-pct/100) : original}; }
  function modalPriceHtml(p,s,f,c){ const info=currentPriceInfo(p,s,f,c); if(info.pct>0) return '<div class="price-detail"><div>Total before discount: <strong class="old-price" style="text-decoration:line-through;opacity:.65">'+money(info.original)+'</strong></div><div>After discount: <strong class="discount-price" style="color:#c62828">'+money(info.final)+'</strong> <span class="discount-badge">-'+info.pct+'% OFF</span></div></div>'; return '<div class="price-detail"><div>Total incl. VAT: <strong>'+money(info.original)+'</strong></div></div>'; }
  function openDiscountedModal(entry, customize){
    const p=entry.product; let s=entry.size, f=entry.fabric, c=entry.color || colorNames(p)[0] || '';
    state.activeEntry=entry; state.activeProduct=p; state.activeSize=s; state.activeFabric=f; state.activeColor=c;
    const modal=ensureModal(), body=document.getElementById('cvDiscountedQuickViewBody');
    const sizesList=sizes(p), fabricsList=fabrics(p), colorList=colorNames(p), imgs=imagesForColor(p,c);
    body.innerHTML='<div class="cv-stable-qv-grid"><div class="cv-stable-qv-media"><img class="cv-stable-qv-main-img" id="discQvMainImg" src="'+esc(imgs[0])+'" alt="'+esc(nameOf(p))+'"><div class="cv-stable-qv-thumbs" id="discQvThumbs">'+imgs.map((img,i)=>'<img src="'+esc(img)+'" data-disc-thumb="'+esc(img)+'" class="'+(i===0?'active':'')+'" alt="">').join('')+'</div></div><div class="cv-stable-qv-info"><h2>'+esc(nameOf(p))+'</h2><p>'+esc(p.description || p.description_en || '')+'</p><div id="discQvPrice">'+modalPriceHtml(p,s,f,c)+'</div>'+(customize?'<div class="customize-mode-badge" style="padding:10px 12px;margin:10px 0;border-radius:12px;background:#fff8e5;border:1px solid #f0d991;font-weight:700">Customization mode: discounted variant selected. You can change options before adding to cart.</div>':'')+'<label class="cv-stable-qv-label">Color</label><div class="cv-stable-qv-colors" id="discQvColors">'+colorList.map(col=>{const cs=colorSet(p,col);return '<button type="button" class="cv-stable-qv-color '+(low(col)===low(c)?'active':'')+'" data-disc-color="'+esc(col)+'"><span class="cv-stable-qv-dot" style="background:'+esc(cs.hex||'#ccc')+'"></span><span>'+esc(col)+'</span></button>';}).join('')+'</div><label class="cv-stable-qv-label">Fabric</label><select class="cv-stable-qv-select" id="discQvFabric">'+fabricsList.map((fab,i)=>'<option value="'+i+'" '+(low(label(fab))===low(label(f))?'selected':'')+'>'+esc(label(fab))+'</option>').join('')+'</select><div class="cv-stable-qv-fabric-desc" id="discQvFabricDesc">'+esc((f&&(f.description||f.description_ar))||'')+'</div><label class="cv-stable-qv-label">Size</label><select class="cv-stable-qv-select" id="discQvSize">'+sizesList.map((sz,i)=>'<option value="'+i+'" '+(low(label(sz))===low(label(s))?'selected':'')+'>'+esc(label(sz))+'</option>').join('')+'</select><div class="cv-stable-qv-tools"><button type="button" data-ux95-tool="360">360° View</button><button type="button" data-ux95-tool="room">Room Visualizer</button><button type="button" data-ux95-tool="measure">Measure-in-Room</button></div><div class="cv-stable-qv-actions"><button type="button" class="btn primary" id="discQvAddCart">Add to Cart</button><button type="button" class="btn secondary" id="discQvWhatsapp">WhatsApp Inquiry</button></div><div class="cv-stable-qv-trust"><div class="cv-stable-qv-stars">★★★★★</div><strong>Reviews & Trust</strong><p>Warranty included • Secure inquiry • Furniture specialist support</p></div></div></div>';
    function refresh(){
      const price=document.getElementById('discQvPrice'); if(price) price.innerHTML=modalPriceHtml(p,s,f,c);
      const desc=document.getElementById('discQvFabricDesc'); if(desc) desc.textContent=(f&&(f.description||f.description_ar))||'';
      try { window.currentProduct=p; window.selectedSizeOption=s; window.selectedFabricOption=f; window.selectedColor=c; } catch(_) {}
    }
    document.getElementById('discQvColors')?.addEventListener('click', ev=>{ const btn=ev.target.closest('[data-disc-color]'); if(!btn) return; c=btn.getAttribute('data-disc-color')||''; body.querySelectorAll('[data-disc-color]').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); const next=imagesForColor(p,c); const main=document.getElementById('discQvMainImg'); const thumbs=document.getElementById('discQvThumbs'); if(main) main.src=next[0]||''; if(thumbs) thumbs.innerHTML=next.map((img,i)=>'<img src="'+esc(img)+'" data-disc-thumb="'+esc(img)+'" class="'+(i===0?'active':'')+'" alt="">').join(''); refresh(); });
    document.getElementById('discQvThumbs')?.addEventListener('click', ev=>{ const t=ev.target.closest('[data-disc-thumb]'); if(!t) return; const main=document.getElementById('discQvMainImg'); if(main) main.src=t.getAttribute('data-disc-thumb')||''; body.querySelectorAll('[data-disc-thumb]').forEach(x=>x.classList.remove('active')); t.classList.add('active'); });
    document.getElementById('discQvFabric')?.addEventListener('change', ev=>{ f=fabricsList[num(ev.target.value)]||fabricsList[0]; refresh(); });
    document.getElementById('discQvSize')?.addEventListener('change', ev=>{ s=sizesList[num(ev.target.value)]||sizesList[0]; refresh(); });
    document.getElementById('discQvAddCart')?.addEventListener('click', ()=>{ const info=currentPriceInfo(p,s,f,c); const item={id:idOf(p),name:nameOf(p),price:Math.round(info.final),originalPrice:Math.round(info.original),discountPercent:info.pct,color:c,fabric:label(f),size:label(s),qty:1,thumb:imagesForColor(p,c)[0]}; try{ if(!Array.isArray(window.cart)) window.cart=JSON.parse(localStorage.getItem('cart')||'[]'); window.cart.push(item); localStorage.setItem('cart',JSON.stringify(window.cart)); if(typeof window.updateCartCount==='function') window.updateCartCount(); if(typeof window.showToast==='function') window.showToast('Added to cart'); else alert('Added to cart'); }catch(_){ alert('Added to cart'); } });
    document.getElementById('discQvWhatsapp')?.addEventListener('click', ()=>{ const msg=encodeURIComponent('Inquiry about '+nameOf(p)+' - '+label(s)+' / '+label(f)+' / '+c); const num=(window.settings&&settings.whatsapp)||''; window.open(num ? 'https://wa.me/'+String(num).replace(/\D/g,'')+'?text='+msg : 'https://wa.me/?text='+msg, '_blank'); });
    refresh(); modal.classList.remove('hidden'); document.body.classList.add('modal-open');
  }
  function closeModal(){ const m=document.getElementById('cvDiscountedQuickViewModal'); if(m) m.classList.add('hidden'); document.body.classList.remove('modal-open'); }
  document.addEventListener('click', e=>{ const close=e.target.closest && e.target.closest('[data-disc-close]'); if(close){ e.preventDefault(); closeModal(); } const btn=e.target.closest && e.target.closest('[data-discounted-action]'); if(!btn) return; e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); const idx=num(btn.getAttribute('data-discount-entry-index')); const entry=state.entries[idx]; if(entry) openDiscountedModal(entry, btn.getAttribute('data-discounted-action')==='customize'); }, true);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); }, true);
  async function init(){ await loadProducts(); renderCards(); window.applySortAndFilter = renderCards; }
  document.addEventListener('change', e=>{ if(e.target && e.target.id==='sortSelect') setTimeout(renderCards,0); }, true);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
