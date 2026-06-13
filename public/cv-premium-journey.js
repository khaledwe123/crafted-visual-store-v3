/* Crafted Visual Premium Journey Pack: mobile nav, 360 viewer, room visualizer, measure tool, tracking */
(function(){
  const TXT={
    en:{home:'Home',shop:'Shop',cart:'Cart',account:'Account',menu:'Menu',close:'Close',viewer360:'360° Viewer',autoRotate:'Auto Rotate',room:'Room Visualizer',measure:'Measure in Room',wishlist:'Wishlist',reviews:'Reviews',track:'Track Order',ar:'AR / Room Preview',uploadRoom:'Upload room photo',productScale:'Product scale',roomWidth:'Room width cm',roomDepth:'Room depth cm',checkFit:'Check fit',fits:'This item should fit based on entered dimensions.',tight:'This item may be tight. Please verify space and walkways.',noDims:'Add product dimensions in Admin for accurate measurement.',dragNote:'Tip: upload a room photo, then use scale to preview furniture placement.',sticky:'VAT included'},
    ar:{home:'الرئيسية',shop:'المتجر',cart:'السلة',account:'حسابي',menu:'القائمة',close:'إغلاق',viewer360:'عرض 360°',autoRotate:'دوران تلقائي',room:'تصور داخل الغرفة',measure:'قياس داخل الغرفة',wishlist:'المفضلة',reviews:'التقييمات',track:'تتبع الطلب',ar:'معاينة AR / الغرفة',uploadRoom:'ارفع صورة الغرفة',productScale:'حجم المنتج',roomWidth:'عرض الغرفة سم',roomDepth:'عمق الغرفة سم',checkFit:'تحقق من الملاءمة',fits:'المنتج مناسب حسب الأبعاد المدخلة.',tight:'قد يكون المساحة ضيقة. يرجى التحقق من المساحة والممرات.',noDims:'أضف أبعاد المنتج من الأدمن لقياس أدق.',dragNote:'نصيحة: ارفع صورة الغرفة ثم عدل الحجم لمعاينة مكان الأثاث.',sticky:'شامل الضريبة'}
  };
  function lang(){return (document.documentElement.dir==='rtl'||localStorage.getItem('cv_lang')==='ar'||window.lang==='ar')?'ar':'en';}
  function t(k){return (TXT[lang()]&&TXT[lang()][k])||TXT.en[k]||k;}
  function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));}
  function money(v){return 'SAR '+Number(v||0).toLocaleString();}
  function track(event,meta){
    try{ if(window.trackEvent) window.trackEvent(event, meta||{}); }catch(e){}
    try{ fetch('/api/journey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({event_type:event,page_url:location.pathname,page_title:document.title,source:new URLSearchParams(location.search).get('utm_source')||document.referrer||'direct'}, meta||{}))}); }catch(e){}
  }
  function addGlobalMobileUI(){
    const nav=document.querySelector('.nav');
    if(nav && !document.getElementById('cvHamburger')){
      const btn=document.createElement('button'); btn.id='cvHamburger'; btn.type='button'; btn.className='cv-hamburger'; btn.innerHTML='☰ '+t('menu');
      btn.onclick=()=>document.body.classList.toggle('cv-menu-open');
      const brand=nav.querySelector('.brand')||nav.firstElementChild; brand?brand.insertAdjacentElement('afterend',btn):nav.prepend(btn);
    }
    if(!document.getElementById('cvBottomNav')){
      const b=document.createElement('nav'); b.id='cvBottomNav'; b.className='cv-bottom-nav';
      b.innerHTML=`<a href="index.html"><span>⌂</span>${t('home')}</a><a href="shop.html"><span>▦</span>${t('shop')}</a><button type="button" id="cvBottomCart"><span>🛒</span>${t('cart')}</button><a href="account.html"><span>👤</span>${t('account')}</a>`;
      document.body.appendChild(b);
      const c=document.getElementById('cvBottomCart'); if(c) c.onclick=()=>{track('bottom_cart_click'); if(window.openCart) openCart(); else location.href='review.html';};
    }
    if(!document.getElementById('cvExpertWA')){
      const n=(window.settings&&settings.whatsapp_number)||'966500000000';
      const a=document.createElement('a'); a.id='cvExpertWA'; a.href='https://wa.me/'+n+'?text='+encodeURIComponent(lang()==='ar'?'مرحباً، أحتاج مساعدة في اختيار الأثاث.':'Hello, I need help choosing furniture.'); a.target='_blank'; a.innerHTML=`<strong>WhatsApp</strong><small>${lang()==='ar'?'خبير الأثاث':'Furniture expert'}</small>`; a.onclick=()=>track('whatsapp_floating_click'); document.body.appendChild(a);
    }
  }
  function getProduct(){return window.currentProduct || null;}
  function imageList(p){
    const arr=[];
    try{ if(p.gallery) arr.push(...p.gallery); }catch(e){}
    try{ Object.values(p.colors||{}).forEach(c=>{ if(c.image) arr.push(c.image); if(Array.isArray(c.images)) arr.push(...c.images); }); }catch(e){}
    try{ (p.fabricOptions||[]).forEach(f=>{ if(f.image) arr.push(f.image); if(Array.isArray(f.images)) arr.push(...f.images); }); }catch(e){}
    const first=(window.firstImage&&p)?firstImage(p):''; if(first) arr.unshift(first);
    return [...new Set(arr.filter(Boolean))];
  }
  function currentDims(p){
    const s=window.selectedSizeOption || (p&&p.sizeOptions&&p.sizeOptions[0]) || {};
    return {label:s.label||'', width:Number(s.width||s.w||0), depth:Number(s.depth||s.d||0), height:Number(s.height||s.h||0)};
  }
  function installModalTools(){
    const duplicate=document.getElementById('cvPremiumTools');
    if(duplicate) duplicate.remove();
    return;
  }
  let spinTimer=null;
  function showTool(tool){
    const p=getProduct(); const panel=document.getElementById('cvToolPanel'); if(!p||!panel) return; track('product_tool_'+tool,{product_id:p.id});
    if(spinTimer){clearInterval(spinTimer); spinTimer=null;}
    if(tool==='spin'){
      const imgs=imageList(p); const first=imgs[0]||'';
      panel.innerHTML=`<div class="cv-spin"><img id="cvSpinImg" src="${esc(first)}" alt="360"><input id="cvSpinRange" type="range" min="0" max="${Math.max(imgs.length-1,0)}" value="0"><button type="button" id="cvSpinAuto">${t('autoRotate')}</button><small>${imgs.length>1?'':'Add more product/fabric/color images in Admin for a richer 360° effect.'}</small></div>`;
      const range=document.getElementById('cvSpinRange'), im=document.getElementById('cvSpinImg'); if(range&&im){range.oninput=()=>im.src=imgs[Number(range.value)]||first;}
      const auto=document.getElementById('cvSpinAuto'); if(auto&&range&&im){auto.onclick=()=>{let i=0; if(spinTimer){clearInterval(spinTimer); spinTimer=null; return;} spinTimer=setInterval(()=>{i=(i+1)%Math.max(imgs.length,1); range.value=i; im.src=imgs[i]||first;},800);};}
    }
    if(tool==='room'){
      const img=(window.selectedImage)||imageList(p)[0]||'';
      panel.innerHTML=`<div class="cv-roomviz"><label>${t('uploadRoom')}<input id="cvRoomUpload" type="file" accept="image/*"></label><div id="cvRoomStage"><div class="cv-room-empty">${t('dragNote')}</div><img id="cvRoomProduct" src="${esc(img)}" alt="product"></div><label>${t('productScale')}<input id="cvRoomScale" type="range" min="20" max="120" value="55"></label><p><strong>${t('ar')}</strong>: Real AR requires GLB/USDZ 3D models. This visualizer works now as a room-placement preview and is ready for real 3D models later.</p></div>`;
      const up=document.getElementById('cvRoomUpload'), stage=document.getElementById('cvRoomStage'), prod=document.getElementById('cvRoomProduct'), scale=document.getElementById('cvRoomScale');
      if(up&&stage) up.onchange=e=>{const f=e.target.files&&e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{stage.style.backgroundImage=`url(${r.result})`; const empty=stage.querySelector('.cv-room-empty'); if(empty) empty.style.display='none';}; r.readAsDataURL(f);};
      if(scale&&prod) scale.oninput=()=>prod.style.width=scale.value+'%';
    }
    if(tool==='measure'){
      const d=currentDims(p);
      panel.innerHTML=`<div class="cv-measure"><div class="cv-dims-card"><strong>${esc(d.label||'Selected size')}</strong><span>${d.width||'-'} × ${d.depth||'-'} × ${d.height||'-'} cm</span></div><div class="cv-measure-grid"><input id="cvRoomW" type="number" placeholder="${t('roomWidth')}"><input id="cvRoomD" type="number" placeholder="${t('roomDepth')}"><button type="button" id="cvCheckFit">${t('checkFit')}</button></div><p id="cvFitResult">${(d.width&&d.depth)?'':t('noDims')}</p><ul><li>Leave 70–90 cm walkway around sofas/beds.</li><li>Check elevator and doorway clearance before ordering.</li><li>For custom dimensions, send a WhatsApp inquiry.</li></ul></div>`;
      const check=document.getElementById('cvCheckFit'); if(check) check.onclick=()=>{const w=Number(document.getElementById('cvRoomW').value||0), dep=Number(document.getElementById('cvRoomD').value||0); const ok=d.width&&d.depth&&w>=d.width+80&&dep>=d.depth+80; document.getElementById('cvFitResult').textContent=ok?t('fits'):t('tight'); track('measure_fit_check',{product_id:p.id,room_width:w,room_depth:dep,product_width:d.width,product_depth:d.depth,fit:ok});};
    }
    if(tool==='reviews'){
      const box=document.getElementById('cjReviewBox');
      panel.innerHTML=box?box.innerHTML:`<p>${t('reviews')} will appear here after customers add reviews.</p>`;
    }
  }
  function syncStickyCTA(){
    const modal=document.getElementById('productModal'); let cta=document.getElementById('cvStickyAdd');
    const open=modal&&!modal.classList.contains('hidden')&&getProduct();
    if(!open){ if(cta) cta.style.display='none'; return; }
    if(!cta){cta=document.createElement('div'); cta.id='cvStickyAdd'; cta.innerHTML='<div><strong id="cvStickyPrice"></strong><small>'+t('sticky')+'</small></div><button type="button">Add to Cart</button>'; document.body.appendChild(cta); cta.querySelector('button').onclick=()=>{track('sticky_add_to_cart'); if(window.addCurrentToCart) addCurrentToCart();};}
    const price=document.getElementById('modalPrice'); document.getElementById('cvStickyPrice').textContent=price?(price.textContent||''):''; cta.style.display='grid';
  }
  function patchProductOpen(){
    const old=window.openProduct;
    if(typeof old==='function' && !old.__cvPremiumPatched){
      const fn=function(){const r=old.apply(this,arguments); setTimeout(()=>{installModalTools(); syncStickyCTA();},120); return r;}; fn.__cvPremiumPatched=true; window.openProduct=fn;
    }
    ['updateSelectedFabric','updateSelectedSize','selectColor'].forEach(name=>{
      const oldFn=window[name]; if(typeof oldFn==='function'&&!oldFn.__cvPremiumPatched){ const nf=function(){const r=oldFn.apply(this,arguments); setTimeout(()=>{const tools=document.getElementById('cvPremiumTools'); if(tools){document.getElementById('cvPremiumTools').remove(); installModalTools();} syncStickyCTA();},80); return r;}; nf.__cvPremiumPatched=true; window[name]=nf; }
    });
  }
  function boot(){addGlobalMobileUI(); patchProductOpen(); setInterval(()=>{patchProductOpen(); syncStickyCTA();},1200); track('page_view',{path:location.pathname});}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
