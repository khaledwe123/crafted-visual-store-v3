/*
  Crafted Visual Admin Workflow Fix v23
  Focus: products inner controls, publishing, media-library image source, analytics period sync, menu action publishing.
*/
(function(){
  'use strict';

  const OWNER_EMAIL = 'admin@craftedvisual.com';
  const ALL_PERMISSIONS = ['menu','pictures','products','categories','seo','discounts','orders','finance','crm','users','analytics','security','inventory','media','settings'];

  function q(id){ return document.getElementById(id); }
  function val(id){ return (q(id)?.value || '').trim(); }
  function fullPermissions(){ const o={}; ALL_PERMISSIONS.forEach(k=>o[k]={read:true,write:true}); return o; }
  function token(){ return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || ''; }
  function session(){ try{return JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null');}catch(e){return null;} }
  function isSuper(){ const u=session(); return !!u && (String(u.role||'').toLowerCase()==='superadmin' || String(u.email||'').toLowerCase()===OWNER_EMAIL); }
  function status(msg, err){ if(typeof window.showAdminStatus==='function') window.showAdminStatus(msg, !!err); else alert(msg); }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function normalizeSession(){
    const u = session();
    if(!u) return null;
    if(String(u.email||'').toLowerCase()===OWNER_EMAIL || String(u.role||'').toLowerCase()==='superadmin'){
      u.name = u.name || 'Super Admin';
      u.role = 'superadmin';
      u.permissions = fullPermissions();
      u.isSuperAdmin = true;
      localStorage.setItem('cvAdminSession', JSON.stringify(u));
      sessionStorage.setItem('cvAdminSession', JSON.stringify(u));
    }
    return u;
  }

  async function api(path, options={}){
    const t = token();
    if(!t) throw new Error('Missing admin token. Logout and login again.');
    const headers = Object.assign({}, options.headers || {}, {Authorization:'Bearer '+t});
    if(!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    const res = await fetch(path, Object.assign({}, options, {headers, body: options.body instanceof FormData ? options.body : (options.body !== undefined && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body)}));
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json().catch(()=>({})) : await res.text().catch(()=>'');
    if(!res.ok) throw new Error((data && data.error) || (typeof data === 'string' && data) || 'HTTP '+res.status);
    return data;
  }

  async function getSettings(){ return fetch('/api/settings', {cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})); }
  async function publishSettings(patch){
    const latest = await getSettings();
    const localSettings = typeof settings !== 'undefined' ? settings : {};
    const next = Object.assign({}, latest || {}, localSettings || {}, patch || {});
    const result = await api('/api/settings', {method:'PUT', body:next});
    if(typeof settings !== 'undefined') settings = Object.assign({}, next, result.settings || {});
    return result;
  }

  function safeArray(name){
    try{ if(Array.isArray(window[name])) return window[name]; }catch(e){}
    try{ if(eval('typeof '+name)!=='undefined' && Array.isArray(eval(name))) return eval(name); }catch(e){}
    return [];
  }

  function bindInlineActions(){
    document.addEventListener('click', function(e){
      const el = e.target.closest('[onclick]');
      if(!el) return;
      const raw = el.getAttribute('onclick') || '';
      const m = raw.trim().match(/^([A-Za-z_$][\w$]*)\((.*)\);?$/s);
      if(!m || typeof window[m[1]] !== 'function') return;
      // The browser CSP may block inline handlers before they execute; run safe known admin handlers ourselves.
      const safe = /^(addMenuItem|toggleMenu|removeMenu|resetMenu|addManualSize|addManualFabric|buildSizeFabricPriceTable|addColorSet|clearForm|saveMenu|saveSettings|saveCategories|saveSeoPage|loadAnalyticsCenter|uploadMedia|loadMedia|saveMediaAlt|deleteMedia|openAssignMedia|assignMedia)$/.test(m[1]);
      if(!safe) return;
      e.preventDefault(); e.stopPropagation();
      const args = String(m[2] || '').trim() === '' ? [] : String(m[2]).split(',').map(x => {
        const v = x.trim();
        if(/^[-]?\d+$/.test(v)) return Number(v);
        if(/^['"].*['"]$/.test(v)) return v.slice(1,-1);
        return v;
      });
      window[m[1]].apply(window, args);
    }, true);
  }

  window.cvHasPermission = function(section, level='read'){
    const u = normalizeSession();
    if(!u) return false;
    if(isSuper()) return true;
    return !!u.permissions?.[section]?.[level];
  };
  window.hasAdminPermission = function(section, level='read'){ return window.cvHasPermission(section, level); };
  window.currentAdmin = function(){ return normalizeSession(); };
  window.cvFullPermissions = fullPermissions;

  window.addManualSize = function(){
    if(!window.hasAdminPermission('products','write')) return status('You do not have write access for products.', true);
    const label = val('sizeNameInput');
    const width = val('sizeWidthInput');
    const depth = val('sizeDepthInput');
    const height = val('sizeHeightInput');
    if(!label) return status('Size name is required.', true);
    if(!width && !depth && !height) return status('Please enter at least one dimension.', true);
    if(typeof manualSizes === 'undefined') window.manualSizes = [];
    manualSizes.push({label,width,depth,height});
    ['sizeNameInput','sizeWidthInput','sizeDepthInput','sizeHeightInput'].forEach(id=>{ if(q(id)) q(id).value=''; });
    if(typeof renderManualSizeTable === 'function') renderManualSizeTable();
    if(typeof buildSizeFabricPriceTable === 'function') buildSizeFabricPriceTable();
    status('Size added: '+label);
  };

  window.addManualFabric = function(){
    if(!window.hasAdminPermission('products','write')) return status('You do not have write access for products.', true);
    const label = val('fabricNameInput');
    const description = val('fabricDescInput');
    if(!label) return status('Fabric name is required.', true);
    if(typeof manualFabrics === 'undefined') window.manualFabrics = [];
    manualFabrics.push({label,description});
    ['fabricNameInput','fabricDescInput'].forEach(id=>{ if(q(id)) q(id).value=''; });
    if(typeof renderManualFabricTable === 'function') renderManualFabricTable();
    if(typeof buildSizeFabricPriceTable === 'function') buildSizeFabricPriceTable();
    status('Fabric added: '+label);
  };

  window.buildSizeFabricPriceTable = function(){
    const head = q('sizeFabricPriceHead');
    const body = q('sizeFabricPriceBody');
    if(!head || !body) return;
    if(typeof manualSizes === 'undefined') window.manualSizes = [];
    if(typeof manualFabrics === 'undefined') window.manualFabrics = [];
    if(typeof sizeFabricPrices === 'undefined') window.sizeFabricPrices = {};
    if(typeof sizeFabricCosts === 'undefined') window.sizeFabricCosts = {};
    if(!manualSizes.length || !manualFabrics.length){
      head.innerHTML='';
      body.innerHTML='<tr><td>Add at least one size and one fabric to build the price and cost table.</td></tr>';
      return;
    }
    head.innerHTML = '<tr><th>Size</th>' + manualFabrics.map(f=>'<th>'+esc(f.label)+'<br><small>'+esc(f.description||'')+'</small></th>').join('') + '</tr>';
    body.innerHTML = manualSizes.map(size=>{
      sizeFabricPrices[size.label] = sizeFabricPrices[size.label] || {};
      sizeFabricCosts[size.label] = sizeFabricCosts[size.label] || {};
      return '<tr><td><strong>'+esc(size.label)+'</strong><br><small>'+esc([size.width||'-',size.depth||'-',size.height||'-'].join(' × '))+' cm</small></td>' + manualFabrics.map(f=>{
        return '<td><label>Selling Price Before VAT</label><input type="number" class="sf-price" data-size="'+esc(size.label)+'" data-fabric="'+esc(f.label)+'" value="'+esc(sizeFabricPrices[size.label][f.label]||'')+'" placeholder="Selling price"><label>Cost</label><input type="number" class="sf-cost" data-size="'+esc(size.label)+'" data-fabric="'+esc(f.label)+'" value="'+esc(sizeFabricCosts[size.label][f.label]||'')+'" placeholder="Cost"></td>';
      }).join('') + '</tr>';
    }).join('');
  };

  async function uploadFileToMedia(file, altText){
    const fd = new FormData();
    fd.append('file', file);
    fd.append('alt_text', altText || file.name || 'Uploaded image');
    const data = await api('/api/media', {method:'POST', body:fd});
    return data.url || data.path || data.file || '';
  }

  async function uploadFileList(files, altPrefix){
    const out = [];
    for(const file of Array.from(files || [])){
      const url = await uploadFileToMedia(file, altPrefix || file.name);
      if(url) out.push(url);
    }
    return out;
  }

  window.addColorSet = async function(){
    if(!window.hasAdminPermission('products','write')) return status('You do not have write access for products.', true);
    const name = val('colorName');
    const code = val('colorCode');
    const hex = val('colorHex') || '#183d32';
    const fabric = val('colorPhotoFabric');
    const files = q('colorFiles')?.files || [];
    if(!name) return status('Add color name.', true);
    if(!files.length && !(typeof colorSets !== 'undefined' && colorSets[name])) return status('Choose images from the Media Library/upload field first.', true);
    try{
      const urls = files.length ? await uploadFileList(files, name + ' product photo') : [];
      if(typeof colorSets === 'undefined') window.colorSets = {};
      const existing = colorSets[name] || {images:[], imageMeta:[]};
      const oldImages = Array.isArray(existing.images) ? existing.images : [];
      const oldMeta = Array.isArray(existing.imageMeta) ? existing.imageMeta : oldImages.map(url=>({url, fabric:existing.fabric || ''}));
      colorSets[name] = {
        hex: code.startsWith('#') ? code : hex,
        code: code.startsWith('#') ? '' : code,
        fabric: fabric || existing.fabric || '',
        images: oldImages.concat(urls),
        imageMeta: oldMeta.concat(urls.map(url=>({url, fabric})))
      };
      ['colorName','colorCode','colorPhotoFabric'].forEach(id=>{ if(q(id)) q(id).value=''; });
      if(q('colorFiles')) q('colorFiles').value='';
      if(typeof renderColorSets === 'function') renderColorSets();
      status('Color photos added from Media Library/server uploads.');
    }catch(e){ status('Could not upload color photos: '+e.message, true); }
  };

  window.clearForm = function(){
    document.querySelectorAll('#productsControl input:not([type=color]), #productsControl textarea').forEach(el=>{ if(el.id !== 'exportBox') el.value=''; });
    if(q('category') && q('category').options.length) q('category').selectedIndex = 0;
    if(q('vatRate')) q('vatRate').value = (typeof settings !== 'undefined' && settings.vat_rate) || 15;
    if(q('colorHex')) q('colorHex').value = '#183d32';
    try{ manualSizes=[]; manualFabrics=[]; sizeFabricPrices={}; sizeFabricCosts={}; colorSets={}; }catch(e){}
    ['manualSizeTable','manualFabricTable','sizeFabricPriceHead','sizeFabricPriceBody','colorSetsPreview'].forEach(id=>{ if(q(id)) q(id).innerHTML=''; });
    if(typeof renderManualSizeTable==='function') renderManualSizeTable();
    if(typeof renderManualFabricTable==='function') renderManualFabricTable();
    if(typeof buildSizeFabricPriceTable==='function') buildSizeFabricPriceTable();
    if(typeof renderColorSets==='function') renderColorSets();
    status('Product form cleared.');
  };


  function getMenuItems(){
    try{
      if(typeof menu !== 'undefined' && Array.isArray(menu)) return menu;
    }catch(e){}
    try{
      const saved = JSON.parse(localStorage.getItem('cms_menu') || '[]');
      if(Array.isArray(saved)){
        window.menu = saved;
        return window.menu;
      }
    }catch(e){}
    window.menu = [];
    return window.menu;
  }

  function setMenuItems(next){
    try{
      if(typeof menu !== 'undefined'){
        menu = next;
      } else {
        window.menu = next;
      }
    }catch(e){
      window.menu = next;
    }
    try{ localStorage.setItem('cms_menu', JSON.stringify(next)); }catch(e){}
    try{ sessionStorage.setItem('cms_menu', JSON.stringify(next)); }catch(e){}
  }

  window.addMenuItem = async function(){
    if(!window.hasAdminPermission('menu','write')) return status('You have read-only access for Menu.', true);
    const en = val('menu_label_en');
    const ar = val('menu_label_ar');
    const url = val('menu_url');
    if(!en || !url) return status('Add menu label and URL.', true);

    const items = getMenuItems();
    items.push({label_en:en, label_ar:ar, url, visible:true});
    setMenuItems(items);

    ['menu_label_en','menu_label_ar','menu_url'].forEach(id=>{ if(q(id)) q(id).value=''; });
    if(typeof window.renderMenu === 'function') window.renderMenu();

    try{
      await publishSettings({menu: items});
      status('Menu item added and published permanently.');
    }catch(e){
      status('Menu item added locally, but backend publish failed: '+e.message, true);
    }
  };

  window.toggleMenu = async function(i){
    if(!window.hasAdminPermission('menu','write')) return status('You have read-only access for Menu.', true);
    const items = getMenuItems();
    if(!items[i]) return;
    items[i].visible = items[i].visible === false ? true : false;
    setMenuItems(items);
    if(typeof window.renderMenu === 'function') window.renderMenu();
    try{ await publishSettings({menu:items}); status('Menu visibility updated and published.'); }
    catch(e){ status('Menu visibility updated locally, but publish failed: '+e.message, true); }
  };

  window.removeMenu = async function(i){
    if(!window.hasAdminPermission('menu','write')) return status('You have read-only access for Menu.', true);
    const items = getMenuItems();
    if(!items[i]) return;
    items.splice(i,1);
    setMenuItems(items);
    if(typeof window.renderMenu === 'function') window.renderMenu();
    try{ await publishSettings({menu:items}); status('Menu item removed and published.'); }
    catch(e){ status('Menu item removed locally, but publish failed: '+e.message, true); }
  };

  window.resetMenu = async function(){
    if(!window.hasAdminPermission('menu','write')) return status('You have read-only access for Menu.', true);
    let items = [];
    try{
      items = typeof DEFAULT_MENU !== 'undefined' ? JSON.parse(JSON.stringify(DEFAULT_MENU)) : [];
      if(typeof normalizeMenuRoutes === 'function') items = normalizeMenuRoutes(items);
    }catch(e){ items = []; }
    setMenuItems(items);
    if(typeof window.renderMenu === 'function') window.renderMenu();
    try{ await publishSettings({menu:items}); status('Default menu restored and published.'); }
    catch(e){ status('Default menu restored locally, but publish failed: '+e.message, true); }
  };

  window.saveMenu = async function(){
    if(!window.hasAdminPermission('menu','write')) return status('You have read-only access for Menu.', true);
    try{
      if(typeof normalizeMenuRoutes === 'function') menu = normalizeMenuRoutes(menu || []);
      await publishSettings({menu: menu || []});
      localStorage.setItem('cms_menu', JSON.stringify(menu || []));
      status('Menu published permanently.');
    }catch(e){ status('Menu could not publish: '+e.message, true); }
  };

  window.saveCategories = async function(){
    if(!window.hasAdminPermission('categories','write')) return status('You have read-only access for Categories.', true);
    try{
      await publishSettings({categories: categories || []});
      localStorage.setItem('cms_categories', JSON.stringify(categories || []));
      status('Categories published permanently.');
    }catch(e){ status('Categories could not publish: '+e.message, true); }
  };

  window.saveSeoPage = async function(){
    if(!window.hasAdminPermission('seo','write')) return status('You have read-only access for SEO.', true);
    try{
      if(typeof ensureSeoPages === 'function') ensureSeoPages();
      const key = val('seoPageKey') || 'home';
      const title = val('seoTitle');
      const description = val('seoDescription');
      if(typeof settings === 'undefined') window.settings = {};
      settings.seo_pages = settings.seo_pages || {};
      settings.seo_pages[key] = Object.assign({}, settings.seo_pages[key] || {}, {title, title_en:title, description, description_en:description, keywords: settings.seo_pages[key]?.keywords || []});
      await publishSettings({seo_pages: settings.seo_pages});
      if(typeof renderSeoPagesList === 'function') renderSeoPagesList();
      status('SEO published permanently.');
    }catch(e){ status('SEO could not publish: '+e.message, true); }
  };

  window.saveSettings = async function(){
    if(!window.hasAdminPermission('pictures','write') && !window.hasAdminPermission('settings','write')) return status('You have read-only access for settings/pictures.', true);
    try{
      if(typeof settings === 'undefined') window.settings = {};
      // Upload banner file inputs to Media Library first, then save only /uploads URLs.
      for(let i=1;i<=5;i++){
        const fileInput = q('heroBannerFile'+i);
        if(fileInput && fileInput.files && fileInput.files[0]){
          const url = await uploadFileToMedia(fileInput.files[0], 'Homepage banner '+i);
          if(url && q('hero_banner_'+i)) q('hero_banner_'+i).value = url;
          fileInput.value = '';
        }
      }
      const keys = ['brand_en','brand_ar','whatsapp_number','currency','vat_rate','riyadh_delivery','outside_riyadh_delivery','hero_title_en','hero_title_ar','hero_text_en','hero_text_ar','intro_title_en','intro_title_ar','intro_text_en','intro_text_ar','footer_text_en','footer_text_ar','hero_image','hero_banner_1','hero_banner_2','hero_banner_3','hero_banner_4','hero_banner_5','instagram_url','tiktok_url','facebook_url','x_url','linkedin_url','youtube_url','snapchat_url','footer_cr_number','footer_vat_number','footer_address','footer_email','footer_phone','footer_extra_info_en','footer_extra_info_ar','auto_translate_arabic'];
      keys.forEach(k=>{ const el=q(k); if(el) settings[k] = el.type==='checkbox' ? el.checked : (el.type==='number' ? Number(el.value) : el.value); });
      settings.hero_banners = [1,2,3,4,5].map(i=>val('hero_banner_'+i)).filter(Boolean).filter(x=>!x.startsWith('file://'));
      settings.hero_image = settings.hero_banners[0] || settings.hero_image || '';
      await publishSettings(settings);
      if(typeof renderHeroPreview === 'function') renderHeroPreview();
      status('Website settings and banners published permanently.');
    }catch(e){ status('Saved locally only. Backend publish failed: '+e.message, true); }
  };


  window.loadMedia = async function(){
    const grid = q('mediaGrid');
    if(!grid) return;
    try{
      const list = await api('/api/media', {method:'GET'});
      window.cvMediaCache = Array.isArray(list) ? list : [];
      if(!window.cvMediaCache.length){
        grid.innerHTML = '<p>No images uploaded yet.</p>';
        return;
      }
      grid.innerHTML = window.cvMediaCache.map(m=>{
        const kb = Math.max(1, Math.round(Number(m.size_bytes||0)/1024));
        const imgUrl = m.url || '';
        return '<div class="media-card" style="border:1px solid #ddd;border-radius:12px;padding:10px;display:inline-block;width:190px;vertical-align:top;margin:7px;background:#fff;">'
          + '<img src="'+esc(imgUrl)+'" alt="'+esc(m.alt_text||'')+'" style="width:100%;height:125px;object-fit:cover;border-radius:8px;background:#f5f1e8;">'
          + '<div style="font-size:12px;margin-top:6px;word-break:break-word;"><strong>'+esc(m.original_name||m.filename||'image')+'</strong><br>'+esc(m.mime||'image')+' · '+kb+' KB<br>'+esc((m.created_at||'').slice(0,16).replace('T',' '))+'</div>'
          + '<input id="mediaAlt_'+esc(m.id)+'" value="'+esc(m.alt_text||'')+'" placeholder="Alt text" style="width:100%;margin-top:6px;">'
          + '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;">'
          + '<button type="button" class="btn secondary" data-media-save-alt="'+esc(m.id)+'">Save Alt</button>'
          + '<button type="button" class="btn secondary" data-media-assign="'+esc(m.id)+'">Assign</button>'
          + '<button type="button" class="btn" data-media-delete="'+esc(m.id)+'">Delete</button>'
          + '</div></div>';
      }).join('');
    }catch(e){
      console.error('Media load failed:', e);
      status('Could not load Media Library: '+e.message, true);
    }
  };

  let cvMediaUploadInProgress = false;

  window.uploadMedia = async function(){
    if(cvMediaUploadInProgress) return;
    cvMediaUploadInProgress = true;
    if(!window.hasAdminPermission('media','write') && !window.hasAdminPermission('pictures','write')){
      cvMediaUploadInProgress = false;
      return status('You do not have permission to upload media.', true);
    }
    const input = q('mediaFileInput');
    const altInput = q('mediaAltInput');
    const file = input && input.files && input.files[0];
    if(!file){ cvMediaUploadInProgress = false; return status('Choose an image file first.', true); }
    try{
      await uploadFileToMedia(file, altInput?.value || file.name || 'Uploaded image');
      if(input) input.value = '';
      if(altInput) altInput.value = '';
      await window.loadMedia();
      status('Image uploaded to Media Library.');
    }catch(e){
      console.error('Media upload failed:', e);
      status('Upload failed: '+e.message, true);
    }finally{
      cvMediaUploadInProgress = false;
    }
  };

  window.saveMediaAlt = async function(id){
    try{
      const el = q('mediaAlt_'+id);
      await api('/api/media/'+encodeURIComponent(id), {method:'PUT', body:{alt_text: el ? el.value : ''}});
      await window.loadMedia();
      status('Alt text saved.');
    }catch(e){ status('Could not save alt text: '+e.message, true); }
  };

  window.deleteMedia = async function(id){
    if(!confirm('Delete this image from the media library?')) return;
    try{
      await api('/api/media/'+encodeURIComponent(id), {method:'DELETE'});
      await window.loadMedia();
      status('Image deleted from Media Library.');
    }catch(e){ status('Could not delete image: '+e.message, true); }
  };

  window.assignMedia = async function(id, targetType, targetId){
    try{
      await api('/api/media/'+encodeURIComponent(id)+'/assign', {method:'POST', body:{target_type:targetType, target_id:targetId || ''}});
      await window.loadMedia();
      status('Media assigned.');
    }catch(e){ status('Could not assign media: '+e.message, true); }
  };

  window.openAssignMedia = function(id){
    const targetType = prompt('Assign to: product, banner, page, or section');
    if(!targetType) return;
    const t = String(targetType).trim().toLowerCase();
    if(!['product','banner','page','section'].includes(t)) return status('Invalid target type.', true);
    const targetId = prompt(t === 'banner' ? 'Banner slot number 1-5' : 'Target id / key') || '';
    window.assignMedia(id, t, targetId.trim());
  };

  function bindMediaLibraryButtons(){
    document.addEventListener('click', function(e){
      const uploadBtn = e.target.closest('[data-media-upload]');
      if(uploadBtn){ e.preventDefault(); e.stopPropagation(); window.uploadMedia(); return; }
      const save = e.target.closest('[data-media-save-alt]');
      if(save){ e.preventDefault(); window.saveMediaAlt(save.dataset.mediaSaveAlt); return; }
      const del = e.target.closest('[data-media-delete]');
      if(del){ e.preventDefault(); window.deleteMedia(del.dataset.mediaDelete); return; }
      const assign = e.target.closest('[data-media-assign]');
      if(assign){ e.preventDefault(); window.openAssignMedia(assign.dataset.mediaAssign); return; }
    }, true);
  }

  async function chooseFromMedia(callback){
    try{
      const list = await api('/api/media', {method:'GET'});
      if(!Array.isArray(list) || !list.length) return status('Media Library is empty. Upload images in Media Library first.', true);
      const overlay = document.createElement('div');
      overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
      overlay.innerHTML='<div style="background:#fff;max-width:900px;max-height:80vh;overflow:auto;border-radius:18px;padding:18px;"><h2>Select from Media Library</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;">'+list.map(m=>'<button type="button" data-url="'+esc(m.url)+'" style="border:1px solid #ddd;background:#fff;border-radius:12px;padding:8px;cursor:pointer;text-align:left"><img src="'+esc(m.url)+'" style="width:100%;height:100px;object-fit:cover;border-radius:8px"><small>'+esc(m.original_name||m.filename||m.url)+'</small></button>').join('')+'</div><p><button type="button" data-close="1">Close</button></p></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e=>{
        const btn = e.target.closest('button');
        if(!btn) return;
        if(btn.dataset.close){ overlay.remove(); return; }
        if(btn.dataset.url){ callback(btn.dataset.url); overlay.remove(); }
      });
    }catch(e){ status('Could not load Media Library: '+e.message, true); }
  }

  function installMediaButtons(){
    for(let i=1;i<=5;i++){
      const input=q('hero_banner_'+i);
      if(input && !input.dataset.mediaButton){
        input.dataset.mediaButton='1';
        const btn=document.createElement('button'); btn.type='button'; btn.className='btn secondary'; btn.textContent='Choose from Media Library';
        btn.addEventListener('click',()=>chooseFromMedia(url=>{ input.value=url; if(typeof renderHeroPreview==='function') renderHeroPreview(); }));
        input.insertAdjacentElement('afterend', btn);
      }
    }
    const colorFiles=q('colorFiles');
    if(colorFiles && !colorFiles.dataset.mediaButton){
      colorFiles.dataset.mediaButton='1';
      const btn=document.createElement('button'); btn.type='button'; btn.className='btn secondary'; btn.textContent='Choose Product Photo from Media Library';
      btn.addEventListener('click',()=>chooseFromMedia(url=>{
        const name=val('colorName');
        if(!name) return status('Enter color name first, then choose a product photo.', true);
        if(typeof colorSets==='undefined') window.colorSets={};
        const set=colorSets[name] || {hex:val('colorHex')||'#183d32', code:val('colorCode'), images:[], imageMeta:[]};
        set.images=(set.images||[]).concat(url); set.imageMeta=(set.imageMeta||[]).concat({url, fabric:val('colorPhotoFabric')});
        colorSets[name]=set; if(typeof renderColorSets==='function') renderColorSets();
      }));
      colorFiles.insertAdjacentElement('afterend', btn);
    }
  }

  function patchAnalytics(){
    const sel=q('analyticsPeriod');
    if(sel && !sel.querySelector('option[value="60"]')){
      const opt=document.createElement('option'); opt.value='60'; opt.textContent='Last 60 Days'; sel.insertBefore(opt, sel.querySelector('option[value="90"]'));
    }
    const link=document.querySelector('a[href="customer-journey-dashboard.html"]');
    if(link){
      link.addEventListener('click', function(){ const days=q('analyticsPeriod')?.value || '30'; this.href='customer-journey-dashboard.html?days='+encodeURIComponent(days); });
    }
  }

  const oldLoadAnalytics = window.loadAnalyticsCenter;
  window.loadAnalyticsCenter = async function(){
    localStorage.setItem('cvAnalyticsDays', q('analyticsPeriod')?.value || '30');
    return typeof oldLoadAnalytics === 'function' ? oldLoadAnalytics() : undefined;
  };

  document.addEventListener('input', function(e){ if(e.target && (e.target.classList.contains('sf-price') || e.target.classList.contains('sf-cost')) && typeof captureSizeFabricPrices==='function') captureSizeFabricPrices(); }, true);
  document.addEventListener('change', function(e){ if(e.target && (e.target.classList.contains('sf-price') || e.target.classList.contains('sf-cost')) && typeof captureSizeFabricPrices==='function') captureSizeFabricPrices(); }, true);

  document.addEventListener('DOMContentLoaded', function(){ normalizeSession(); bindInlineActions(); bindMediaLibraryButtons(); installMediaButtons(); patchAnalytics(); window.loadMedia(); });
  setTimeout(function(){ normalizeSession(); installMediaButtons(); patchAnalytics(); window.loadMedia(); }, 500);
})();
