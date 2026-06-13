(function(){
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  function track(event,data={}){try{window.cvTrack&&window.cvTrack(event,data)}catch(e){} try{fetch('/api/journey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_type:event,page:location.pathname,data})}).catch(()=>{})}catch(e){}}
  function esc(s){return String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function currentProductImage(){
    const modalImg=$('#modalImage');
    if(modalImg && modalImg.src) return modalImg.src;
    const cardImg=$('.product-card img, .product img, .ux95-product-card img');
    return cardImg ? cardImg.src : '';
  }
  function productFrames(){
    const frames=[];
    $$('#thumbs img, .thumbs img, .product-card img, .product img').forEach(img=>{ if(img.src && !frames.includes(img.src)) frames.push(img.src); });
    const main=currentProductImage(); if(main && !frames.includes(main)) frames.unshift(main);
    return frames.length?frames:[main].filter(Boolean);
  }
  function selectedDims(){
    const txt=[$('#sizeSelect')?.selectedOptions?.[0]?.textContent,$('#selectedSummary')?.textContent,$('#modalDesc')?.textContent].filter(Boolean).join(' ');
    const nums=(txt.match(/\d+(?:\.\d+)?/g)||[]).map(Number);
    return {w:nums[0]||0,d:nums[1]||0,h:nums[2]||0,label:txt||'Add dimensions in Admin'};
  }
  function ensureModal(){
    let m=$('#cvRoomToolsModal');
    if(m) return m;
    m=document.createElement('div');
    m.id='cvRoomToolsModal';
    m.className='cv-tools-modal';
    m.innerHTML='<div class="cv-tools-box"><button class="cv-tools-close" type="button">×</button><div id="cvRoomToolsContent"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click',e=>{ if(e.target===m || e.target.closest('.cv-tools-close')) m.classList.remove('open'); });
    return m;
  }
  function show(html){ const m=ensureModal(); $('#cvRoomToolsContent',m).innerHTML=html; m.classList.add('open'); return m; }
  function open360(){
    const frames=productFrames();
    show(`<h2>360° Furniture Viewer</h2><p>Drag the slider or press Auto Rotate to preview the product from available images.</p><div class="cv-360-stage"><img id="cv360Img" src="${esc(frames[0]||'')}" alt="360 furniture preview"></div><input id="cv360Range" class="cv-range" type="range" min="0" max="${Math.max(frames.length-1,0)}" value="0"><div class="cv-tools-actions"><button id="cv360Auto" type="button">Auto Rotate</button><button id="cv360Stop" type="button">Stop</button></div><small>${frames.length<2?'Add more product photos in Admin for richer 360° rotation.':''}</small>`);
    const img=$('#cv360Img'), range=$('#cv360Range'); let timer=null;
    range.oninput=()=>{img.src=frames[Number(range.value)]||frames[0];};
    $('#cv360Auto').onclick=()=>{clearInterval(timer); timer=setInterval(()=>{range.value=(Number(range.value)+1)%frames.length; range.oninput();},650);};
    $('#cv360Stop').onclick=()=>clearInterval(timer);
    track('open_360_viewer',{frames:frames.length});
  }
  function openRoom(){
    const img=currentProductImage();
    show(`<h2>Room Visualizer</h2><p>Upload a room photo, then drag and resize the product preview inside the room.</p><input id="cvRoomUpload" type="file" accept="image/*"><div class="cv-room-stage" id="cvRoomStage"><div class="cv-room-placeholder">Upload room photo</div><img id="cvRoomBg" alt="room"><img id="cvRoomProduct" src="${esc(img)}" alt="product"></div><label>Product Scale <input id="cvRoomScale" type="range" min="20" max="160" value="70"></label><p class="cv-note">Tip: use a real product cutout photo for better visualization.</p>`);
    const bg=$('#cvRoomBg'), product=$('#cvRoomProduct'), stage=$('#cvRoomStage'), scale=$('#cvRoomScale');
    $('#cvRoomUpload').onchange=e=>{const file=e.target.files[0]; if(!file)return; const url=URL.createObjectURL(file); bg.src=url; bg.style.display='block'; $('.cv-room-placeholder').style.display='none';};
    scale.oninput=()=>{product.style.width=scale.value+'%';}; scale.oninput();
    let dragging=false, ox=0, oy=0;
    product.addEventListener('pointerdown',e=>{dragging=true; product.setPointerCapture(e.pointerId); const r=product.getBoundingClientRect(); ox=e.clientX-r.left; oy=e.clientY-r.top;});
    product.addEventListener('pointermove',e=>{ if(!dragging)return; const sr=stage.getBoundingClientRect(); product.style.left=(e.clientX-sr.left-ox)+'px'; product.style.top=(e.clientY-sr.top-oy)+'px'; product.style.transform='none'; });
    product.addEventListener('pointerup',()=>dragging=false);
    track('open_room_visualizer',{});
  }
  function openMeasure(){
    const d=selectedDims();
    show(`<h2>Measure-in-Room Tool</h2><p>Enter room and delivery path measurements to check fit before ordering.</p><div class="cv-measure-grid"><label>Product Width cm<input id="pW" type="number" value="${d.w||''}" placeholder="e.g. 280"></label><label>Product Depth cm<input id="pD" type="number" value="${d.d||''}" placeholder="e.g. 180"></label><label>Product Height cm<input id="pH" type="number" value="${d.h||''}" placeholder="e.g. 85"></label><label>Room Width cm<input id="rW" type="number" placeholder="e.g. 400"></label><label>Room Depth cm<input id="rD" type="number" placeholder="e.g. 350"></label><label>Door Width cm<input id="doorW" type="number" placeholder="e.g. 90"></label></div><button id="cvCheckFit" type="button">Check Fit</button><div id="cvFitResult" class="cv-fit-result"></div><small>Selected dimensions: ${esc(d.label)}</small>`);
    $('#cvCheckFit').onclick=()=>{
      const pW=+$('#pW').value,pD=+$('#pD').value,pH=+$('#pH').value,rW=+$('#rW').value,rD=+$('#rD').value,door=+$('#doorW').value;
      const roomOK= pW&&pD&&rW&&rD && pW<=rW && pD<=rD;
      const doorOK= !door || !pH || Math.min(pW,pH)<=door || Math.min(pD,pH)<=door;
      const msg=(roomOK&&doorOK)?'✅ This product should fit the room and delivery path.':'⚠️ Please verify: room space or doorway clearance may be tight.';
      $('#cvFitResult').innerHTML=msg;
      track('measure_fit_check',{roomOK,doorOK,pW,pD,pH,rW,rD,door});
    };
    track('open_measure_tool',{});
  }
  function injectButtons(){
    // Product modal already has the main 360 / Room Visualizer / Measure buttons.
    // Do not inject a second duplicate button group.
    const duplicate = $('#cvModalTools');
    if(duplicate) duplicate.remove();
  }
  document.addEventListener('click',e=>{ const btn=e.target.closest('[data-cv-tool], [data-ux95-tool]'); if(!btn)return; e.preventDefault(); const type=btn.dataset.cvTool||btn.dataset.ux95Tool; if(type==='360'||type==='spin')open360(); if(type==='room')openRoom(); if(type==='measure')openMeasure(); });
  const css=`.cv-modal-tools,.cv-standalone-tools{margin:18px 0;padding:18px;border:1px solid #e6d8c6;border-radius:18px;background:#fffaf2}.cv-standalone-tools{text-align:center;max-width:1100px;margin:36px auto}.cv-modal-tools button,.cv-standalone-tools button,.cv-tools-actions button,#cvCheckFit{border:0;background:#104735;color:#fff;border-radius:999px;padding:12px 18px;margin:6px;font-weight:800;cursor:pointer}.cv-tools-modal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.62);display:none;align-items:center;justify-content:center;padding:16px}.cv-tools-modal.open{display:flex}.cv-tools-box{background:#fff;border-radius:24px;max-width:820px;width:100%;max-height:92vh;overflow:auto;padding:24px;box-shadow:0 30px 90px rgba(0,0,0,.35);position:relative}.cv-tools-close{position:absolute;right:16px;top:16px;border:0;background:#111;color:#fff;border-radius:50%;width:38px;height:38px;font-size:24px;cursor:pointer}.cv-360-stage{height:360px;background:#f4eee5;border-radius:20px;display:grid;place-items:center;overflow:hidden}.cv-360-stage img{max-width:100%;max-height:100%;object-fit:contain}.cv-range{width:100%;margin:18px 0}.cv-room-stage{height:420px;background:linear-gradient(#f6efe6 0 58%,#d5c0a8 58%);border-radius:20px;position:relative;overflow:hidden;margin:16px 0}.cv-room-placeholder{position:absolute;inset:0;display:grid;place-items:center;font-size:28px;color:#856}.cv-room-stage #cvRoomBg{display:none;width:100%;height:100%;object-fit:cover}.cv-room-stage #cvRoomProduct{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:70%;max-height:70%;object-fit:contain;cursor:grab;filter:drop-shadow(0 24px 24px rgba(0,0,0,.25))}.cv-measure-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.cv-measure-grid label{font-weight:800}.cv-measure-grid input{width:100%;padding:12px;border:1px solid #ddd;border-radius:12px;margin-top:6px}.cv-fit-result{margin-top:14px;padding:14px;border-radius:14px;background:#f4eee5;font-weight:900}@media(max-width:700px){.cv-measure-grid{grid-template-columns:1fr}.cv-room-stage,.cv-360-stage{height:300px}.cv-tools-box{border-radius:18px;padding:18px}.cv-standalone-tools{margin:20px 12px}}`;
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  setInterval(injectButtons,1200); document.addEventListener('DOMContentLoaded',injectButtons); injectButtons();
})();
