/* Crafted Visual - Discounted Items page end-to-end fix
   Scope: discounted-items.html only. Keeps main shop behavior unchanged. */
(function(){
  'use strict';
  if(!window.CV_DISCOUNTED_ONLY || window.__cvDiscountedItemsFinalE2EFix) return;
  window.__cvDiscountedItemsFinalE2EFix = true;

  function norm(v){ return String(v == null ? '' : v).trim(); }
  function low(v){ return norm(v).toLowerCase(); }
  function num(v){ var n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function money(v){ try{ return typeof window.money === 'function' ? window.money(v) : 'SAR ' + Math.round(num(v)).toLocaleString(); }catch(e){ return 'SAR ' + Math.round(num(v)).toLocaleString(); } }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function label(v){ return norm((v && (v.label || v.name || v.size || v.fabric || v.value)) || v || ''); }
  function nameOf(p){ try{ return typeof window.displayName === 'function' ? window.displayName(p) : (p.name || p.name_en || p.name_ar || 'Product'); }catch(e){ return p.name || p.name_en || p.name_ar || 'Product'; } }
  function catOf(p){ try{ return typeof window.displayCategory === 'function' ? window.displayCategory(p) : (p.category || ''); }catch(e){ return p.category || ''; } }
  function imgOf(p, color){
    try{
      if(color && p.colors && p.colors[color]){
        var c = p.colors[color];
        if(arr(c.images).length) return c.images[0];
        if(arr(c.imageMeta).length && c.imageMeta[0].url) return c.imageMeta[0].url;
        if(c.image) return c.image;
      }
      if(typeof window.firstImage === 'function') return window.firstImage(p);
    }catch(e){}
    if(arr(p.gallery).length) return p.gallery[0];
    return p.image || 'assets/products/product_01.png';
  }
  function normalize(p){ try{ return typeof window.normalizeProduct === 'function' ? window.normalizeProduct(p || {}) : (p || {}); }catch(e){ return p || {}; } }
  function sizes(p){ return arr(p.sizeOptions).length ? p.sizeOptions : [null]; }
  function fabrics(p){ return arr(p.fabricOptions).length ? p.fabricOptions : [null]; }
  function colors(p){
    var keys = p && p.colors && typeof p.colors === 'object' ? Object.keys(p.colors) : [];
    if(!keys.length && arr(p.colorOptions).length) keys = p.colorOptions.map(label);
    return keys.length ? keys : [''];
  }
  function findSize(p, wanted){ var w=low(wanted); return sizes(p).find(function(x){ return low(label(x)) === w; }) || sizes(p)[0] || null; }
  function findFabric(p, wanted){ var w=low(wanted); return fabrics(p).find(function(x){ return low(label(x)) === w; }) || fabrics(p)[0] || null; }
  function findColor(p, wanted){ var w=low(wanted); return colors(p).find(function(x){ return low(x) === w; }) || colors(p)[0] || ''; }
  function vatRate(p){ try{ return typeof window.vatRate === 'function' ? window.vatRate(p) : (num(p.vatRate) || 15); }catch(e){ return num(p.vatRate) || 15; } }
  function beforeVat(p,s,f){ try{ return typeof window.priceBeforeVat === 'function' ? window.priceBeforeVat(p,s,f) : num((s && s.price) || p.price); }catch(e){ return num((s && s.price) || p.price); } }
  function inclVat(p,s,f){ try{ return typeof window.priceIncludingVat === 'function' ? window.priceIncludingVat(p,s,f) : beforeVat(p,s,f)*(1+vatRate(p)/100); }catch(e){ return beforeVat(p,s,f)*(1+vatRate(p)/100); } }
  function activeRule(r){
    if(!r) return false;
    if(r.active === false || r.enabled === false || low(r.status) === 'inactive') return false;
    var pct = num(r.percent || r.discountPercent || r.discount_percent || r.value);
    if(pct <= 0) return false;
    var now = Date.now();
    var start = r.startDate || r.start_date || r.starts_at || r.startAt;
    var end = r.endDate || r.end_date || r.expires_at || r.expiry || r.endAt;
    if(start && !Number.isNaN(Date.parse(start)) && Date.parse(start) > now) return false;
    if(end && !Number.isNaN(Date.parse(end)) && Date.parse(end) < now) return false;
    return true;
  }
  function ruleScope(r){ return low(r.scope || r.applyScope || r.type || r.targetScope || 'product'); }
  function ruleMatches(r, p, s, f, c){
    if(!activeRule(r)) return false;
    var scope = ruleScope(r), rs = low(r.size || r.sizeLabel || r.variantSize), rf = low(r.fabric || r.fabricLabel || r.variantFabric), rc = low(r.color || r.colour || r.colorLabel || r.variantColor);
    var ss = low(label(s)), ff = low(label(f)), cc = low(c);
    if(scope === 'product') return true;
    if(scope === 'size') return rs && rs === ss;
    if(scope === 'fabric') return rf && rf === ff;
    if(scope === 'color') return rc && rc === cc;
    if(scope === 'combo' || scope === 'size_fabric') return rs === ss && rf === ff && (!rc || rc === cc);
    if(scope === 'combo_color' || scope === 'variant' || scope === 'size_fabric_color') return rs === ss && rf === ff && rc === cc;
    if(rs || rf || rc){ if(rs && rs !== ss) return false; if(rf && rf !== ff) return false; if(rc && rc !== cc) return false; return true; }
    return false;
  }
  function pctFor(p,s,f,c){
    var best = num(p.discountPercent || p.discount_percent || p.discount);
    arr(p.discountRules).forEach(function(r){ if(ruleMatches(r,p,s,f,c)) best = Math.max(best, num(r.percent || r.discountPercent || r.discount_percent || r.value)); });
    return Math.max(0, Math.min(90, best));
  }
  function bestGenericVariant(p){
    var best=null;
    sizes(p).forEach(function(s){ fabrics(p).forEach(function(f){ colors(p).forEach(function(c){
      var incl = inclVat(p,s,f); if(!best || incl < best.incl) best={size:s,fabric:f,color:c,incl:incl,before:beforeVat(p,s,f)};
    }); }); });
    return best || {size:null,fabric:null,color:'',incl:inclVat(p,null,null),before:beforeVat(p,null,null)};
  }
  function discountedEntries(p){
    p = normalize(p);
    var entries = [];
    var pid = norm(p.id || p._dbId || p.sku || p.code);
    var productPct = num(p.discountPercent || p.discount_percent || p.discount);
    if(productPct > 0){
      var v = bestGenericVariant(p); v.percent = productPct; v.product = p; v.key = pid + ':product'; entries.push(v);
    }
    arr(p.discountRules).forEach(function(r, idx){
      if(!activeRule(r)) return;
      var scope = ruleScope(r);
      var candidates = [];
      sizes(p).forEach(function(s){ fabrics(p).forEach(function(f){ colors(p).forEach(function(c){
        if(ruleMatches(r,p,s,f,c)) candidates.push({size:s,fabric:f,color:c,incl:inclVat(p,s,f),before:beforeVat(p,s,f)});
      }); }); });
      if(!candidates.length){
        candidates.push({size:findSize(p,r.size), fabric:findFabric(p,r.fabric), color:findColor(p,r.color), incl:inclVat(p,findSize(p,r.size),findFabric(p,r.fabric)), before:beforeVat(p,findSize(p,r.size),findFabric(p,r.fabric))});
      }
      // For broad product/size/fabric discounts show the lowest matching discounted variant directly.
      candidates.sort(function(a,b){ return a.incl-b.incl; });
      var v = candidates[0];
      v.percent = num(r.percent || r.discountPercent || r.discount_percent || r.value);
      v.product = p;
      v.key = pid + ':rule:' + idx;
      entries.push(v);
    });
    var seen = {};
    return entries.filter(function(e){
      if(!e.percent || e.percent <= 0) return false;
      var k = pid + '|' + low(label(e.size)) + '|' + low(label(e.fabric)) + '|' + low(e.color) + '|' + e.percent;
      if(seen[k]) return false; seen[k]=true; return true;
    });
  }
  function allDiscountedEntries(){
    var list = [];
    var products = [];
    try{ products = Array.isArray(window.products) ? window.products : (Array.isArray(window.__cvProducts) ? window.__cvProducts : []); }catch(e){ products = []; }
    products.forEach(function(p){ discountedEntries(p).forEach(function(e){ list.push(e); }); });
    return list;
  }
  function variantBadges(e){
    var bits=[]; if(label(e.size)) bits.push('Size: '+label(e.size)); if(label(e.fabric)) bits.push('Fabric: '+label(e.fabric)); if(e.color) bits.push('Color: '+e.color);
    return bits.length ? '<div class="discounted-variant-tags">'+bits.map(function(x){return '<span class="tag">'+esc(x)+'</span>';}).join('')+'</div>' : '';
  }
  function priceHtml(e){ var final = Math.round(e.incl * (1 - e.percent/100)); return '<div class="shop-price-summary"><span class="old-price" style="text-decoration:line-through;opacity:.65;">'+money(e.incl)+'</span><br><strong class="discount-price">'+money(final)+'</strong> <span class="discount-badge">-'+e.percent+'% OFF</span></div>'; }
  function renderDiscounted(){
    var grid = document.getElementById('productGrid'); if(!grid) return;
    var entries = allDiscountedEntries();
    var sort = (document.getElementById('sortSelect') || {}).value || 'discount';
    if(sort === 'priceHigh') entries.sort(function(a,b){ return (b.incl*(1-b.percent/100)) - (a.incl*(1-a.percent/100)); });
    else if(sort === 'priceLow') entries.sort(function(a,b){ return (a.incl*(1-a.percent/100)) - (b.incl*(1-b.percent/100)); });
    else if(sort === 'nameAZ') entries.sort(function(a,b){ return nameOf(a.product).localeCompare(nameOf(b.product)); });
    else entries.sort(function(a,b){ return b.percent-a.percent; });
    if(!entries.length){ grid.innerHTML = '<div class="empty-products"><h3>No discounted products yet</h3><p>Active discounted items will appear here automatically.</p></div>'; return; }
    grid.innerHTML = entries.map(function(e){
      var p=e.product, pid=norm(p.id || p._dbId || p.sku || p.code), img=imgOf(p,e.color), nm=nameOf(p), cat=catOf(p);
      var size=label(e.size), fabric=label(e.fabric), color=norm(e.color);
      return '<div class="card product-card discounted-product-card" data-product-id="'+esc(pid)+'" data-discount-size="'+esc(size)+'" data-discount-fabric="'+esc(fabric)+'" data-discount-color="'+esc(color)+'" data-discount-percent="'+esc(e.percent)+'">'+
        '<div class="product-card-image-wrap" style="position:relative;"><img src="'+esc(img)+'" alt="'+esc(nm)+'"><span class="discount-badge" style="position:absolute;left:12px;top:12px;">-'+esc(e.percent)+'% OFF</span></div>'+
        '<div class="card-body"><h3>'+esc(nm)+'</h3><p>'+esc(cat)+'</p>'+variantBadges(e)+priceHtml(e)+
        '<div class="cj-card-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">'+
        '<button class="btn secondary" type="button" data-shop-action="quick" data-product-id="'+esc(pid)+'" data-discount-size="'+esc(size)+'" data-discount-fabric="'+esc(fabric)+'" data-discount-color="'+esc(color)+'">Quick View</button>'+
        '<button class="btn primary" type="button" data-shop-action="customize" data-product-id="'+esc(pid)+'" data-discount-size="'+esc(size)+'" data-discount-fabric="'+esc(fabric)+'" data-discount-color="'+esc(color)+'">Customize</button>'+
        '</div></div></div>';
    }).join('');
  }
  function patch(){
    window.renderDiscountedItemsPage = renderDiscounted;
    window.applySortAndFilter = function(){ renderDiscounted(); };
    renderDiscounted();
  }
  document.addEventListener('change', function(e){ if(e.target && e.target.id === 'sortSelect') setTimeout(renderDiscounted,0); }, true);
  var tries=0;
  function wait(){ tries++; if((Array.isArray(window.products) && window.products.length) || tries>20) patch(); else setTimeout(wait,250); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wait); else wait();
})();
