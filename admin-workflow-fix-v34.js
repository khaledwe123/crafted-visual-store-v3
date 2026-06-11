/*
  Crafted Visual Admin Workflow Fix v26
  Focus: product edit/preview CSP action bridge, full table view, fabric dropdown sync, and product media controls only.
*/
(function(){
  'use strict';

/* === CV compatibility fix: missing getMenuItems / setMenuItems === */
(function(){
  'use strict';
  if(!window.getMenuItems){
    window.getMenuItems = function(){
      try{
        if(Array.isArray(window.menu)) return window.menu;
      }catch(e){}
      try{
        if(typeof menu !== 'undefined' && Array.isArray(menu)) return menu;
      }catch(e){}
      try{
        var raw = localStorage.getItem('cms_menu') || sessionStorage.getItem('cms_menu') || '[]';
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }catch(e){
        console.warn('getMenuItems fallback failed', e);
        return [];
      }
    };
  }
  if(!window.setMenuItems){
    window.setMenuItems = function(items){
      if(!Array.isArray(items)) items = [];
      try{ window.menu = items; }catch(e){}
      try{ if(typeof menu !== 'undefined') menu = items; }catch(e){}
      try{ localStorage.setItem('cms_menu', JSON.stringify(items)); }catch(e){}
      try{ sessionStorage.setItem('cms_menu', JSON.stringify(items)); }catch(e){}
      try{ if(typeof window.renderMenu === 'function') window.renderMenu(); }catch(e){}
      return items;
    };
  }
})();


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
      const safe = /^(addMenuItem|toggleMenu|removeMenu|resetMenu|addCategory|toggleCategory|removeCategory|addManualSize|addManualFabric|buildSizeFabricPriceTable|addColorSet|clearForm|saveMenu|saveSettings|saveCategories|saveSeoPage|loadAnalyticsCenter|uploadMedia|loadMedia|saveMediaAlt|deleteMedia|openAssignMedia|assignMedia|editProduct|duplicateProduct|deleteProduct|exportProducts|downloadPrototypeProductsJson|openRealShop|openPrototypeShopPreview|closeInlineShopPreview|openPrototypeDetailByIndex|cvFinalClosePreview|cvFinalOpenDetails|cvFinalSelectImage|cvFinalChooseOption|cvFinalAddToCart|saveCustomPage|clearCustomPageForm|editCustomPage|deleteCustomPage|toggleCustomPage|renderCustomPageList)$/.test(m[1]);
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

  function getManualFabricsSource(){
    // The original admin.js may keep manualFabrics as a global lexical variable, not window.manualFabrics.
    // This helper reads both safely so the Colors & Product Photos fabric dropdown always reflects Manual Fabrics.
    try{
      if(Array.isArray(window.manualFabrics) && window.manualFabrics.length) return window.manualFabrics;
    }catch(e){}
    try{
      if(eval('typeof manualFabrics !== "undefined"') && Array.isArray(eval('manualFabrics'))) return eval('manualFabrics');
    }catch(e){}
    try{
      if(!Array.isArray(window.manualFabrics)) window.manualFabrics = [];
      return window.manualFabrics;
    }catch(e){ return []; }
  }

  function setManualFabricsSource(next){
    try{ window.manualFabrics = next; }catch(e){}
    try{ if(eval('typeof manualFabrics !== "undefined"')) eval('manualFabrics = window.manualFabrics'); }catch(e){}
  }

  function normalizeFabricArray(){
    try{
      const src = getManualFabricsSource();
      return src
        .map(f => typeof f === 'string' ? {label:f, description:''} : (f || {}))
        .filter(f => String(f.label || '').trim())
        .map(f => ({label:String(f.label || '').trim(), description:String(f.description || '').trim()}));
    }catch(e){ return []; }
  }

  function getColorFabricValue(){
    const el = q('colorPhotoFabric');
    if(!el) return '';
    return String(el.value || '').trim();
  }

  window.refreshFabricDropdowns = function(){
    const fabrics = normalizeFabricArray();
    const oldInput = q('colorPhotoFabric');
    if(oldInput && oldInput.tagName !== 'SELECT'){
      const sel = document.createElement('select');
      sel.id = oldInput.id;
      sel.className = oldInput.className || '';
      sel.setAttribute('aria-label', 'Fabric for product photos');
      oldInput.replaceWith(sel);
    }
    const sel = q('colorPhotoFabric');
    if(sel && sel.tagName === 'SELECT'){
      const current = sel.value;
      sel.innerHTML = '<option value="">Select fabric for these photos</option>' + fabrics.map(f => '<option value="'+esc(f.label)+'">'+esc(f.label)+'</option>').join('');
      if(current && Array.from(sel.options).some(o => o.value === current)) sel.value = current;
    }
    document.querySelectorAll('[data-fabric-select], .fabric-select').forEach(select => {
      const current = select.value;
      select.innerHTML = '<option value="">Select Fabric</option>' + fabrics.map(f => '<option value="'+esc(f.label)+'">'+esc(f.label)+'</option>').join('');
      if(current && Array.from(select.options).some(o => o.value === current)) select.value = current;
    });
  };

  const cvUploadSignatures = window.cvUploadSignatures || new Set();
  window.cvUploadSignatures = cvUploadSignatures;

  function mediaSignature(file){
    return [file.name || '', file.size || 0, file.lastModified || 0].join('|');
  }

  async function mediaAlreadyExists(file){
    try{
      if(Array.isArray(window.cvMediaCache) && window.cvMediaCache.length){
        const found = window.cvMediaCache.find(m => String(m.original_name || m.filename || '').toLowerCase() === String(file.name || '').toLowerCase() && Number(m.size_bytes || m.size || 0) === Number(file.size || 0));
        if(found) return found;
      }
      const list = await api('/api/media', {method:'GET'});
      if(Array.isArray(list)){
        window.cvMediaCache = list;
        return list.find(m => String(m.original_name || m.filename || '').toLowerCase() === String(file.name || '').toLowerCase() && Number(m.size_bytes || m.size || 0) === Number(file.size || 0));
      }
    }catch(e){}
    return null;
  }

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
    const currentFabrics = getManualFabricsSource();
    currentFabrics.push({label,description});
    setManualFabricsSource(currentFabrics);
    ['fabricNameInput','fabricDescInput'].forEach(id=>{ if(q(id)) q(id).value=''; });
    if(typeof renderManualFabricTable === 'function') renderManualFabricTable();
    if(typeof buildSizeFabricPriceTable === 'function') buildSizeFabricPriceTable();
    if(typeof window.refreshFabricDropdowns === 'function') window.refreshFabricDropdowns();
    status('Fabric added: '+label);
  };

  window.buildSizeFabricPriceTable = function(){
    const head = q('sizeFabricPriceHead');
    const body = q('sizeFabricPriceBody');
    if(!head || !body) return;
    if(typeof manualSizes === 'undefined') window.manualSizes = [];
    const liveFabrics = getManualFabricsSource();
    setManualFabricsSource(liveFabrics);
    try{ if(typeof manualFabrics !== 'undefined') manualFabrics = liveFabrics; }catch(e){}
    if(typeof sizeFabricPrices === 'undefined') window.sizeFabricPrices = {};
    if(typeof sizeFabricCosts === 'undefined') window.sizeFabricCosts = {};
    if(!manualSizes.length || !liveFabrics.length){
      head.innerHTML='';
      body.innerHTML='<tr><td>Add at least one size and one fabric to build the price and cost table.</td></tr>';
      return;
    }
    head.innerHTML = '<tr><th>Size</th>' + liveFabrics.map(f=>'<th>'+esc(f.label)+'<br><small>'+esc(f.description||'')+'</small></th>').join('') + '</tr>';
    body.innerHTML = manualSizes.map(size=>{
      sizeFabricPrices[size.label] = sizeFabricPrices[size.label] || {};
      sizeFabricCosts[size.label] = sizeFabricCosts[size.label] || {};
      return '<tr><td><strong>'+esc(size.label)+'</strong><br><small>'+esc([size.width||'-',size.depth||'-',size.height||'-'].join(' × '))+' cm</small></td>' + liveFabrics.map(f=>{
        return '<td><label>Selling Price Before VAT</label><input type="number" class="sf-price" data-size="'+esc(size.label)+'" data-fabric="'+esc(f.label)+'" value="'+esc(sizeFabricPrices[size.label][f.label]||'')+'" placeholder="Selling price"><label>Cost</label><input type="number" class="sf-cost" data-size="'+esc(size.label)+'" data-fabric="'+esc(f.label)+'" value="'+esc(sizeFabricCosts[size.label][f.label]||'')+'" placeholder="Cost"></td>';
      }).join('') + '</tr>';
    }).join('');
  };

  async function uploadFileToMedia(file, altText){
    if(!file) return '';
    const sig = mediaSignature(file);
    const existing = await mediaAlreadyExists(file);
    if(existing && (existing.url || existing.path || existing.file)){
      status('Image already exists in Media Library. Reusing existing file.');
      return existing.url || existing.path || existing.file || '';
    }
    if(cvUploadSignatures.has(sig)){
      status('Duplicate upload skipped for '+(file.name || 'image')+'.');
      return '';
    }
    cvUploadSignatures.add(sig);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('alt_text', altText || file.name || 'Uploaded image');
    try{
      const data = await api('/api/media', {method:'POST', body:fd});
      const url = data.url || data.path || data.file || '';
      try{ window.cvMediaCache = await api('/api/media', {method:'GET'}); }catch(e){}
      return url;
    }catch(e){
      cvUploadSignatures.delete(sig);
      throw e;
    }
  }

  async function uploadFileList(files, altPrefix){
    const out = [];
    for(const file of Array.from(files || [])){
      const url = await uploadFileToMedia(file, altPrefix || file.name);
      if(url) out.push(url);
    }
    return out;
  }

  let cvAddColorInProgress = false;

  window.addColorSet = async function(){
    if(cvAddColorInProgress) return;
    cvAddColorInProgress = true;
    if(!window.hasAdminPermission('products','write')){ cvAddColorInProgress = false; return status('You do not have write access for products.', true); }
    const name = val('colorName');
    const code = val('colorCode');
    const hex = val('colorHex') || '#183d32';
    const fabric = getColorFabricValue();
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
    finally{ cvAddColorInProgress = false; }
  };

  window.clearForm = function(){
    document.querySelectorAll('#productsControl input:not([type=color]), #productsControl textarea').forEach(el=>{ if(el.id !== 'exportBox') el.value=''; });
    if(q('category') && q('category').options.length) q('category').selectedIndex = 0;
    if(q('vatRate')) q('vatRate').value = (typeof settings !== 'undefined' && settings.vat_rate) || 15;
    if(q('colorHex')) q('colorHex').value = '#183d32';
    try{ manualSizes=[]; setManualFabricsSource([]); if(typeof manualFabrics !== 'undefined') manualFabrics=[]; sizeFabricPrices={}; sizeFabricCosts={}; colorSets={}; }catch(e){}
    ['manualSizeTable','manualFabricTable','sizeFabricPriceHead','sizeFabricPriceBody','colorSetsPreview'].forEach(id=>{ if(q(id)) q(id).innerHTML=''; });
    if(typeof renderManualSizeTable==='function') renderManualSizeTable();
    if(typeof renderManualFabricTable==='function') renderManualFabricTable();
    if(typeof buildSizeFabricPriceTable==='function') buildSizeFabricPriceTable();
    if(typeof renderColorSets==='function') renderColorSets();
    if(typeof window.refreshFabricDropdowns === 'function') window.refreshFabricDropdowns();
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
        set.images=(set.images||[]).concat(url); set.imageMeta=(set.imageMeta||[]).concat({url, fabric:getColorFabricValue()});
        colorSets[name]=set; if(typeof renderColorSets==='function') renderColorSets();
      }));
      colorFiles.insertAdjacentElement('afterend', btn);
    }
  }



  function installProductWorkflowV26Fixes(){
    // Make the price matrix usable on laptop screens without hiding columns.
    if(!document.getElementById('cvProductTableV26Style')){
      const style = document.createElement('style');
      style.id = 'cvProductTableV26Style';
      style.textContent = `
        #productsControl .table-scroll{width:100%;max-width:100%;overflow-x:auto;overflow-y:visible;-webkit-overflow-scrolling:touch;}
        #sizeFabricPriceHead, #sizeFabricPriceBody{min-width:720px;}
        #sizeFabricPriceHead th, #sizeFabricPriceBody td{min-width:220px;vertical-align:top;}
        #sizeFabricPriceBody td:first-child{min-width:150px;position:sticky;left:0;background:#fff;z-index:2;}
        #sizeFabricPriceBody input{box-sizing:border-box;width:100%;max-width:100%;}
        #colorPhotoFabric{min-width:160px;max-width:100%;}
      `;
      document.head.appendChild(style);
    }

    // Force the Colors & Product Photos fabric control to be a dropdown loaded from Manual Fabrics.
    window.refreshFabricDropdowns();

    // Patch original editProduct so edited products reload Manual Fabrics into the dropdown after the original form fill.
    if(!window.__cvV26EditProductPatched && typeof window.editProduct === 'function'){
      const originalEditProduct = window.editProduct;
      window.editProduct = function(pid){
        const result = originalEditProduct.apply(window, arguments);
        setTimeout(function(){
          try{ window.refreshFabricDropdowns(); }catch(e){}
          try{ window.buildSizeFabricPriceTable(); }catch(e){}
        }, 80);
        return result;
      };
      window.__cvV26EditProductPatched = true;
    }

    // Keep the preview/open buttons working under CSP by wiring them without inline execution.
    document.querySelectorAll('button[onclick*="openRealShop"],button[onclick*="openPrototypeShopPreview"]').forEach(btn=>{
      if(btn.dataset.cvV26PreviewBound) return;
      btn.dataset.cvV26PreviewBound = '1';
      btn.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        if(typeof window.openPrototypeShopPreview === 'function' && /preview/i.test(btn.textContent||'')) window.openPrototypeShopPreview();
        else if(typeof window.openRealShop === 'function') window.openRealShop();
        else window.location.href = 'shop.html';
      }, true);
    });
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

  document.addEventListener('DOMContentLoaded', function(){ normalizeSession(); bindInlineActions(); bindMediaLibraryButtons(); installMediaButtons(); installProductWorkflowV26Fixes(); patchAnalytics(); window.loadMedia(); });
  setTimeout(function(){ normalizeSession(); installMediaButtons(); installProductWorkflowV26Fixes(); patchAnalytics(); window.loadMedia(); }, 500);

  /* === v27 focused product publish + product photo removal fix ===
     Fixes only:
     - remove product picture under CSP
     - remove whole color set under CSP
     - publish new/edited products to backend reliably
     Nothing else is changed.
  */
  function cv27GetGlobal(name, fallback){
    try{ return (0,eval)(name); }catch(e){ return fallback; }
  }
  function cv27SetGlobal(name, value){
    try{ (0,eval)(name + ' = arguments[1]')(name, value); }catch(e){ try{ window[name] = value; }catch(_){} }
  }
  function cv27Array(name){
    const v = cv27GetGlobal(name, window[name]);
    return Array.isArray(v) ? v : [];
  }
  function cv27Object(name){
    const v = cv27GetGlobal(name, window[name]);
    return v && typeof v === 'object' ? v : {};
  }
  function cv27Value(id){ return (document.getElementById(id)?.value || '').trim(); }
  function cv27Number(id, fallback){
    const n = Number(cv27Value(id));
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }
  function cv27Token(){ return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || ''; }
  async function cv27Api(path, options){
    const t = cv27Token();
    if(!t) throw new Error('Missing admin token. Please logout and login again.');
    const res = await fetch('/api' + path, Object.assign({method:'GET'}, options || {}, {
      headers:Object.assign({'Content-Type':'application/json', Authorization:'Bearer ' + t}, (options && options.headers) || {})
    }));
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.error || ('API failed: ' + res.status));
    return data;
  }
  function cv27Show(message, isError){
    if(typeof window.showAdminStatus === 'function') window.showAdminStatus(message, !!isError);
    else alert(message);
  }
  function cv27EscapeCss(value){
    if(window.CSS && CSS.escape) return CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }
  function cv27GetColors(){
    const colors = cv27Object('colorSets');
    Object.keys(colors).forEach(name => {
      const set = colors[name] || {};
      if(Array.isArray(set.images) && !Array.isArray(set.imageMeta)){
        set.imageMeta = set.images.map(url => ({url, fabric:set.fabric || ''}));
      }
    });
    return colors;
  }
  function cv27SetColors(next){
    try{ colorSets = next; }catch(e){ window.colorSets = next; }
  }
  window.removeColorImage = function(name, idx){
    const colors = cv27GetColors();
    if(!colors[name]) return;
    const i = Number(idx);
    if(Array.isArray(colors[name].images)) colors[name].images.splice(i, 1);
    if(Array.isArray(colors[name].imageMeta)) colors[name].imageMeta.splice(i, 1);
    cv27SetColors(colors);
    if(typeof window.renderColorSets === 'function') window.renderColorSets();
    cv27Show('Product picture removed. Click Save Product to publish the change.');
  };
  window.removeColorSet = function(name){
    const colors = cv27GetColors();
    if(!colors[name]) return;
    delete colors[name];
    cv27SetColors(colors);
    if(typeof window.renderColorSets === 'function') window.renderColorSets();
    cv27Show('Color photo group removed. Click Save Product to publish the change.');
  };
  function cv27CollectSizeOptions(){
    try{ if(typeof window.captureSizeFabricPrices === 'function') window.captureSizeFabricPrices(); }catch(e){}
    const manualSizes = cv27Array('manualSizes');
    const manualFabrics = cv27Array('manualFabrics');
    const priceMap = cv27Object('sizeFabricPrices');
    const firstFabric = manualFabrics[0]?.label || manualFabrics[0] || 'Standard Fabric';
    if(manualSizes.length){
      return manualSizes.map(s => ({
        label:String(s.label || s.name || '').trim(),
        width:String(s.width || ''),
        depth:String(s.depth || ''),
        height:String(s.height || ''),
        price:Number(priceMap?.[s.label]?.[firstFabric] || cv27Value('price') || 0)
      })).filter(s => s.label);
    }
    return [{label:'Custom Size', width:'', depth:'', height:'', price:cv27Number('price',0)}];
  }
  function cv27CollectFabricOptions(sizeOptions){
    const manualFabrics = cv27Array('manualFabrics');
    const priceMap = cv27Object('sizeFabricPrices');
    const costMap = cv27Object('sizeFabricCosts');
    const fallbackFabric = [{label:'Standard Fabric', description:'', sizePrices:{}, sizeCosts:{}}];
    const fabrics = manualFabrics.length ? manualFabrics : fallbackFabric;
    return fabrics.map(f => {
      const label = String(f.label || f.name || f || '').trim() || 'Standard Fabric';
      const sizePrices = {};
      const sizeCosts = {};
      sizeOptions.forEach(s => {
        sizePrices[s.label] = Number(priceMap?.[s.label]?.[label] || s.price || cv27Value('price') || 0);
        sizeCosts[s.label] = Number(costMap?.[s.label]?.[label] || cv27Value('costPrice') || 0);
      });
      return {label, description:String(f.description || ''), sizePrices, sizeCosts};
    });
  }
  function cv27CategoryArabic(category){
    try{ if(typeof window.getCategoryArabic === 'function') return window.getCategoryArabic(category); }catch(e){}
    return cv27Value('category_ar') || '';
  }
  function cv27Arabic(en, ar){
    try{ if(typeof window.ensureArabic === 'function') return window.ensureArabic(en, ar); }catch(e){}
    return ar || en;
  }
  window.saveProduct = async function(){
    if(typeof window.hasAdminPermission === 'function' && !window.hasAdminPermission('products','write')){
      cv27Show('You have read-only access for Products.', true);
      return;
    }
    const name = cv27Value('name');
    if(!name){ cv27Show('Product name is required.', true); return; }
    const productId = cv27Value('id') || (name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + Date.now());
    const productsList = cv27Array('products');
    const existing = productsList.find(p => String(p.id) === String(productId));
    const colors = cv27GetColors();
    if(!Object.keys(colors).length){ cv27Show('Add at least one product color photo.', true); return; }
    const selectedCategory = cv27Value('category') || 'Beds';
    const sizeOptions = cv27CollectSizeOptions();
    const fabricOptions = cv27CollectFabricOptions(sizeOptions);
    const firstFabric = fabricOptions[0]?.label || 'Standard Fabric';
    const firstSize = sizeOptions[0]?.label || 'Custom Size';
    const sizeFabricCosts = cv27Object('sizeFabricCosts');
    const product = {
      id: productId,
      _dbId: existing?._dbId,
      name,
      name_ar: cv27Arabic(name, cv27Value('name_ar')),
      category: selectedCategory,
      category_ar: cv27CategoryArabic(selectedCategory),
      price: cv27Number('price', sizeOptions[0]?.price || 0),
      costPrice: Number(sizeFabricCosts?.[firstSize]?.[firstFabric] || cv27Value('costPrice') || 0),
      vatRate: cv27Number('vatRate', 15),
      discountPercent: cv27Number('discountPercent', 0),
      description: cv27Value('description'),
      description_ar: cv27Arabic(cv27Value('description'), cv27Value('description_ar')),
      sizeOptions,
      sizes: sizeOptions.map(s => s.label),
      fabricOptions,
      fabrics: fabricOptions.map(f => f.label),
      colors,
      gallery: cv27Value('gallery') ? cv27Value('gallery').split('\n').map(x=>x.trim()).filter(Boolean) : [],
      publishPages: (typeof window.getSelectedPublishPages === 'function' ? window.getSelectedPublishPages('productPublishPages') : ['shop.html'])
    };
    const payload = {
      sku: product.id,
      name_en: product.name,
      name_ar: product.name_ar,
      category_name: product.category,
      category_ar: product.category_ar,
      description_en: product.description,
      description_ar: product.description_ar,
      base_price: product.price,
      vat_rate: product.vatRate,
      active: true,
      data: product
    };
    try{
      let result;
      if(existing && existing._dbId){
        result = await cv27Api('/products/' + encodeURIComponent(existing._dbId), {method:'PUT', body:JSON.stringify(payload)});
        product._dbId = existing._dbId;
      }else{
        result = await cv27Api('/products', {method:'POST', body:JSON.stringify(payload)});
        if(result && result.id) product._dbId = result.id;
      }
      const idx = productsList.findIndex(p => String(p.id) === String(product.id));
      if(idx >= 0) productsList[idx] = product; else productsList.unshift(product);
      try{ products = productsList; }catch(e){ window.products = productsList; }
      try{ if(typeof window.prototypeProductsWrite === 'function') window.prototypeProductsWrite(productsList); else localStorage.setItem('cms_products', JSON.stringify(productsList)); }catch(e){}
      if(typeof window.renderProductsAdmin === 'function') window.renderProductsAdmin();
      if(typeof window.renderDiscountTargets === 'function') window.renderDiscountTargets();
      if(typeof window.renderDiscountList === 'function') window.renderDiscountList();
      if(typeof window.clearForm === 'function') window.clearForm();
      cv27Show('Product published permanently to the live backend.');
    }catch(e){
      console.error('v27 product publish failed', e);
      cv27Show('Could not publish product: ' + e.message, true);
    }
  };
  document.addEventListener('click', function(event){
    const el = event.target.closest('[onclick]');
    if(!el) return;
    const raw = el.getAttribute('onclick') || '';
    const m = raw.trim().match(/^([A-Za-z_$][\w$]*)\((.*)\);?$/s);
    if(!m) return;
    const fnName = m[1];
    if(!['removeColorImage','removeColorSet','saveProduct'].includes(fnName)) return;
    event.preventDefault();
    event.stopPropagation();
    const args = (m[2] || '').split(',').map(v => {
      v = v.trim();
      if(/^['"].*['"]$/.test(v)) return v.slice(1,-1).replace(/\\'/g,"'").replace(/\\"/g,'"');
      if(/^-?\d+$/.test(v)) return Number(v);
      return v;
    });
    window[fnName].apply(window, args);
  }, true);



  /* === v28 focused product editor fix ===
     Fixes only:
     - product picture remove under CSP
     - new/edited product publish
     - manual size remove when editing
     - excel-style size/fabric table that fits the screen
     Nothing outside Products is changed.
  */
  function cv28Get(name, fallback){ try{ return (0,eval)(name); }catch(e){ return fallback; } }
  function cv28Set(name, value){ try{ window[name] = value; }catch(e){} try{ (0,eval)(name + ' = window["' + name + '"]'); }catch(e){} }
  function cv28Arr(name){ const v = cv28Get(name, window[name]); return Array.isArray(v) ? v : []; }
  function cv28Obj(name){ const v = cv28Get(name, window[name]); return v && typeof v === 'object' ? v : {}; }
  function cv28Q(id){ return document.getElementById(id); }
  function cv28Val(id){ return (cv28Q(id)?.value || '').trim(); }
  function cv28Num(id, fb){ const n=Number(cv28Val(id)); return Number.isFinite(n)?n:Number(fb||0); }
  function cv28Msg(m,e){ if(typeof window.showAdminStatus==='function') window.showAdminStatus(m,!!e); else alert(m); }
  function cv28Esc(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function cv28Token(){ return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || ''; }
  async function cv28Api(path, options){
    const t=cv28Token();
    if(!t) throw new Error('Missing admin token. Logout and login again.');
    const res=await fetch('/api'+path, Object.assign({method:'GET'}, options||{}, {headers:Object.assign({'Content-Type':'application/json',Authorization:'Bearer '+t}, (options&&options.headers)||{})}));
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || ('API failed: '+res.status));
    return data;
  }
  function cv28Css(){
    if(document.getElementById('cv28-product-editor-css')) return;
    const st=document.createElement('style'); st.id='cv28-product-editor-css';
    st.textContent=`
      #productsControl .admin-grid{display:grid;grid-template-columns:minmax(760px,1.35fr) minmax(340px,.65fr);gap:22px;align-items:start;}
      #productsControl .admin-panel{min-width:0;overflow:visible;}
      #productsControl .table-scroll{width:100%;overflow-x:auto;overflow-y:visible;border:1px solid #eadfce;border-radius:14px;background:#fff;}
      #productsControl table.spec-table{width:max-content;min-width:100%;border-collapse:collapse;table-layout:auto;font-size:13px;}
      #productsControl table.spec-table th,#productsControl table.spec-table td{border:1px solid #eadfce;padding:10px;vertical-align:top;background:#fff;min-width:150px;}
      #productsControl table.spec-table th:first-child,#productsControl table.spec-table td:first-child{position:sticky;left:0;z-index:2;background:#f8f2e8;min-width:155px;}
      #sizeFabricPriceHead th{background:#f4ecdf!important;text-align:center;font-weight:700;}
      #sizeFabricPriceBody td{min-width:210px;}
      #sizeFabricPriceBody input{width:100%;box-sizing:border-box;margin:4px 0 8px 0;}
      #manualSizeTable button,#manualFabricTable button,.cv28-mini-btn{border:1px solid #d7c8b4;background:#fff;border-radius:8px;padding:6px 9px;cursor:pointer;}
      #colorSetsPreview .admin-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;}
      #colorSetsPreview .admin-thumbs img{width:100%;height:95px;object-fit:cover;border-radius:10px;border:1px solid #e4d8c9;}
      #colorSetsPreview .admin-thumbs .thumb-box{position:relative;background:#fff;border:1px solid #eadfce;border-radius:12px;padding:7px;}
      #colorSetsPreview .admin-thumbs .remove-img{position:absolute;top:5px;right:5px;border:0;background:#9b1c1c;color:#fff;border-radius:50%;width:24px;height:24px;line-height:24px;cursor:pointer;}
      @media(max-width:1200px){#productsControl .admin-grid{display:block;} #productsControl .admin-panel{margin-bottom:18px;} }
    `;
    document.head.appendChild(st);
  }
  function cv28Sizes(){ const a=cv28Arr('manualSizes'); cv28Set('manualSizes',a); return a; }
  function cv28Fabrics(){
    let a=cv28Arr('manualFabrics');
    if(!a.length && Array.isArray(window.manualFabrics)) a=window.manualFabrics;
    a=a.map(f=>typeof f==='string'?{label:f,description:''}:f).filter(f=>String(f?.label||'').trim());
    cv28Set('manualFabrics',a); return a;
  }
  function cv28PriceMap(){ let p=cv28Obj('sizeFabricPrices'); cv28Set('sizeFabricPrices',p); return p; }
  function cv28CostMap(){ let c=cv28Obj('sizeFabricCosts'); cv28Set('sizeFabricCosts',c); return c; }

  window.renderManualSizeTable = function(){
    const body=cv28Q('manualSizeTable'); if(!body) return;
    const sizes=cv28Sizes();
    if(!sizes.length){ body.innerHTML='<tr><td colspan="5">No sizes added yet.</td></tr>'; return; }
    body.innerHTML=sizes.map((s,i)=>`<tr><td><strong>${cv28Esc(s.label)}</strong></td><td>${cv28Esc(s.width||'')}</td><td>${cv28Esc(s.depth||'')}</td><td>${cv28Esc(s.height||'')}</td><td><button type="button" data-cv28-remove-size="${i}">Remove</button></td></tr>`).join('');
  };
  window.removeManualSize = function(index){
    const i=Number(index); const sizes=cv28Sizes(); if(!sizes[i]) return;
    const label=sizes[i].label;
    sizes.splice(i,1); cv28Set('manualSizes',sizes);
    const p=cv28PriceMap(), c=cv28CostMap(); delete p[label]; delete c[label]; cv28Set('sizeFabricPrices',p); cv28Set('sizeFabricCosts',c);
    window.renderManualSizeTable(); window.buildSizeFabricPriceTable(); cv28Msg('Size removed. Click Save Product to publish.');
  };
  window.renderManualFabricTable = function(){
    const body=cv28Q('manualFabricTable'); if(!body) return;
    const fabrics=cv28Fabrics();
    if(!fabrics.length){ body.innerHTML='<tr><td colspan="3">No fabrics added yet.</td></tr>'; return; }
    body.innerHTML=fabrics.map((f,i)=>`<tr><td><strong>${cv28Esc(f.label)}</strong></td><td>${cv28Esc(f.description||'')}</td><td><button type="button" data-cv28-remove-fabric="${i}">Remove</button></td></tr>`).join('');
    if(typeof window.refreshFabricDropdowns==='function') window.refreshFabricDropdowns();
  };
  window.removeManualFabric = function(index){
    const i=Number(index); const fabrics=cv28Fabrics(); if(!fabrics[i]) return;
    const label=fabrics[i].label; fabrics.splice(i,1); cv28Set('manualFabrics',fabrics);
    const p=cv28PriceMap(), c=cv28CostMap(); Object.keys(p).forEach(size=>delete p[size][label]); Object.keys(c).forEach(size=>delete c[size][label]);
    cv28Set('sizeFabricPrices',p); cv28Set('sizeFabricCosts',c);
    window.renderManualFabricTable(); window.buildSizeFabricPriceTable(); cv28Msg('Fabric removed. Click Save Product to publish.');
  };
  window.buildSizeFabricPriceTable = function(){
    const head=cv28Q('sizeFabricPriceHead'), body=cv28Q('sizeFabricPriceBody'); if(!head||!body) return;
    const sizes=cv28Sizes(), fabrics=cv28Fabrics(), prices=cv28PriceMap(), costs=cv28CostMap();
    if(!sizes.length || !fabrics.length){ head.innerHTML=''; body.innerHTML='<tr><td>Add at least one size and one fabric to build the price and cost table.</td></tr>'; return; }
    head.innerHTML='<tr><th>Size / Fabric</th>'+fabrics.map(f=>`<th>${cv28Esc(f.label)}<br><small>${cv28Esc(f.description||'')}</small></th>`).join('')+'</tr>';
    body.innerHTML=sizes.map(s=>{
      prices[s.label]=prices[s.label]||{}; costs[s.label]=costs[s.label]||{};
      return `<tr><td><strong>${cv28Esc(s.label)}</strong><br><small>${cv28Esc([s.width||'-',s.depth||'-',s.height||'-'].join(' × '))} cm</small></td>`+
        fabrics.map(f=>`<td><label>Selling Price Before VAT</label><input type="number" class="sf-price" data-size="${cv28Esc(s.label)}" data-fabric="${cv28Esc(f.label)}" value="${cv28Esc(prices[s.label][f.label]||'')}" placeholder="Selling price"><label>Cost</label><input type="number" class="sf-cost" data-size="${cv28Esc(s.label)}" data-fabric="${cv28Esc(f.label)}" value="${cv28Esc(costs[s.label][f.label]||'')}" placeholder="Cost"></td>`).join('')+
        '</tr>';
    }).join('');
    cv28Set('sizeFabricPrices',prices); cv28Set('sizeFabricCosts',costs);
  };
  window.captureSizeFabricPrices = function(){
    const prices=cv28PriceMap(), costs=cv28CostMap();
    document.querySelectorAll('.sf-price').forEach(input=>{ const size=input.dataset.size, fabric=input.dataset.fabric; if(!prices[size]) prices[size]={}; prices[size][fabric]=Number(input.value||0); });
    document.querySelectorAll('.sf-cost').forEach(input=>{ const size=input.dataset.size, fabric=input.dataset.fabric; if(!costs[size]) costs[size]={}; costs[size][fabric]=Number(input.value||0); });
    cv28Set('sizeFabricPrices',prices); cv28Set('sizeFabricCosts',costs);
  };
  window.renderColorSets = function(){
    const wrap=cv28Q('colorSetsPreview'); if(!wrap) return;
    const colors=cv28Obj('colorSets'); cv28Set('colorSets',colors);
    wrap.innerHTML=Object.entries(colors).map(([name,set])=>{
      const images=Array.isArray(set.images)?set.images:[];
      const meta=Array.isArray(set.imageMeta)?set.imageMeta:images.map(url=>({url,fabric:set.fabric||''}));
      return `<div class="color-set-card"><div class="color-set-head"><span class="color-dot big" style="background:${cv28Esc(set.hex||'#ccc')}"></span><strong>${cv28Esc(name)}</strong><small>${cv28Esc(set.code||set.hex||'')}</small><button type="button" data-cv28-remove-color-set="${cv28Esc(name)}">Remove</button></div><div class="admin-thumbs">`+
        images.map((img,idx)=>`<div class="thumb-box"><img src="${cv28Esc(img)}"><small>${cv28Esc(meta[idx]?.fabric?('Fabric: '+meta[idx].fabric):'')}</small><button type="button" class="remove-img" data-cv28-remove-color-image="${cv28Esc(name)}" data-index="${idx}">×</button></div>`).join('')+
        '</div></div>';
    }).join('');
  };
  window.removeColorImage = function(name, idx){
    const colors=cv28Obj('colorSets'); if(!colors[name]) return;
    const i=Number(idx); if(Array.isArray(colors[name].images)) colors[name].images.splice(i,1); if(Array.isArray(colors[name].imageMeta)) colors[name].imageMeta.splice(i,1);
    cv28Set('colorSets',colors); window.renderColorSets(); cv28Msg('Product picture removed. Click Save Product to publish.');
  };
  window.removeColorSet = function(name){ const colors=cv28Obj('colorSets'); if(!colors[name]) return; delete colors[name]; cv28Set('colorSets',colors); window.renderColorSets(); cv28Msg('Color group removed. Click Save Product to publish.'); };

  function cv28CollectSizeOptions(){
    window.captureSizeFabricPrices(); const sizes=cv28Sizes(); const prices=cv28PriceMap(); const firstFabric=cv28Fabrics()[0]?.label || 'Standard Fabric';
    return sizes.length ? sizes.map(s=>({label:s.label,width:s.width||'',depth:s.depth||'',height:s.height||'',price:Number(prices?.[s.label]?.[firstFabric]||cv28Val('price')||0)})) : [{label:'Custom Size',width:'',depth:'',height:'',price:cv28Num('price',0)}];
  }
  function cv28CollectFabricOptions(sizeOptions){
    const fabrics=cv28Fabrics().length?cv28Fabrics():[{label:'Standard Fabric',description:''}], prices=cv28PriceMap(), costs=cv28CostMap();
    return fabrics.map(f=>{ const label=f.label||String(f); const sizePrices={}, sizeCosts={}; sizeOptions.forEach(s=>{ sizePrices[s.label]=Number(prices?.[s.label]?.[label]||s.price||cv28Val('price')||0); sizeCosts[s.label]=Number(costs?.[s.label]?.[label]||cv28Val('costPrice')||0); }); return {label,description:f.description||'',sizePrices,sizeCosts}; });
  }
  window.saveProduct = async function(){
    if(typeof window.hasAdminPermission==='function' && !window.hasAdminPermission('products','write')) return cv28Msg('You have read-only access for Products.', true);
    const name=cv28Val('name'); if(!name) return cv28Msg('Product name is required.', true);
    const productId=cv28Val('id') || (name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Date.now());
    const productsList=cv28Arr('products');
    const existing=productsList.find(p=>String(p.id)===String(productId));
    const colors=cv28Obj('colorSets');
    const category=cv28Val('category')||'Furniture';
    const sizeOptions=cv28CollectSizeOptions(); const fabricOptions=cv28CollectFabricOptions(sizeOptions);
    const firstSize=sizeOptions[0]?.label, firstFabric=fabricOptions[0]?.label, costMap=cv28CostMap();
    const product={id:productId,_dbId:existing?._dbId,name,name_ar:cv28Val('name_ar')||name,category,category_ar:cv28Val('category_ar')||category,price:cv28Num('price',sizeOptions[0]?.price||0),costPrice:Number(costMap?.[firstSize]?.[firstFabric]||cv28Val('costPrice')||0),vatRate:cv28Num('vatRate',15),discountPercent:cv28Num('discountPercent',0),description:cv28Val('description'),description_ar:cv28Val('description_ar')||cv28Val('description'),sizeOptions,sizes:sizeOptions.map(s=>s.label),fabricOptions,fabrics:fabricOptions.map(f=>f.label),colors,gallery:cv28Val('gallery')?cv28Val('gallery').split('\n').map(x=>x.trim()).filter(Boolean):[]};
    const payload={sku:product.id,name_en:product.name,name_ar:product.name_ar,category_name:product.category,category_ar:product.category_ar,description_en:product.description,description_ar:product.description_ar,base_price:product.price,vat_rate:product.vatRate,active:true,data:product};
    try{
      let result;
      if(existing && existing._dbId){ result=await cv28Api('/products/'+encodeURIComponent(existing._dbId), {method:'PUT', body:JSON.stringify(payload)}); product._dbId=existing._dbId; }
      else { result=await cv28Api('/products', {method:'POST', body:JSON.stringify(payload)}); if(result&&result.id) product._dbId=result.id; }
      const idx=productsList.findIndex(p=>String(p.id)===String(product.id)); if(idx>=0) productsList[idx]=product; else productsList.unshift(product);
      cv28Set('products',productsList); try{ localStorage.setItem('cms_products',JSON.stringify(productsList)); }catch(e){}
      if(typeof window.renderProductsAdmin==='function') window.renderProductsAdmin();
      cv28Msg('Product published permanently.');
    }catch(e){ console.error('v28 product publish failed',e); cv28Msg('Could not publish product: '+e.message,true); }
  };
  document.addEventListener('click', function(e){
    const a=e.target.closest('[data-cv28-remove-size],[data-cv28-remove-fabric],[data-cv28-remove-color-image],[data-cv28-remove-color-set]'); if(!a) return;
    e.preventDefault(); e.stopPropagation();
    if(a.dataset.cv28RemoveSize!==undefined) window.removeManualSize(a.dataset.cv28RemoveSize);
    if(a.dataset.cv28RemoveFabric!==undefined) window.removeManualFabric(a.dataset.cv28RemoveFabric);
    if(a.dataset.cv28RemoveColorImage!==undefined) window.removeColorImage(a.dataset.cv28RemoveColorImage, a.dataset.index);
    if(a.dataset.cv28RemoveColorSet!==undefined) window.removeColorSet(a.dataset.cv28RemoveColorSet);
  }, true);
  document.addEventListener('click', function(e){
    const el=e.target.closest('[onclick]'); if(!el) return; const raw=el.getAttribute('onclick')||''; const m=raw.trim().match(/^([A-Za-z_$][\w$]*)\((.*)\);?$/s); if(!m) return;
    if(!['removeManualSize','removeManualFabric','removeColorImage','removeColorSet','saveProduct'].includes(m[1])) return;
    e.preventDefault(); e.stopPropagation();
    const args=(m[2]||'').split(',').map(v=>{v=v.trim(); if(/^['"].*['"]$/.test(v)) return v.slice(1,-1).replace(/\\'/g,"'").replace(/\\"/g,'"'); if(/^-?\d+$/.test(v)) return Number(v); return v;});
    window[m[1]].apply(window,args);
  }, true);
  const cv28OldEdit=window.editProduct;
  if(typeof cv28OldEdit==='function' && !window.__cv28EditPatched){
    window.editProduct=function(pid){ const r=cv28OldEdit.apply(window,arguments); setTimeout(()=>{ cv28Css(); window.renderManualSizeTable(); window.renderManualFabricTable(); window.buildSizeFabricPriceTable(); if(typeof window.refreshFabricDropdowns==='function') window.refreshFabricDropdowns(); window.renderColorSets(); },120); return r; };
    window.__cv28EditPatched=true;
  }
  document.addEventListener('DOMContentLoaded', function(){ cv28Css(); setTimeout(()=>{ window.renderManualSizeTable(); window.renderManualFabricTable(); window.buildSizeFabricPriceTable(); if(typeof window.refreshFabricDropdowns==='function') window.refreshFabricDropdowns(); window.renderColorSets(); },350); });
  setTimeout(()=>{ cv28Css(); try{ window.renderManualSizeTable(); window.renderManualFabricTable(); window.buildSizeFabricPriceTable(); window.renderColorSets(); }catch(e){} },900);


/* CRAFTED-VISUAL-PRODUCT-SIZE-NAME-FIX-20260609-29
   Focus only: product manual size add/edit/remove and size table display.
   Keeps v28 fixes intact.
*/
(function(){
  'use strict';

  if(window.__cv29ProductSizePatch) return;
  window.__cv29ProductSizePatch = true;

  function q(id){ return document.getElementById(id); }
  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function arr(name){
    if(!Array.isArray(window[name])) window[name] = [];
    return window[name];
  }
  function obj(name){
    if(!window[name] || typeof window[name] !== 'object') window[name] = {};
    return window[name];
  }
  function set(name, value){ window[name] = value; }
  function msg(text, err){
    if(typeof window.showAdminStatus === 'function') window.showAdminStatus(text, !!err);
    else if(typeof window.status === 'function') window.status(text, !!err);
    else console[err ? 'error' : 'log'](text);
  }

  function installSizeCss(){
    if(document.getElementById('cv29ProductSizeCss')) return;
    const st = document.createElement('style');
    st.id = 'cv29ProductSizeCss';
    st.textContent = `
      #productsControl .admin-panel:first-child{
        width:100%;
        max-width:none;
        overflow:visible;
      }
      #productsControl .admin-grid{
        grid-template-columns:minmax(560px, 1.35fr) minmax(360px, .9fr);
        align-items:start;
      }
      #productsControl .table-scroll{
        width:100%;
        overflow-x:auto;
        -webkit-overflow-scrolling:touch;
      }
      #manualSizeTable td,
      #manualFabricTable td{
        vertical-align:middle;
      }
      #manualSizeTable input.cv29-size-edit{
        width:100%;
        min-width:110px;
        box-sizing:border-box;
        border:1px solid #d8caba;
        border-radius:8px;
        padding:8px 10px;
        background:#fff;
      }
      #manualSizeTable .cv29-actions{
        display:flex;
        gap:6px;
        flex-wrap:wrap;
      }
      #manualSizeTable button{
        white-space:nowrap;
      }
      #sizeFabricPriceHead,
      #sizeFabricPriceBody{
        min-width:900px;
      }
      #sizeFabricPriceHead th:first-child,
      #sizeFabricPriceBody td:first-child{
        min-width:210px;
      }
      #sizeFabricPriceBody td{
        min-width:230px;
      }
      @media(max-width:1100px){
        #productsControl .admin-grid{display:block;}
      }
    `;
    document.head.appendChild(st);
  }

  function normalizeSizeRow(s){
    if(typeof s === 'string'){
      return { label:s, width:'', depth:'', height:'' };
    }
    return {
      label:String(s?.label || s?.name || s?.size || '').trim(),
      width:String(s?.width || s?.length || '').trim(),
      depth:String(s?.depth || '').trim(),
      height:String(s?.height || '').trim()
    };
  }

  function getSizes(){
    const clean = arr('manualSizes').map(normalizeSizeRow).filter(s => s.label);
    set('manualSizes', clean);
    return clean;
  }

  function getPriceMap(){ return obj('sizeFabricPrices'); }
  function getCostMap(){ return obj('sizeFabricCosts'); }

  function safeBuildPriceTable(){
    try{ if(typeof window.buildSizeFabricPriceTable === 'function') window.buildSizeFabricPriceTable(); }catch(e){ console.warn(e); }
  }

  window.addManualSize = function(){
    if(typeof window.hasAdminPermission === 'function' && !window.hasAdminPermission('products','write')){
      return msg('You do not have write access for products.', true);
    }

    const label = String(q('sizeNameInput')?.value || '').trim();
    const width = String(q('sizeWidthInput')?.value || '').trim();
    const depth = String(q('sizeDepthInput')?.value || '').trim();
    const height = String(q('sizeHeightInput')?.value || '').trim();

    if(!label) return msg('Size name is required.', true);

    const sizes = getSizes();
    const duplicate = sizes.find(s => s.label.toLowerCase() === label.toLowerCase());
    if(duplicate) return msg('This size name already exists. Edit the existing row or use another name.', true);

    sizes.push({label, width, depth, height});
    set('manualSizes', sizes);

    ['sizeNameInput','sizeWidthInput','sizeDepthInput','sizeHeightInput'].forEach(id => {
      const el = q(id);
      if(el) el.value = '';
    });

    window.renderManualSizeTable();
    safeBuildPriceTable();
    msg('Size added: ' + label);
  };

  window.renderManualSizeTable = function(){
    const body = q('manualSizeTable');
    if(!body) return;

    const sizes = getSizes();

    if(!sizes.length){
      body.innerHTML = '<tr><td colspan="5">No sizes added yet.</td></tr>';
      return;
    }

    body.innerHTML = sizes.map((s,i)=>`
      <tr data-size-row="${i}">
        <td>
          <input class="cv29-size-edit" data-cv29-size-field="label" data-index="${i}" value="${esc(s.label)}" placeholder="Size name">
        </td>
        <td>
          <input class="cv29-size-edit" data-cv29-size-field="width" data-index="${i}" value="${esc(s.width)}" placeholder="Width / Length cm">
        </td>
        <td>
          <input class="cv29-size-edit" data-cv29-size-field="depth" data-index="${i}" value="${esc(s.depth)}" placeholder="Depth cm">
        </td>
        <td>
          <input class="cv29-size-edit" data-cv29-size-field="height" data-index="${i}" value="${esc(s.height)}" placeholder="Height cm">
        </td>
        <td>
          <div class="cv29-actions">
            <button type="button" data-cv29-save-size="${i}">Update</button>
            <button type="button" data-cv29-remove-size="${i}">Remove</button>
          </div>
        </td>
      </tr>
    `).join('');
  };

  window.updateManualSize = function(index){
    const i = Number(index);
    const sizes = getSizes();
    if(!sizes[i]) return;

    const row = document.querySelector(`tr[data-size-row="${i}"]`);
    if(!row) return;

    const oldLabel = sizes[i].label;
    const next = {
      label: row.querySelector('[data-cv29-size-field="label"]')?.value.trim() || '',
      width: row.querySelector('[data-cv29-size-field="width"]')?.value.trim() || '',
      depth: row.querySelector('[data-cv29-size-field="depth"]')?.value.trim() || '',
      height: row.querySelector('[data-cv29-size-field="height"]')?.value.trim() || ''
    };

    if(!next.label) return msg('Size name is required.', true);

    const duplicate = sizes.find((s,idx) => idx !== i && s.label.toLowerCase() === next.label.toLowerCase());
    if(duplicate) return msg('Another size already uses this name.', true);

    sizes[i] = next;
    set('manualSizes', sizes);

    if(oldLabel !== next.label){
      const prices = getPriceMap();
      const costs = getCostMap();
      if(prices[oldLabel] && !prices[next.label]) prices[next.label] = prices[oldLabel];
      if(costs[oldLabel] && !costs[next.label]) costs[next.label] = costs[oldLabel];
      delete prices[oldLabel];
      delete costs[oldLabel];
    }

    window.renderManualSizeTable();
    safeBuildPriceTable();
    msg('Size updated. Click Save Product to publish.');
  };

  window.removeManualSize = function(index){
    const i = Number(index);
    const sizes = getSizes();
    if(!sizes[i]) return;

    const label = sizes[i].label;
    sizes.splice(i,1);
    set('manualSizes', sizes);

    const prices = getPriceMap();
    const costs = getCostMap();
    delete prices[label];
    delete costs[label];

    window.renderManualSizeTable();
    safeBuildPriceTable();
    msg('Size removed. Click Save Product to publish.');
  };

  document.addEventListener('click', function(e){
    const saveBtn = e.target.closest('[data-cv29-save-size]');
    const removeBtn = e.target.closest('[data-cv29-remove-size]');
    if(saveBtn){
      e.preventDefault();
      e.stopPropagation();
      window.updateManualSize(saveBtn.getAttribute('data-cv29-save-size'));
    }
    if(removeBtn){
      e.preventDefault();
      e.stopPropagation();
      window.removeManualSize(removeBtn.getAttribute('data-cv29-remove-size'));
    }
  }, true);

  document.addEventListener('input', function(e){
    if(e.target && e.target.matches('.cv29-size-edit')){
      const i = Number(e.target.dataset.index);
      const field = e.target.dataset.cv29SizeField;
      const sizes = getSizes();
      if(sizes[i] && field){
        sizes[i][field] = e.target.value;
        set('manualSizes', sizes);
      }
    }
  }, true);

  const previousEditProduct = window.editProduct;
  if(typeof previousEditProduct === 'function'){
    window.editProduct = function(){
      const result = previousEditProduct.apply(window, arguments);
      setTimeout(function(){
        installSizeCss();
        window.renderManualSizeTable();
        safeBuildPriceTable();
      }, 180);
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    installSizeCss();
    setTimeout(function(){
      window.renderManualSizeTable();
      safeBuildPriceTable();
    }, 400);
  });

  setTimeout(function(){
    installSizeCss();
    window.renderManualSizeTable();
    safeBuildPriceTable();
  }, 900);
})();

})();


/* CRAFTED-VISUAL-PRODUCT-COLOR-PUBLISH-SHOP-SYNC-FIX-20260609-30
   Focus only:
   - Add Color Photos button
   - Remove product photos/color groups
   - Publish edited/new products to backend
   - Delete products reflected in Shop
   - Keep previous v29 fixes intact
*/
(function(){
  'use strict';
  if(window.__cv30ProductColorPublishPatch) return;
  window.__cv30ProductColorPublishPatch = true;

  function $(id){ return document.getElementById(id); }
  function val(id){ return String(($(id) && $(id).value) || '').trim(); }
  function num(id, d=0){ const n=Number(val(id)); return Number.isFinite(n) ? n : d; }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function show(msg, err){
    if(typeof window.showAdminStatus==='function') window.showAdminStatus(msg, !!err);
    else if(typeof window.status==='function') window.status(msg, !!err);
    else console[err?'error':'log'](msg);
  }
  function token(){ return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || ''; }
  async function api(path, options={}){
    const headers = Object.assign({}, options.headers || {});
    if(!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    headers.Authorization = 'Bearer ' + token();
    const res = await fetch('/api' + path, Object.assign({}, options, {headers}));
    const text = await res.text();
    let data = {};
    try{ data = text ? JSON.parse(text) : {}; }catch(e){ data = {raw:text}; }
    if(!res.ok) throw new Error(data.error || data.raw || ('API error ' + res.status));
    return data;
  }
  function arr(name){ if(!Array.isArray(window[name])) window[name]=[]; return window[name]; }
  function obj(name){ if(!window[name] || typeof window[name]!=='object' || Array.isArray(window[name])) window[name]={}; return window[name]; }
  function set(name, value){ window[name]=value; try{ if(name==='products') localStorage.setItem('cms_products', JSON.stringify(value)); }catch(e){} }

  function normalizeApiProduct(p){
    const data = p && p.data && typeof p.data === 'object' ? p.data : {};
    const out = Object.assign({}, data, {
      _dbId: p.id,
      id: data.id || p.sku || String(p.id),
      name: data.name || p.name_en || '',
      name_ar: data.name_ar || p.name_ar || '',
      category: data.category || p.category_name || '',
      description: data.description || p.description_en || '',
      description_ar: data.description_ar || p.description_ar || '',
      price: Number(data.price || p.base_price || 0),
      vatRate: Number(data.vatRate || p.vat_rate || 15),
      active: p.active !== 0
    });
    return out;
  }
  async function refreshProductsFromBackend(){
    try{
      const rows = await fetch('/api/products', {cache:'no-store'}).then(r=>r.ok?r.json():[]);
      const list = Array.isArray(rows) ? rows.map(normalizeApiProduct) : [];
      if(list.length){ set('products', list); }
      if(typeof window.renderProductsAdmin==='function') window.renderProductsAdmin();
      return list;
    }catch(e){ console.warn('Could not refresh products from backend', e); return arr('products'); }
  }
  async function resolveDbId(product){
    if(product && product._dbId) return product._dbId;
    const list = await refreshProductsFromBackend();
    const id = String(product?.id || val('id') || '');
    const found = list.find(p=>String(p.id)===id || String(p.sku||'')===id);
    return found?._dbId || null;
  }

  function getManualSizes(){
    const source = arr('manualSizes');
    return source.map(s=> typeof s==='string' ? {label:s,width:'',depth:'',height:''} : {
      label:String(s.label || s.name || s.size || '').trim(),
      width:String(s.width || '').trim(),
      depth:String(s.depth || '').trim(),
      height:String(s.height || '').trim()
    }).filter(s=>s.label);
  }
  function getManualFabrics(){
    const a = arr('manualFabrics');
    const table = Array.from(document.querySelectorAll('#manualFabricTable tr')).map(tr=>{
      const cells = tr.querySelectorAll('td');
      return cells.length ? {label:(cells[0].querySelector('input')?.value || cells[0].textContent || '').trim(), description:(cells[1]?.querySelector('textarea,input')?.value || cells[1]?.textContent || '').trim()} : null;
    }).filter(x=>x && x.label && !/No fabrics/i.test(x.label));
    const merged = [...a.map(f=> typeof f==='string'?{label:f,description:''}:{label:String(f.label||f.name||'').trim(),description:String(f.description||'').trim()}), ...table]
      .filter(f=>f.label);
    const seen = new Set();
    const clean = [];
    merged.forEach(f=>{ const k=f.label.toLowerCase(); if(!seen.has(k)){ seen.add(k); clean.push(f); } });
    window.manualFabrics = clean;
    return clean;
  }
  window.refreshFabricDropdowns = function(){
    const fabrics = getManualFabrics();
    const select = $('colorPhotoFabric');
    if(!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Select fabric for these photos</option>' + fabrics.map(f=>`<option value="${esc(f.label)}">${esc(f.label)}</option>`).join('');
    if(current && fabrics.some(f=>f.label===current)) select.value=current;
  };

  const oldAddFabric = window.addManualFabric;
  if(typeof oldAddFabric === 'function' && !window.__cv30AddFabricPatched){
    window.addManualFabric = function(){
      const r = oldAddFabric.apply(window, arguments);
      setTimeout(()=>{ try{ window.refreshFabricDropdowns(); }catch(e){} }, 80);
      return r;
    };
    window.__cv30AddFabricPatched = true;
  }

  const uploadLocks = new Set();
  async function uploadFile(file){
    if(!file) return '';
    const key = [file.name, file.size, file.lastModified].join('|');
    if(uploadLocks.has(key)) return '';
    uploadLocks.add(key);
    try{
      const fd = new FormData();
      fd.append('file', file);
      const data = await api('/upload', {method:'POST', body:fd});
      return data.url || data.path || '';
    }finally{
      uploadLocks.delete(key);
    }
  }
  async function uploadFiles(files){
    const out=[];
    for(const file of Array.from(files || [])){
      const url = await uploadFile(file);
      if(url && !out.includes(url)) out.push(url);
    }
    return out;
  }

  function getColors(){
    const colors = obj('colorSets');
    Object.keys(colors).forEach(k=>{
      const set = colors[k] || {};
      if(!Array.isArray(set.images)) set.images = [];
      if(!Array.isArray(set.imageMeta)) set.imageMeta = set.images.map(url=>({url, fabric:set.fabric||''}));
      colors[k]=set;
    });
    return colors;
  }
  window.renderColorSets = function(){
    const box = $('colorSetsPreview');
    if(!box) return;
    const colors = getColors();
    const names = Object.keys(colors);
    if(!names.length){ box.innerHTML = '<small>No color photos added yet.</small>'; return; }
    box.innerHTML = names.map(name=>{
      const set = colors[name] || {};
      const imgs = Array.isArray(set.images) ? set.images : [];
      const meta = Array.isArray(set.imageMeta) ? set.imageMeta : imgs.map(url=>({url,fabric:set.fabric||''}));
      return `<div class="color-set-card">
        <div class="color-set-head">
          <span class="color-dot big" style="background:${esc(set.hex || '#ccc')}"></span>
          <strong>${esc(name)}</strong>
          <small>${esc(set.code || set.hex || '')}</small>
          <button type="button" data-cv30-remove-color-set="${esc(name)}">Remove Group</button>
        </div>
        <div class="admin-thumbs">
          ${imgs.map((img,idx)=>`<div class="thumb-box"><img src="${esc(img)}"><small>${esc(meta[idx]?.fabric ? 'Fabric: '+meta[idx].fabric : '')}</small><button type="button" class="remove-img" data-cv30-remove-color-image="${esc(name)}" data-index="${idx}">×</button></div>`).join('')}
        </div>
      </div>`;
    }).join('');
  };

  let addColorBusy = false;
  window.addColorSet = async function(){
    if(addColorBusy) return;
    addColorBusy = true;
    try{
      const colorName = val('colorName');
      const code = val('colorCode');
      const fabric = val('colorPhotoFabric');
      const hex = val('colorHex') || '#183d32';
      const files = $('colorFiles')?.files || [];
      if(!colorName) return show('Color name is required.', true);
      if(!fabric) return show('Select the fabric for these photos.', true);
      if(!files.length) return show('Choose one or more product photos.', true);
      const urls = await uploadFiles(files);
      if(!urls.length) return show('No new photos were uploaded.', true);
      const colors = getColors();
      const existing = colors[colorName] || {images:[], imageMeta:[]};
      const existingImgs = Array.isArray(existing.images) ? existing.images : [];
      const existingMeta = Array.isArray(existing.imageMeta) ? existing.imageMeta : existingImgs.map(url=>({url,fabric:existing.fabric||''}));
      const uniqueUrls = urls.filter(u=>!existingImgs.includes(u));
      colors[colorName] = {
        hex: hex,
        code: code,
        fabric: fabric,
        images: existingImgs.concat(uniqueUrls),
        imageMeta: existingMeta.concat(uniqueUrls.map(url=>({url,fabric})))
      };
      window.colorSets = colors;
      if($('colorFiles')) $('colorFiles').value='';
      if($('colorName')) $('colorName').value='';
      if($('colorCode')) $('colorCode').value='';
      window.renderColorSets();
      show('Color photos added. Click Save Product to publish to Shop.');
    }catch(e){ console.error('Add color photos failed', e); show('Could not add color photos: '+e.message, true); }
    finally{ addColorBusy=false; }
  };
  window.removeColorImage = function(name, idx){
    const colors = getColors();
    if(!colors[name]) return;
    const i = Number(idx);
    colors[name].images.splice(i,1);
    colors[name].imageMeta.splice(i,1);
    window.colorSets = colors;
    window.renderColorSets();
    show('Product photo removed. Click Save Product to publish.');
  };
  window.removeColorSet = function(name){
    const colors = getColors();
    if(!colors[name]) return;
    delete colors[name];
    window.colorSets = colors;
    window.renderColorSets();
    show('Color photo group removed. Click Save Product to publish.');
  };

  function capturePrices(){ try{ if(typeof window.captureSizeFabricPrices==='function') window.captureSizeFabricPrices(); }catch(e){} }
  function collectSizeOptions(){
    capturePrices();
    const sizes = getManualSizes();
    const priceMap = obj('sizeFabricPrices');
    const firstFabric = getManualFabrics()[0]?.label || 'Standard Fabric';
    return sizes.length ? sizes.map(s=>({
      label:s.label,width:s.width,depth:s.depth,height:s.height,
      price:Number(priceMap?.[s.label]?.[firstFabric] || val('price') || 0)
    })) : [{label:'Custom Size',width:'',depth:'',height:'',price:num('price',0)}];
  }
  function collectFabricOptions(sizeOptions){
    const fabrics = getManualFabrics();
    const use = fabrics.length ? fabrics : [{label:'Standard Fabric',description:''}];
    const priceMap = obj('sizeFabricPrices');
    const costMap = obj('sizeFabricCosts');
    return use.map(f=>{
      const label=f.label || String(f);
      const sizePrices={}, sizeCosts={};
      sizeOptions.forEach(s=>{
        sizePrices[s.label]=Number(priceMap?.[s.label]?.[label] || s.price || val('price') || 0);
        sizeCosts[s.label]=Number(costMap?.[s.label]?.[label] || val('costPrice') || 0);
      });
      return {label, description:f.description||'', sizePrices, sizeCosts};
    });
  }
  function collectProduct(){
    const name = val('name');
    if(!name) throw new Error('Product name is required.');
    const id = val('id') || (name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + Date.now());
    const products = arr('products');
    const existing = products.find(p=>String(p.id)===String(id));
    const sizeOptions = collectSizeOptions();
    const fabricOptions = collectFabricOptions(sizeOptions);
    const firstSize = sizeOptions[0]?.label || 'Custom Size';
    const firstFabric = fabricOptions[0]?.label || 'Standard Fabric';
    const costs = obj('sizeFabricCosts');
    const category = val('category') || 'Furniture';
    return Object.assign({}, existing || {}, {
      id, _dbId: existing?._dbId,
      name, name_ar: val('name_ar') || name,
      category, category_ar: val('category_ar') || category,
      price: num('price', sizeOptions[0]?.price || 0),
      costPrice: Number(costs?.[firstSize]?.[firstFabric] || val('costPrice') || 0),
      vatRate: num('vatRate',15), discountPercent:num('discountPercent',0),
      description: val('description'), description_ar: val('description_ar') || val('description'),
      sizeOptions, sizes: sizeOptions.map(s=>s.label),
      fabricOptions, fabrics: fabricOptions.map(f=>f.label),
      colors:getColors(),
      gallery: val('gallery') ? val('gallery').split('\n').map(x=>x.trim()).filter(Boolean) : [],
      active:true
    });
  }
  function payloadFromProduct(product){
    return {sku:product.id,name_en:product.name,name_ar:product.name_ar,category_name:product.category,category_ar:product.category_ar,description_en:product.description,description_ar:product.description_ar,base_price:product.price,vat_rate:product.vatRate,active:product.active !== false,data:product};
  }
  window.saveProduct = async function(){
    try{
      const product = collectProduct();
      if(!Object.keys(product.colors || {}).length) throw new Error('Add at least one color photo before saving.');
      const list = arr('products');
      let dbId = await resolveDbId(product);
      let result;
      if(dbId){
        result = await api('/products/' + encodeURIComponent(dbId), {method:'PUT', body:JSON.stringify(payloadFromProduct(product))});
        product._dbId = dbId;
      }else{
        result = await api('/products', {method:'POST', body:JSON.stringify(payloadFromProduct(product))});
        if(result.id) product._dbId = result.id;
      }
      const idx = list.findIndex(p=>String(p.id)===String(product.id));
      if(idx>=0) list[idx]=product; else list.unshift(product);
      set('products', list);
      await refreshProductsFromBackend();
      show('Product published to Shop.');
    }catch(e){ console.error('Save product failed', e); show('Could not publish product: '+e.message, true); }
  };
  window.deleteProduct = async function(id){
    if(!confirm('Delete this product from the shop?')) return;
    try{
      let list = arr('products');
      let product = list.find(p=>String(p.id)===String(id));
      let dbId = await resolveDbId(product || {id});
      if(dbId){
        const payload = product ? payloadFromProduct(Object.assign({}, product, {active:false})) : {active:false,data:{id,active:false}};
        await api('/products/' + encodeURIComponent(dbId), {method:'PUT', body:JSON.stringify(payload)});
      }
      list = list.filter(p=>String(p.id)!==String(id));
      set('products', list);
      if(typeof window.renderProductsAdmin==='function') window.renderProductsAdmin();
      await refreshProductsFromBackend();
      show('Product deleted from Shop.');
    }catch(e){ console.error('Delete product failed', e); show('Could not delete product: '+e.message, true); }
  };

  document.addEventListener('click', function(e){
    const addColorBtn = e.target.closest('button[onclick*="addColorSet"], button[data-cv30-add-color]');
    const saveBtn = e.target.closest('button[onclick*="saveProduct"], button[data-cv30-save-product]');
    const remImg = e.target.closest('[data-cv30-remove-color-image],[data-cv28-remove-color-image]');
    const remSet = e.target.closest('[data-cv30-remove-color-set],[data-cv28-remove-color-set]');
    if(addColorBtn){ e.preventDefault(); e.stopPropagation(); window.addColorSet(); }
    if(saveBtn){ e.preventDefault(); e.stopPropagation(); window.saveProduct(); }
    if(remImg){ e.preventDefault(); e.stopPropagation(); window.removeColorImage(remImg.dataset.cv30RemoveColorImage || remImg.dataset.cv28RemoveColorImage, remImg.dataset.index); }
    if(remSet){ e.preventDefault(); e.stopPropagation(); window.removeColorSet(remSet.dataset.cv30RemoveColorSet || remSet.dataset.cv28RemoveColorSet); }
  }, true);

  function installCss(){
    if(document.getElementById('cv30ProductCss')) return;
    const st=document.createElement('style'); st.id='cv30ProductCss'; st.textContent=`
      #colorSetsPreview .admin-thumbs{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;}
      #colorSetsPreview .thumb-box{position:relative;width:112px;border:1px solid #e6d8c8;border-radius:10px;padding:6px;background:#fff;}
      #colorSetsPreview .thumb-box img{width:100%;height:80px;object-fit:cover;border-radius:8px;display:block;}
      #colorSetsPreview .remove-img{position:absolute;top:3px;right:3px;border:0;background:#7b1e1e;color:#fff;border-radius:999px;width:24px;height:24px;cursor:pointer;}
    `; document.head.appendChild(st);
  }
  document.addEventListener('DOMContentLoaded', function(){ installCss(); window.refreshFabricDropdowns(); setTimeout(()=>{ window.renderColorSets(); refreshProductsFromBackend(); }, 400); });
  setTimeout(function(){ installCss(); try{ window.refreshFabricDropdowns(); window.renderColorSets(); }catch(e){} }, 900);

/* CRAFTED-VISUAL-CATEGORY-PERSISTENCE-REFRESH-FIX-20260609-32
   Focus only: Product Category add/show-hide/delete/save publishing.
   Keeps all previous v30 product/media fixes intact.
*/
(function(){
  'use strict';
  if(window.__cv31CategoryPatch) return;
  window.__cv31CategoryPatch = true;

  function q(id){ return document.getElementById(id); }
  function text(id){ return (q(id)?.value || '').trim(); }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function msg(m, err){ if(typeof window.showAdminStatus === 'function') window.showAdminStatus(m, !!err); else alert(m); }
  function canWriteCategories(){ return !window.hasAdminPermission || window.hasAdminPermission('categories','write'); }
  function autoArabic(v){ try{ return (typeof window.isAutoArabicEnabled === 'function' && window.isAutoArabicEnabled() && typeof window.autoTranslateToArabic === 'function') ? window.autoTranslateToArabic(v) : v; }catch(e){ return v; } }

  function getCategories(){
    if(!Array.isArray(window.categories)) window.categories = [];
    window.categories = window.categories.map(c => ({
      label_en: String(c.label_en || c.name_en || c.name || c.label || '').trim(),
      label_ar: String(c.label_ar || c.name_ar || '').trim(),
      visible: c.visible !== false,
      id: c.id || c._dbId || c.category_id || undefined
    })).filter(c => c.label_en);
    return window.categories;
  }

  function setCategories(list){
    window.categories = Array.isArray(list) ? list : [];
    try{ localStorage.setItem('cms_categories', JSON.stringify(window.categories)); }catch(e){}
    try{ sessionStorage.setItem('cms_categories', JSON.stringify(window.categories)); }catch(e){}
  }

  async function publishCategories(){
    const list = getCategories();
    setCategories(list);
    if(typeof publishSettings === 'function'){
      await publishSettings({categories:list});
    }else{
      const token = localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || '';
      if(!token) throw new Error('Missing admin token. Login again.');
      const current = await fetch('/api/settings', {cache:'no-store'}).then(r => r.ok ? r.json() : {});
      const res = await fetch('/api/settings', {
        method:'PUT',
        headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
        body:JSON.stringify(Object.assign({}, current || {}, {categories:list}))
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || 'Could not publish categories.');
    }
    return list;
  }

  function refreshCategoryUI(){
    if(typeof window.renderCategories === 'function') window.renderCategories();
    if(typeof window.renderCategorySelect === 'function') window.renderCategorySelect();
    if(typeof window.renderDiscountTargets === 'function') window.renderDiscountTargets();
    if(typeof window.syncCategoryArabic === 'function') window.syncCategoryArabic();
  }

  window.renderCategories = function(){
    const list = q('categoryList');
    if(!list) return;
    const cats = getCategories();
    if(!cats.length){
      list.innerHTML = '<div class="admin-item"><div>No categories added yet.</div></div>';
      return;
    }
    list.innerHTML = cats.map((c,i)=>`
      <div class="admin-item" data-category-index="${i}">
        <div><strong>${esc(c.label_en)}</strong> / ${esc(c.label_ar || '')}<br>Visible: ${c.visible !== false}</div>
        <div>
          <button type="button" data-cv31-toggle-category="${i}">Show/Hide</button>
          <button type="button" data-cv31-remove-category="${i}">Delete</button>
        </div>
      </div>`).join('');
  };

  window.addCategory = async function(){
    if(!canWriteCategories()) return msg('You have read-only access for Product Category.', true);
    const en = text('cat_en');
    const arInput = text('cat_ar');
    if(!en) return msg('Add English category first.', true);
    try{ if(typeof window.isBlockedCategory === 'function' && window.isBlockedCategory(en)) return msg('This category is currently blocked.', true); }catch(e){}

    const cats = getCategories();
    if(cats.some(c => c.label_en.toLowerCase() === en.toLowerCase())) return msg('This category already exists.', true);
    cats.push({label_en:en, label_ar: arInput || autoArabic(en), visible:true});
    setCategories(cats);
    if(q('cat_en')) q('cat_en').value = '';
    if(q('cat_ar')) q('cat_ar').value = '';
    refreshCategoryUI();
    try{
      await publishCategories();
      msg('Category added and published permanently.');
    }catch(e){
      console.error('Category publish failed', e);
      msg('Category added locally, but publish failed: '+e.message, true);
    }
  };

  window.toggleCategory = async function(index){
    if(!canWriteCategories()) return msg('You have read-only access for Product Category.', true);
    const cats = getCategories();
    const i = Number(index);
    if(!cats[i]) return;
    cats[i].visible = cats[i].visible === false ? true : false;
    setCategories(cats);
    refreshCategoryUI();
    try{ await publishCategories(); msg('Category visibility updated and published.'); }
    catch(e){ msg('Category visibility changed locally, but publish failed: '+e.message, true); }
  };

  window.removeCategory = async function(index){
    if(!canWriteCategories()) return msg('You have read-only access for Product Category.', true);
    const cats = getCategories();
    const i = Number(index);
    if(!cats[i]) return;
    if(!confirm('Delete this category?')) return;
    cats.splice(i,1);
    setCategories(cats);
    refreshCategoryUI();
    try{ await publishCategories(); msg('Category deleted and published.'); }
    catch(e){ msg('Category deleted locally, but publish failed: '+e.message, true); }
  };

  window.saveCategories = async function(){
    if(!canWriteCategories()) return msg('You have read-only access for Product Category.', true);
    try{
      await publishCategories();
      refreshCategoryUI();
      msg('Categories published permanently.');
    }catch(e){
      console.error('Save categories failed', e);
      msg('Categories could not publish: '+e.message, true);
    }
  };

  document.addEventListener('click', function(e){
    const addBtn = e.target.closest('button[onclick="addCategory()"]');
    const saveBtn = e.target.closest('button[onclick="saveCategories()"]');
    const toggleBtn = e.target.closest('[data-cv31-toggle-category]');
    const removeBtn = e.target.closest('[data-cv31-remove-category]');
    if(addBtn){ e.preventDefault(); e.stopPropagation(); window.addCategory(); }
    if(saveBtn){ e.preventDefault(); e.stopPropagation(); window.saveCategories(); }
    if(toggleBtn){ e.preventDefault(); e.stopPropagation(); window.toggleCategory(toggleBtn.getAttribute('data-cv31-toggle-category')); }
    if(removeBtn){ e.preventDefault(); e.stopPropagation(); window.removeCategory(removeBtn.getAttribute('data-cv31-remove-category')); }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){ refreshCategoryUI(); }, 300);
  });
  setTimeout(function(){ refreshCategoryUI(); }, 900);
})();


/* CRAFTED-VISUAL-CATEGORY-PERSISTENCE-REFRESH-FIX-20260609-32
   Focus only: Product Category persistence after backend refresh.
   Keeps v31 category add/publish and all previous product/media fixes intact.
*/
(function(){
  'use strict';
  if(window.__cv32CategoryPersistencePatch) return;
  window.__cv32CategoryPersistencePatch = true;

  const DEFAULT_CV_CATEGORIES = [
    {label_en:'L Shape Sofas', label_ar:'كنب حرف L', visible:true},
    {label_en:'Beds', label_ar:'أسرة', visible:true},
    {label_en:'Single Chairs', label_ar:'كراسي مفردة', visible:true}
  ];

  function q(id){ return document.getElementById(id); }
  function msg(m, err){ if(typeof window.showAdminStatus === 'function') window.showAdminStatus(m, !!err); else console[err?'error':'log'](m); }
  function token(){ return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || ''; }
  function cleanName(v){ return String(v || '').trim(); }
  function normalizeCategory(c){
    const label = cleanName(c?.label_en || c?.name_en || c?.name || c?.label || c?.category || '');
    if(!label) return null;
    return {
      label_en: label,
      label_ar: cleanName(c?.label_ar || c?.name_ar || c?.arabic || ''),
      visible: c?.visible !== false && c?.active !== 0 && c?.active !== false,
      id: c?.id || c?._dbId || c?.category_id || undefined
    };
  }
  function mergeCategories(){
    const out = [];
    const seen = new Set();
    for(const source of arguments){
      (Array.isArray(source) ? source : []).forEach(raw => {
        const c = normalizeCategory(raw);
        if(!c) return;
        const key = c.label_en.toLowerCase();
        if(seen.has(key)){
          const existing = out.find(x => x.label_en.toLowerCase() === key);
          if(existing){
            if(!existing.label_ar && c.label_ar) existing.label_ar = c.label_ar;
            existing.visible = existing.visible !== false || c.visible !== false;
            if(!existing.id && c.id) existing.id = c.id;
          }
          return;
        }
        seen.add(key);
        out.push(c);
      });
    }
    return out;
  }
  function storeCategories(list){
    window.categories = mergeCategories(list);
    try{ localStorage.setItem('cms_categories', JSON.stringify(window.categories)); }catch(e){}
    try{ sessionStorage.setItem('cms_categories', JSON.stringify(window.categories)); }catch(e){}
  }
  function refreshCategoryScreens(){
    if(typeof window.renderCategories === 'function') window.renderCategories();
    if(typeof window.renderCategorySelect === 'function') window.renderCategorySelect();
    if(typeof window.renderDiscountTargets === 'function') window.renderDiscountTargets();
    if(typeof window.syncCategoryArabic === 'function') window.syncCategoryArabic();
  }
  async function fetchJson(url, options){
    const res = await fetch(url, Object.assign({cache:'no-store'}, options || {}));
    const data = await res.json().catch(()=>null);
    if(!res.ok) throw new Error((data && data.error) || ('Request failed: '+res.status));
    return data;
  }

  window.cvLoadCategoriesFromBackend = async function(){
    let settingsCats = [];
    let dbCats = [];
    let localCats = [];
    try{ localCats = JSON.parse(localStorage.getItem('cms_categories') || sessionStorage.getItem('cms_categories') || '[]') || []; }catch(e){}
    try{
      const settings = await fetchJson('/api/settings');
      settingsCats = settings?.categories || [];
    }catch(e){ console.warn('Could not read settings categories', e); }
    try{
      dbCats = await fetchJson('/api/categories');
    }catch(e){ console.warn('Could not read DB categories', e); }

    const merged = mergeCategories(settingsCats, dbCats, localCats, DEFAULT_CV_CATEGORIES);
    storeCategories(merged);
    refreshCategoryScreens();
    return merged;
  };

  async function ensureCategoryInDatabase(c){
    const t = token();
    if(!t || !c || !c.label_en || c.visible === false) return;
    let dbCats = [];
    try{ dbCats = await fetchJson('/api/categories'); }catch(e){ dbCats = []; }
    if(dbCats.some(x => cleanName(x.name_en || x.label_en).toLowerCase() === c.label_en.toLowerCase())) return;
    try{
      await fetchJson('/api/categories', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:'Bearer '+t},
        body:JSON.stringify({name_en:c.label_en, name_ar:c.label_ar || '', active:c.visible !== false, sort_order:0})
      });
    }catch(e){ console.warn('Could not ensure category in DB:', c.label_en, e); }
  }

  const previousSaveCategories = window.saveCategories;
  window.saveCategories = async function(){
    try{
      const current = mergeCategories(window.categories || [], DEFAULT_CV_CATEGORIES);
      storeCategories(current);

      for(const c of current){
        await ensureCategoryInDatabase(c);
      }

      const t = token();
      if(!t) throw new Error('Missing admin token. Login again.');
      const settings = await fetchJson('/api/settings');
      await fetchJson('/api/settings', {
        method:'PUT',
        headers:{'Content-Type':'application/json', Authorization:'Bearer '+t},
        body:JSON.stringify(Object.assign({}, settings || {}, {categories: current}))
      });
      await window.cvLoadCategoriesFromBackend();
      msg('Categories published permanently and reloaded from backend.');
    }catch(e){
      console.error('v32 save categories failed', e);
      if(typeof previousSaveCategories === 'function'){
        try{ return await previousSaveCategories.apply(window, arguments); }catch(_e){}
      }
      msg('Categories could not publish: '+e.message, true);
    }
  };

  const previousAddCategory = window.addCategory;
  window.addCategory = async function(){
    const beforeCount = Array.isArray(window.categories) ? window.categories.length : 0;
    if(typeof previousAddCategory === 'function'){
      await previousAddCategory.apply(window, arguments);
    }
    const after = mergeCategories(window.categories || [], DEFAULT_CV_CATEGORIES);
    storeCategories(after);
    await window.saveCategories();
    if(after.length > beforeCount) msg('Category added, published, and will remain after refresh.');
  };

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){ window.cvLoadCategoriesFromBackend(); }, 350);
  });
  setTimeout(function(){ window.cvLoadCategoriesFromBackend(); }, 1200);
})();


/* CRAFTED-VISUAL-CATEGORY-DELETE-PERSISTENCE-FIX-20260609-33
   Focus only: keep deleted categories deleted after Save/Refresh.
   Keeps v32 category loading/merging and all previous product/media fixes intact.
*/
(function(){
  'use strict';
  if(window.__cv33CategoryDeletePersistencePatch) return;
  window.__cv33CategoryDeletePersistencePatch = true;

  const DEFAULT_CATEGORIES = [
    {label_en:'L Shape Sofas', label_ar:'كنب حرف L', visible:true},
    {label_en:'Beds', label_ar:'أسرة', visible:true},
    {label_en:'Single Chairs', label_ar:'كراسي مفردة', visible:true}
  ];

  function msg(m, err){ if(typeof window.showAdminStatus === 'function') window.showAdminStatus(m, !!err); else console[err?'error':'log'](m); }
  function token(){ return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || ''; }
  function clean(v){ return String(v || '').trim(); }
  function key(v){ return clean(v).toLowerCase(); }
  function canWrite(){ return !window.hasAdminPermission || window.hasAdminPermission('categories','write'); }
  function normalize(c){
    const label = clean(c?.label_en || c?.name_en || c?.name || c?.label || c?.category || '');
    if(!label) return null;
    return {
      label_en:label,
      label_ar:clean(c?.label_ar || c?.name_ar || c?.arabic || ''),
      visible:c?.visible !== false && c?.active !== 0 && c?.active !== false,
      id:c?.id || c?._dbId || c?.category_id || undefined
    };
  }
  function readDeletedLocal(){
    try{ return JSON.parse(localStorage.getItem('cvDeletedCategories') || sessionStorage.getItem('cvDeletedCategories') || '[]') || []; }
    catch(e){ return []; }
  }
  function writeDeletedLocal(list){
    const unique = Array.from(new Set((list || []).map(key).filter(Boolean)));
    try{ localStorage.setItem('cvDeletedCategories', JSON.stringify(unique)); }catch(e){}
    try{ sessionStorage.setItem('cvDeletedCategories', JSON.stringify(unique)); }catch(e){}
    return unique;
  }
  function addDeleted(name){
    const list = readDeletedLocal();
    list.push(key(name));
    return writeDeletedLocal(list);
  }
  function removeDeleted(name){
    const k = key(name);
    return writeDeletedLocal(readDeletedLocal().filter(x => key(x) !== k));
  }
  function mergeFiltered(){
    const deleted = new Set(readDeletedLocal().map(key));
    const out = [];
    const seen = new Set();
    for(const source of arguments){
      (Array.isArray(source) ? source : []).forEach(raw => {
        const c = normalize(raw);
        if(!c) return;
        const k = key(c.label_en);
        if(deleted.has(k)) return;
        if(seen.has(k)){
          const ex = out.find(x => key(x.label_en) === k);
          if(ex){
            if(!ex.label_ar && c.label_ar) ex.label_ar = c.label_ar;
            if(!ex.id && c.id) ex.id = c.id;
            ex.visible = ex.visible !== false || c.visible !== false;
          }
          return;
        }
        seen.add(k);
        out.push(c);
      });
    }
    return out;
  }
  function store(list){
    window.categories = mergeFiltered(list || []);
    try{ localStorage.setItem('cms_categories', JSON.stringify(window.categories)); }catch(e){}
    try{ sessionStorage.setItem('cms_categories', JSON.stringify(window.categories)); }catch(e){}
    return window.categories;
  }
  function refresh(){
    if(typeof window.renderCategories === 'function') window.renderCategories();
    if(typeof window.renderCategorySelect === 'function') window.renderCategorySelect();
    if(typeof window.renderDiscountTargets === 'function') window.renderDiscountTargets();
    if(typeof window.syncCategoryArabic === 'function') window.syncCategoryArabic();
  }
  async function fetchJson(url, options){
    const res = await fetch(url, Object.assign({cache:'no-store'}, options || {}));
    const data = await res.json().catch(()=>null);
    if(!res.ok) throw new Error((data && data.error) || ('Request failed: '+res.status));
    return data;
  }
  async function getSettings(){ try{ return await fetchJson('/api/settings'); }catch(e){ return {}; } }
  async function putSettings(patch){
    const t = token();
    if(!t) throw new Error('Missing admin token. Login again.');
    const current = await getSettings();
    return fetchJson('/api/settings', {
      method:'PUT',
      headers:{'Content-Type':'application/json', Authorization:'Bearer '+t},
      body:JSON.stringify(Object.assign({}, current || {}, patch || {}))
    });
  }
  async function dbCategories(){ try{ return await fetchJson('/api/categories'); }catch(e){ return []; } }
  async function ensureDb(c){
    const t = token();
    if(!t || !c || !c.label_en || c.visible === false) return;
    const existing = await dbCategories();
    if(existing.some(x => key(x.name_en || x.label_en) === key(c.label_en))) return;
    try{
      await fetchJson('/api/categories', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:'Bearer '+t},
        body:JSON.stringify({name_en:c.label_en, name_ar:c.label_ar || '', active:1, sort_order:0})
      });
    }catch(e){ console.warn('Could not create DB category', c.label_en, e); }
  }

  window.cvLoadCategoriesFromBackend = async function(){
    let localCats = [];
    try{ localCats = JSON.parse(localStorage.getItem('cms_categories') || sessionStorage.getItem('cms_categories') || '[]') || []; }catch(e){}
    const settings = await getSettings();
    const settingsDeleted = Array.isArray(settings.deleted_categories) ? settings.deleted_categories : [];
    writeDeletedLocal(readDeletedLocal().concat(settingsDeleted));
    const settingsCats = Array.isArray(settings.categories) ? settings.categories : [];
    const dbCats = await dbCategories();

    /* Important: defaults are only a fallback. They must not resurrect a deleted category. */
    const hasAnySaved = settingsCats.length || localCats.length || dbCats.length;
    const merged = mergeFiltered(settingsCats, dbCats, localCats, hasAnySaved ? [] : DEFAULT_CATEGORIES);
    store(merged);
    refresh();
    return merged;
  };

  window.saveCategories = async function(){
    if(!canWrite()) return msg('You have read-only access for Product Category.', true);
    try{
      const current = store(window.categories || []);
      const deleted = readDeletedLocal();
      for(const c of current){ await ensureDb(c); }
      await putSettings({categories:current, deleted_categories:deleted});
      store(current);
      refresh();
      msg('Categories saved permanently. Deleted categories will stay deleted after refresh.');
    }catch(e){
      console.error('v33 save categories failed', e);
      msg('Categories could not publish: '+e.message, true);
    }
  };

  const previousAddCategory = window.addCategory;
  window.addCategory = async function(){
    const name = clean(document.getElementById('cat_en')?.value || '');
    if(name) removeDeleted(name);
    if(typeof previousAddCategory === 'function') await previousAddCategory.apply(window, arguments);
    await window.saveCategories();
  };

  window.removeCategory = async function(index){
    if(!canWrite()) return msg('You have read-only access for Product Category.', true);
    const i = Number(index);
    const cats = Array.isArray(window.categories) ? window.categories : [];
    if(!cats[i]) return;
    const removedName = cats[i].label_en || cats[i].name_en || cats[i].name;
    if(!confirm('Delete this category permanently from admin view and shop filters?')) return;
    addDeleted(removedName);
    cats.splice(i, 1);
    store(cats);
    refresh();
    await window.saveCategories();
    msg('Category deleted permanently. It will not return after Save or Refresh.');
  };

  document.addEventListener('click', function(e){
    const removeBtn = e.target.closest('[data-cv31-remove-category]');
    const saveBtn = e.target.closest('button[onclick="saveCategories()"]');
    if(removeBtn){ e.preventDefault(); e.stopPropagation(); window.removeCategory(removeBtn.getAttribute('data-cv31-remove-category')); }
    if(saveBtn){ e.preventDefault(); e.stopPropagation(); window.saveCategories(); }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(window.cvLoadCategoriesFromBackend, 500); });
  setTimeout(window.cvLoadCategoriesFromBackend, 1400);
})();


/* CRAFTED-VISUAL-DISCOUNT-PAGE-FIX-20260609-34
   Focus only: Discount Page buttons, bulk discounts, save, and discount codes.
   Keeps all previous v33 category/product/media fixes intact.
*/
(function(){
  'use strict';

  if(window.__cv34DiscountPatch) return;
  window.__cv34DiscountPatch = true;

  function q(id){ return document.getElementById(id); }
  function val(id){ return (q(id)?.value || '').trim(); }
  function num(id, fallback=0){
    const n = Number(val(id));
    return Number.isFinite(n) ? n : fallback;
  }
  function adminToken(){
    return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || '';
  }
  function show(message, err=false){
    if(typeof window.showAdminStatus === 'function') window.showAdminStatus(message, !!err);
    else alert(message);
  }

  let currentDiscountEdit = null;

  function setDiscountEditMode(entry){
    currentDiscountEdit = entry || null;
    const btn = q('applyDiscountBtn');
    if(btn) btn.textContent = currentDiscountEdit ? 'Update Discount' : 'Apply Discount';
    let cancel = q('cancelDiscountEditBtn');
    if(currentDiscountEdit && btn && !cancel){
      cancel = document.createElement('button');
      cancel.id = 'cancelDiscountEditBtn';
      cancel.type = 'button';
      cancel.className = 'btn secondary';
      cancel.textContent = 'Cancel Edit';
      btn.insertAdjacentElement('afterend', cancel);
    }
    if(cancel) cancel.style.display = currentDiscountEdit ? '' : 'none';
  }

  function resetDiscountForm(){
    ['discountTargetType','discountCategoryTarget','discountProductTarget','discountApplyScope','discountSizeTarget','discountFabricTarget','bulkDiscount'].forEach(id => { if(q(id)) q(id).value = ''; });
    if(q('discountStatus')) q('discountStatus').value = 'active';
    setDiscountEditMode(null);
    if(typeof window.renderDiscountTargets === 'function') window.renderDiscountTargets();
  }
  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  async function api(path, options={}){
    const token = adminToken();
    if(!token) throw new Error('Missing admin token. Please logout and login again.');
    const headers = Object.assign({}, options.headers || {}, {Authorization:'Bearer ' + token});
    if(!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    const res = await fetch('/api' + path, Object.assign({}, options, {
      headers,
      body: options.body instanceof FormData ? options.body : (
        options.body !== undefined && typeof options.body !== 'string'
          ? JSON.stringify(options.body)
          : options.body
      )
    }));
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }
  async function publicApi(path){
    const res = await fetch('/api' + path, {cache:'no-store'});
    const data = await res.json().catch(()=>[]);
    if(!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }
  function normalizeProduct(row){
    const data = row && row.data ? row.data : {};
    const p = Object.assign({}, data);
    p._dbId = row.id || data._dbId;
    p.id = data.id || row.sku || String(row.id || '');
    p.name = data.name || row.name_en || '';
    p.name_ar = data.name_ar || row.name_ar || '';
    p.category = data.category || row.category_name || '';
    p.category_ar = data.category_ar || row.category_ar || '';
    p.description = data.description || row.description_en || '';
    p.description_ar = data.description_ar || row.description_ar || '';
    p.price = Number(data.price || row.base_price || 0);
    p.vatRate = Number(data.vatRate || row.vat_rate || 15);
    p.discountPercent = Number(data.discountPercent || 0);
    return p;
  }
  function productPayload(p){
    return {
      sku: p.id,
      name_en: p.name,
      name_ar: p.name_ar || '',
      category_name: p.category || '',
      category_ar: p.category_ar || '',
      description_en: p.description || '',
      description_ar: p.description_ar || '',
      base_price: Number(p.price || 0),
      vat_rate: Number(p.vatRate || 15),
      active: true,
      data: p
    };
  }
  async function loadProductsForDiscount(){
    const rows = await publicApi('/products');
    const list = Array.isArray(rows) ? rows.map(normalizeProduct) : [];
    try{ window.products = list; }catch(e){}
    return list;
  }
  async function loadCategoriesForDiscount(productsList){
    let cats = [];
    try{
      const rows = await publicApi('/categories');
      cats = (Array.isArray(rows) ? rows : []).map(c => c.name_en || c.label_en || c.name || '').filter(Boolean);
    }catch(e){}
    (productsList || []).forEach(p => { if(p.category) cats.push(p.category); });
    try{
      if(Array.isArray(window.categories)){
        window.categories.forEach(c => cats.push(c.label_en || c.name_en || c.name || ''));
      }
    }catch(e){}
    return [...new Set(cats.map(x=>String(x).trim()).filter(Boolean))];
  }

  function getProductSizesForDiscount(p){
    const out = [];
    const add = (v) => {
      if(v === undefined || v === null) return;
      if(typeof v === 'object') v = v.label || v.name || v.value || v.size || v.title || '';
      String(v).split(',').forEach(x => { const t = x.trim(); if(t) out.push(t); });
    };
    if(p && Array.isArray(p.sizeOptions)) p.sizeOptions.forEach(add);
    if(p && Array.isArray(p.sizes)) p.sizes.forEach(add);
    if(p && Array.isArray(p.fabricOptions)){
      p.fabricOptions.forEach(f => {
        if(f && f.sizePrices && typeof f.sizePrices === 'object') Object.keys(f.sizePrices).forEach(add);
        if(f && f.sizeCosts && typeof f.sizeCosts === 'object') Object.keys(f.sizeCosts).forEach(add);
        if(f && f.costPrices && typeof f.costPrices === 'object') Object.keys(f.costPrices).forEach(add);
      });
    }
    if(p && p.priceMatrix && typeof p.priceMatrix === 'object') Object.keys(p.priceMatrix).forEach(add);
    return [...new Set(out.map(x=>String(x || '').trim()).filter(Boolean))];
  }

  function getProductFabricsForDiscount(p){
    const out = [];
    const add = (v) => {
      if(v === undefined || v === null) return;
      if(typeof v === 'object') v = v.label || v.name || v.value || v.fabric || v.title || '';
      String(v).split(',').forEach(x => { const t = x.trim(); if(t) out.push(t); });
    };
    if(p && Array.isArray(p.fabricOptions)) p.fabricOptions.forEach(add);
    if(p && Array.isArray(p.fabrics)) p.fabrics.forEach(add);
    if(p && p.priceMatrix && typeof p.priceMatrix === 'object'){
      Object.values(p.priceMatrix).forEach(row => {
        if(row && typeof row === 'object') Object.keys(row).forEach(add);
      });
    }
    return [...new Set(out.map(x=>String(x || '').trim()).filter(Boolean))];
  }

  function ensureDiscountApplyScopeOptions(){
    const el = q('discountApplyScope');
    if(!el) return;
    const current = el.value || 'product';
    el.innerHTML = [
      '<option value="product">Product Only</option>',
      '<option value="size">Size Only</option>',
      '<option value="fabric">Fabric Only</option>',
      '<option value="combo">Size + Fabric Combination</option>'
    ].join('');
    el.value = ['product','size','fabric','combo'].includes(current) ? current : 'product';
  }
  function hideDiscountSelect(id){
    const el = q(id);
    if(!el) return;
    el.style.display = 'none';
    if(id !== 'discountApplyScope') el.innerHTML = '';
  }
  function showDiscountSelect(id){
    const el = q(id);
    if(!el) return el;
    if(id === 'discountApplyScope') ensureDiscountApplyScopeOptions();
    el.style.display = '';
    return el;
  }

  async function renderDiscountVariantTargets(){
    const type = val('discountTargetType');
    const productId = val('discountProductTarget');
    const applyScope = val('discountApplyScope') || 'product';
    const scopeEl = q('discountApplyScope');
    const sizeEl = q('discountSizeTarget');
    const fabricEl = q('discountFabricTarget');

    if(!scopeEl || !sizeEl || !fabricEl) return;

    if(type !== 'product'){
      hideDiscountSelect('discountApplyScope');
      hideDiscountSelect('discountSizeTarget');
      hideDiscountSelect('discountFabricTarget');
      return;
    }

    showDiscountSelect('discountApplyScope');
    const products = await loadProductsForDiscount();
    const p = products.find(x => String(x.id) === String(productId) || String(x._dbId) === String(productId));

    const sizes = getProductSizesForDiscount(p);
    const fabrics = getProductFabricsForDiscount(p);
    const selectedSize = sizeEl.value;
    const selectedFabric = fabricEl.value;

    if(applyScope === 'size' || applyScope === 'combo'){
      showDiscountSelect('discountSizeTarget');
      sizeEl.innerHTML = sizes.length ? '<option value="">Choose Size</option>' + sizes.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('') : '<option value="">No sizes found for this product</option>';
      if(selectedSize) sizeEl.value = selectedSize;
    }else{
      hideDiscountSelect('discountSizeTarget');
    }

    if(applyScope === 'fabric' || applyScope === 'combo'){
      showDiscountSelect('discountFabricTarget');
      fabricEl.innerHTML = fabrics.length ? '<option value="">Choose Fabric</option>' + fabrics.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('') : '<option value="">No fabrics found for this product</option>';
      if(selectedFabric) fabricEl.value = selectedFabric;
    }else{
      hideDiscountSelect('discountFabricTarget');
    }
  }

  window.renderDiscountVariantTargets = renderDiscountVariantTargets;

  window.renderDiscountTargets = async function(){
    const type = val('discountTargetType');
    const categoryEl = q('discountCategoryTarget');
    const productEl = q('discountProductTarget');
    const oldScopeEl = q('discountScope');
    const oldTargetEl = q('discountTarget');

    // Backward compatibility if an older cached admin.html is still open.
    if(oldScopeEl && oldTargetEl && !q('discountTargetType')){
      const scope = val('discountScope') || 'product';
      const products = await loadProductsForDiscount();
      if(scope === 'all') oldTargetEl.innerHTML = '<option value="all">All Products</option>';
      else if(scope === 'category'){
        const cats = await loadCategoriesForDiscount(products);
        oldTargetEl.innerHTML = cats.length ? cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('') : '<option value="">No categories found</option>';
      }else{
        oldTargetEl.innerHTML = products.length ? products.map(p=>`<option value="${esc(p.id)}">${esc(p.name || p.id)}</option>`).join('') : '<option value="">No products found</option>';
      }
      return;
    }

    if(!categoryEl || !productEl) return;

    hideDiscountSelect('discountCategoryTarget');
    hideDiscountSelect('discountProductTarget');
    hideDiscountSelect('discountApplyScope');
    hideDiscountSelect('discountSizeTarget');
    hideDiscountSelect('discountFabricTarget');

    if(!type) return;

    try{
      const products = await loadProductsForDiscount();

      if(type === 'category'){
        const cats = await loadCategoriesForDiscount(products);
        showDiscountSelect('discountCategoryTarget');
        categoryEl.innerHTML = cats.length ? cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('') : '<option value="">No categories found</option>';
      }

      if(type === 'product'){
        showDiscountSelect('discountProductTarget');
        productEl.innerHTML = products.length ? products.map(p=>`<option value="${esc(p.id)}">${esc(p.name || p.id)}</option>`).join('') : '<option value="">No products found</option>';
        await renderDiscountVariantTargets();
      }
    }catch(e){
      console.error('Discount target load failed', e);
      show('Could not load discount targets: ' + e.message, true);
    }
  };

  function getDiscountSelection(){
    const newType = val('discountTargetType');
    if(newType){
      return {
        type: newType,
        target: newType === 'category' ? val('discountCategoryTarget') : (newType === 'product' ? val('discountProductTarget') : 'all'),
        applyScope: newType === 'product' ? (val('discountApplyScope') || 'product') : 'product',
        size: val('discountSizeTarget'),
        fabric: val('discountFabricTarget'),
        active: val('discountStatus') !== 'inactive',
        publishPages: (typeof window.getSelectedPublishPages === 'function' ? window.getSelectedPublishPages('discountPublishPages') : ['discounted-items.html'])
      };
    }
    return {
      type: val('discountScope') || 'product',
      target: val('discountTarget'),
      applyScope: 'product',
      size: '',
      fabric: '',
      active: true,
      publishPages: (typeof window.getSelectedPublishPages === 'function' ? window.getSelectedPublishPages('discountPublishPages') : ['discounted-items.html'])
    };
  }

  function discountRuleMatches(rule, selection){
    return String(rule.scope || '') === String(selection.applyScope || '') &&
      String(rule.size || '') === String(selection.size || '') &&
      String(rule.fabric || '') === String(selection.fabric || '');
  }

  async function updateDiscountedProducts(percent, selection){
    const products = await loadProductsForDiscount();
    const changed = [];
    const pct = selection.active ? Number(percent || 0) : 0;

    products.forEach(p=>{
      const match = selection.type === 'all' ||
        (selection.type === 'category' && String(p.category) === String(selection.target)) ||
        (selection.type === 'product' && String(p.id) === String(selection.target));

      if(!match) return;

      if(selection.type === 'product' && selection.applyScope !== 'product'){
        const rules = Array.isArray(p.discountRules) ? p.discountRules.filter(r => !discountRuleMatches(r, selection)) : [];
        if(selection.active && pct > 0){
          rules.push({
            scope: selection.applyScope,
            size: selection.applyScope === 'size' || selection.applyScope === 'combo' ? selection.size : '',
            fabric: selection.applyScope === 'fabric' || selection.applyScope === 'combo' ? selection.fabric : '',
            percent: pct,
            active: true,
            updatedAt: new Date().toISOString(),
            publishPages: selection.publishPages || ['discounted-items.html']
          });
        }
        p.discountRules = rules;
      }else{
        p.discountPercent = pct;
        p.discountPages = selection.publishPages || ['discounted-items.html'];
      }
      changed.push(p);
    });

    for(const p of changed){
      if(!p._dbId) continue;
      await api('/products/' + encodeURIComponent(p._dbId), {
        method:'PUT',
        body: productPayload(p)
      });
    }

    try{ window.products = products; }catch(e){}
    try{
      localStorage.setItem('cvPrototypeProducts', JSON.stringify(products));
      localStorage.setItem('adminProducts', JSON.stringify(products));
      sessionStorage.setItem('cvPrototypeProducts', JSON.stringify(products));
      sessionStorage.setItem('adminProducts', JSON.stringify(products));
    }catch(e){}

    if(typeof window.renderProductsAdmin === 'function') window.renderProductsAdmin();
    await window.renderDiscountList();
    return changed.length;
  }

  window.applyDiscount = async function(){
    if(typeof window.hasAdminPermission === 'function' && !window.hasAdminPermission('discounts','write')){
      return show('You do not have write access for discounts.', true);
    }

    const selection = getDiscountSelection();
    const percent = num('bulkDiscount', 0);

    if(!selection.type) return show('Please choose a discount target.', true);
    if(selection.type !== 'all' && !selection.target) return show('Please choose a discount target.', true);
    if(percent < 0 || percent > 90) return show('Discount must be between 0 and 90.', true);
    if(selection.type === 'product' && (selection.applyScope === 'size' || selection.applyScope === 'combo') && !selection.size) return show('Please choose a size for this product.', true);
    if(selection.type === 'product' && (selection.applyScope === 'fabric' || selection.applyScope === 'combo') && !selection.fabric) return show('Please choose a fabric for this product.', true);

    try{
      const count = await updateDiscountedProducts(percent, selection);
      const wasEditing = !!currentDiscountEdit;
      setDiscountEditMode(null);
      show(wasEditing ? `Discount updated and published to ${count} product(s).` : `Discount applied and published to ${count} product(s).`);
    }catch(e){
      console.error('Apply discount failed', e);
      show('Could not apply discount: ' + e.message, true);
    }
  };

  window.clearDiscounts = async function(){
    if(typeof window.hasAdminPermission === 'function' && !window.hasAdminPermission('discounts','write')){
      return show('You do not have write access for discounts.', true);
    }
    try{
      const products = await loadProductsForDiscount();
      for(const p of products){
        p.discountPercent = 0;
        p.discountRules = [];
        if(p._dbId){
          await api('/products/' + encodeURIComponent(p._dbId), {method:'PUT', body: productPayload(p)});
        }
      }
      try{ window.products = products; }catch(e){}
      await window.renderDiscountList();
      show(`All product discounts cleared and published (${products.length} product(s)).`);
    }catch(e){
      console.error('Clear discounts failed', e);
      show('Could not clear discounts: ' + e.message, true);
    }
  };

  window.saveDiscountPage = async function(){
    if(typeof window.hasAdminPermission === 'function' && !window.hasAdminPermission('discounts','write')){
      return show('You do not have write access for discounts.', true);
    }
    try{
      await window.renderDiscountTargets();
      await window.renderDiscountList();
      await window.renderDiscountCodeList();
      show('Discount page is synced with the live backend.');
    }catch(e){
      console.error('Save discount page failed', e);
      show('Could not sync discount page: ' + e.message, true);
    }
  };

  window.addDiscountCode = async function(){
    if(typeof window.hasAdminPermission === 'function' && !window.hasAdminPermission('discounts','write')){
      return show('You do not have write access for discounts.', true);
    }

    const code = val('discountCodeInput').toUpperCase();
    const percent = num('discountCodePercent', 0);
    const expires_at = val('discountCodeExpiry') || null;

    if(!code) return show('Add a discount code.', true);
    if(percent <= 0 || percent > 90) return show('Discount code percent must be between 1 and 90.', true);

    try{
      await api('/discounts', {
        method:'POST',
        body:{code, percent, expires_at, active:true}
      });
      if(q('discountCodeInput')) q('discountCodeInput').value = '';
      if(q('discountCodePercent')) q('discountCodePercent').value = '';
      if(q('discountCodeExpiry')) q('discountCodeExpiry').value = '';
      await window.renderDiscountCodeList();
      show('Discount code created and published.');
    }catch(e){
      console.error('Create discount code failed', e);
      show('Could not create discount code: ' + e.message, true);
    }
  };

  window.renderDiscountCodeList = async function(){
    const box = q('discountCodeList');
    if(!box) return;
    try{
      const rows = await api('/discounts', {method:'GET'});
      if(!Array.isArray(rows) || !rows.length){
        box.innerHTML = '<p>No discount codes yet.</p>';
        return;
      }
      box.innerHTML = rows.map(c=>`
        <div class="admin-item">
          <div>
            <strong>${esc(c.code)}</strong><br>
            ${Number(c.percent || 0)}% discount ${c.expires_at ? '| Expiry: ' + esc(c.expires_at) : ''}<br>
            Status: ${c.active ? 'Active' : 'Inactive'}
          </div>
        </div>
      `).join('');
    }catch(e){
      console.error('Render discount codes failed', e);
      box.innerHTML = '<p>Could not load discount codes.</p>';
    }
  };

  function discountEntriesFromProducts(products){
    const entries = [];
    products.forEach(p => {
      const productId = p.id || p._dbId || '';
      if(Number(p.discountPercent || 0) > 0){
        entries.push({
          key: `product:${productId}`,
          product:p,
          kind:'product',
          ruleIndex:-1,
          scope:'product',
          percent:Number(p.discountPercent || 0),
          active:true,
          label:`Product discount: ${Number(p.discountPercent || 0)}%`
        });
      }
      (Array.isArray(p.discountRules) ? p.discountRules : []).forEach((r, idx) => {
        if(!r || Number(r.percent || 0) <= 0) return;
        const details = [];
        if(r.size) details.push('Size: ' + r.size);
        if(r.fabric) details.push('Fabric: ' + r.fabric);
        const scope = String(r.scope || 'product');
        entries.push({
          key: `rule:${productId}:${idx}`,
          product:p,
          kind:'rule',
          ruleIndex:idx,
          scope,
          size:r.size || '',
          fabric:r.fabric || '',
          percent:Number(r.percent || 0),
          active:r.active !== false,
          label:`${scope.toUpperCase()} discount: ${Number(r.percent || 0)}%${details.length ? ' | ' + details.join(' | ') : ''}${r.active === false ? ' | Inactive' : ''}`
        });
      });
    });
    return entries;
  }

  window.renderDiscountList = async function(){
    const box = q('discountList');
    if(!box) return;
    try{
      const products = await loadProductsForDiscount();
      const active = discountEntriesFromProducts(products);
      box.innerHTML = active.length
        ? active.map(item=>`
          <div class="admin-item">
            <div><strong>${esc(item.product.name || item.product.id)}</strong><br>${esc(item.label)}</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <button type="button" data-discount-edit="${esc(item.key)}">Edit</button>
              <button type="button" data-discount-delete="${esc(item.key)}">Delete</button>
            </div>
          </div>
        `).join('')
        : '<p>No active product discounts.</p>';
    }catch(e){
      console.error('Render discounts failed', e);
      box.innerHTML = '<p>Could not load product discounts.</p>';
    }
  };

  async function findDiscountEntry(key){
    const products = await loadProductsForDiscount();
    return discountEntriesFromProducts(products).find(x => String(x.key) === String(key));
  }

  window.editDiscountOnPage = async function(key){
    try{
      const entry = await findDiscountEntry(key);
      if(!entry) return show('This discount could not be found. Refresh and try again.', true);
      if(q('discountTargetType')) q('discountTargetType').value = 'product';
      await window.renderDiscountTargets();
      if(q('discountProductTarget')) q('discountProductTarget').value = entry.product.id || entry.product._dbId || '';
      await window.renderDiscountVariantTargets();
      if(q('discountApplyScope')) q('discountApplyScope').value = entry.scope || 'product';
      await window.renderDiscountVariantTargets();
      if(q('discountSizeTarget')) q('discountSizeTarget').value = entry.size || '';
      if(q('discountFabricTarget')) q('discountFabricTarget').value = entry.fabric || '';
      if(q('bulkDiscount')) q('bulkDiscount').value = entry.percent || '';
      if(q('discountStatus')) q('discountStatus').value = entry.active === false ? 'inactive' : 'active';
      setDiscountEditMode({key});
      const panel = q('discountControl');
      if(panel && panel.scrollIntoView) panel.scrollIntoView({behavior:'smooth', block:'start'});
      show('Discount loaded for editing on this page.');
    }catch(e){
      console.error('Edit discount failed', e);
      show('Could not load discount for editing: ' + e.message, true);
    }
  };

  window.deleteDiscountOnPage = async function(key){
    if(typeof window.hasAdminPermission === 'function' && !window.hasAdminPermission('discounts','write')){
      return show('You do not have write access for discounts.', true);
    }
    if(!confirm('Delete this discount?')) return;
    try{
      const products = await loadProductsForDiscount();
      let changedProduct = null;
      for(const p of products){
        const productId = p.id || p._dbId || '';
        if(String(key) === `product:${productId}`){
          p.discountPercent = 0;
          changedProduct = p;
          break;
        }
        const m = String(key).match(/^rule:(.*):(\d+)$/);
        if(m && String(m[1]) === String(productId)){
          const idx = Number(m[2]);
          if(Array.isArray(p.discountRules) && p.discountRules[idx]){
            p.discountRules.splice(idx, 1);
            changedProduct = p;
            break;
          }
        }
      }
      if(!changedProduct) return show('This discount could not be found. Refresh and try again.', true);
      if(changedProduct._dbId){
        await api('/products/' + encodeURIComponent(changedProduct._dbId), {method:'PUT', body: productPayload(changedProduct)});
      }
      if(currentDiscountEdit && currentDiscountEdit.key === key) resetDiscountForm();
      await window.renderDiscountList();
      show('Discount deleted.');
    }catch(e){
      console.error('Delete discount failed', e);
      show('Could not delete discount: ' + e.message, true);
    }
  };

  document.addEventListener('click', function(e){
    const rawEl = e.target.closest('[onclick]');
    if(rawEl){
      const raw = rawEl.getAttribute('onclick') || '';
      const fn = (raw.match(/^([A-Za-z_$][\w$]*)\(/) || [])[1];
      if(['applyDiscount','saveDiscountPage','clearDiscounts','addDiscountCode','renderDiscountTargets'].includes(fn)){
        e.preventDefault();
        e.stopPropagation();
        if(typeof window[fn] === 'function') window[fn]();
        return;
      }
    }

    const editDiscountBtn = e.target.closest('[data-discount-edit]');
    if(editDiscountBtn){
      e.preventDefault();
      e.stopPropagation();
      window.editDiscountOnPage(editDiscountBtn.getAttribute('data-discount-edit'));
      return;
    }

    const deleteDiscountBtn = e.target.closest('[data-discount-delete]');
    if(deleteDiscountBtn){
      e.preventDefault();
      e.stopPropagation();
      window.deleteDiscountOnPage(deleteDiscountBtn.getAttribute('data-discount-delete'));
      return;
    }

    const cancelDiscountBtn = e.target.closest('#cancelDiscountEditBtn');
    if(cancelDiscountBtn){
      e.preventDefault();
      e.stopPropagation();
      resetDiscountForm();
      return;
    }
  }, true);

  document.addEventListener('change', function(e){
    if(!e.target) return;
    if(e.target.id === 'discountScope' || e.target.id === 'discountTargetType'){
      window.renderDiscountTargets();
    }
    if(e.target.id === 'discountProductTarget' || e.target.id === 'discountApplyScope'){
      window.renderDiscountVariantTargets();
    }
  }, true);

  document.addEventListener('click', function(e){
    const btn = e.target && e.target.closest('button');
    if(!btn) return;
    const map = {
      applyDiscountBtn:'applyDiscount',
      saveDiscountPageBtn:'saveDiscountPage',
      clearDiscountsBtn:'clearDiscounts',
      createDiscountCodeBtn:'addDiscountCode'
    };
    const fn = map[btn.id];
    if(fn && typeof window[fn] === 'function'){
      e.preventDefault();
      e.stopPropagation();
      window[fn]();
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){
      window.renderDiscountTargets();
      window.renderDiscountList();
      window.renderDiscountCodeList();
    }, 500);
  });
})();

})();


/* CRAFTED-VISUAL-PRODUCT-EDIT-STANDARD-SIZE-FABRIC-FIX-20260609-37
   Front/admin product form only: keep photos/sizes/fabrics when editing,
   and add standard dropdown choices while still allowing custom additions.
*/
(function(){
  'use strict';
  if(window.__cv37ProductEditStandardPatch) return;
  window.__cv37ProductEditStandardPatch = true;

  const STD_SIZES = [
    {label:'Single 90×190', width:'90', depth:'190', height:''},
    {label:'Single 100×200', width:'100', depth:'200', height:''},
    {label:'Queen 160×200', width:'160', depth:'200', height:''},
    {label:'King 180×200', width:'180', depth:'200', height:''},
    {label:'Super King 200×200', width:'200', depth:'200', height:''},
    {label:'2 Seater Sofa', width:'160', depth:'90', height:'85'},
    {label:'3 Seater Sofa', width:'220', depth:'95', height:'85'},
    {label:'L Shape Sofa Medium', width:'280', depth:'180', height:'85'},
    {label:'L Shape Sofa Large', width:'320', depth:'220', height:'85'}
  ];
  const STD_FABRICS = [
    {label:'Velvet', description:'Soft premium velvet fabric.'},
    {label:'Linen', description:'Natural linen-look upholstery fabric.'},
    {label:'Bouclé', description:'Textured luxury bouclé fabric.'},
    {label:'Leather', description:'Premium leather upholstery.'},
    {label:'Suede', description:'Soft suede-touch upholstery.'},
    {label:'Chenille', description:'Durable woven chenille fabric.'},
    {label:'Microfiber', description:'Easy-care microfiber fabric.'}
  ];

  function q(id){ return document.getElementById(id); }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function msg(m,err){ if(typeof window.showAdminStatus==='function') window.showAdminStatus(m,!!err); else console[err?'error':'log'](m); }
  function getGlobal(name, fallback){ try{ return (0,eval)(name); }catch(e){ return fallback; } }
  function setGlobal(name, value){ try{ (0,eval)(name + ' = arguments[1]')(name, value); }catch(e){ try{ window[name]=value; }catch(_){} } }
  function arr(name){ const v=getGlobal(name, window[name]); return Array.isArray(v)?v:[]; }
  function obj(name){ const v=getGlobal(name, window[name]); return v && typeof v==='object' ? v : {}; }
  function deep(v){ try{return JSON.parse(JSON.stringify(v||{}));}catch(e){return v||{};} }

  function installStandardDropdowns(){
    if(q('standardSizeSelect') || !q('sizeNameInput')) return;
    const sizeWrap=document.createElement('div');
    sizeWrap.className='admin-grid-3 cv-standard-choice-row';
    sizeWrap.innerHTML=`<select id="standardSizeSelect"><option value="">Choose standard size</option>${STD_SIZES.map((s,i)=>`<option value="${i}">${esc(s.label)}${s.width||s.depth?` — ${esc([s.width,s.depth,s.height].filter(Boolean).join(' × '))} cm`:''}</option>`).join('')}<option value="custom">Custom size / type manually below</option></select><button class="btn secondary" type="button" id="addStandardSizeBtn">Add Selected Size</button>`;
    q('sizeNameInput').closest('.admin-grid-3')?.before(sizeWrap);

    const fabricInput=q('fabricNameInput');
    if(fabricInput && !q('standardFabricSelect')){
      const fabricWrap=document.createElement('div');
      fabricWrap.className='admin-grid-3 cv-standard-choice-row';
      fabricWrap.innerHTML=`<select id="standardFabricSelect"><option value="">Choose standard fabric</option>${STD_FABRICS.map((f,i)=>`<option value="${i}">${esc(f.label)}</option>`).join('')}<option value="custom">Custom fabric / type manually below</option></select><button class="btn secondary" type="button" id="addStandardFabricBtn">Add Selected Fabric</button>`;
      fabricInput.closest('.admin-grid-3')?.before(fabricWrap);
    }
  }

  function addStandardSize(){
    const sel=q('standardSizeSelect'); if(!sel || sel.value==='' || sel.value==='custom') return msg('Choose a standard size or type a custom size below.', true);
    const s=STD_SIZES[Number(sel.value)]; if(!s) return;
    const sizes=arr('manualSizes');
    if(!sizes.some(x=>String(x.label).toLowerCase()===String(s.label).toLowerCase())) sizes.push({...s});
    setGlobal('manualSizes', sizes);
    if(typeof window.renderManualSizeTable==='function') window.renderManualSizeTable();
    if(typeof window.buildSizeFabricPriceTable==='function') window.buildSizeFabricPriceTable();
    if(typeof window.refreshFabricDropdowns==='function') window.refreshFabricDropdowns();
    msg('Standard size added: '+s.label);
  }
  function addStandardFabric(){
    const sel=q('standardFabricSelect'); if(!sel || sel.value==='' || sel.value==='custom') return msg('Choose a standard fabric or type a custom fabric below.', true);
    const f=STD_FABRICS[Number(sel.value)]; if(!f) return;
    const fabrics=arr('manualFabrics');
    if(!fabrics.some(x=>String(x.label).toLowerCase()===String(f.label).toLowerCase())) fabrics.push({...f});
    setGlobal('manualFabrics', fabrics);
    if(typeof window.renderManualFabricTable==='function') window.renderManualFabricTable();
    if(typeof window.buildSizeFabricPriceTable==='function') window.buildSizeFabricPriceTable();
    if(typeof window.refreshFabricDropdowns==='function') window.refreshFabricDropdowns();
    msg('Standard fabric added: '+f.label);
  }

  function productById(pid){
    const list=arr('products');
    return list.find(p=>String(p.id)===String(pid) || String(p._dbId)===String(pid)) || null;
  }
  function rebuildMapsFromProduct(p){
    const priceMap=deep(p.sizeFabricPrices || {});
    const costMap=deep(p.sizeFabricCosts || {});
    (p.fabricOptions||[]).forEach(f=>{
      const fl=f.label || String(f);
      Object.entries(f.sizePrices||{}).forEach(([s,v])=>{ priceMap[s]=priceMap[s]||{}; priceMap[s][fl]=Number(v||0); });
      Object.entries(f.sizeCosts||f.costPrices||{}).forEach(([s,v])=>{ costMap[s]=costMap[s]||{}; costMap[s][fl]=Number(v||0); });
    });
    return {priceMap,costMap};
  }
  function repopulateProductForm(p){
    if(!p) return;
    ['id','name','name_ar','category','price','costPrice','vatRate','discountPercent','description','description_ar'].forEach(k=>{ if(q(k)) q(k).value = p[k] ?? ''; });
    if(q('sizes')) q('sizes').value=(p.sizes||[]).join('\n');
    if(q('fabrics')) q('fabrics').value=(p.fabrics||[]).join('\n');
    if(q('gallery')) q('gallery').value=(p.gallery||[]).join('\n');
    const sizes=(p.sizeOptions&&p.sizeOptions.length?p.sizeOptions:(p.sizes||[]).map(x=>({label:String(x)}))).map(s=>({label:s.label||String(s),width:s.width||'',depth:s.depth||'',height:s.height||'',price:Number(s.price||0)}));
    const fabrics=(p.fabricOptions&&p.fabricOptions.length?p.fabricOptions:(p.fabrics||[]).map(x=>({label:String(x),description:''}))).map(f=>({label:f.label||String(f),description:f.description||''}));
    setGlobal('manualSizes', sizes);
    setGlobal('manualFabrics', fabrics);
    const maps=rebuildMapsFromProduct(p);
    setGlobal('sizeFabricPrices', maps.priceMap);
    setGlobal('sizeFabricCosts', maps.costMap);
    setGlobal('colorSets', deep(p.colors || {}));
    try{ if(typeof window.syncCategoryArabic==='function') window.syncCategoryArabic(); }catch(e){}
    try{ if(typeof window.renderManualSizeTable==='function') window.renderManualSizeTable(); }catch(e){}
    try{ if(typeof window.renderManualFabricTable==='function') window.renderManualFabricTable(); }catch(e){}
    try{ if(typeof window.buildSizeFabricPriceTable==='function') window.buildSizeFabricPriceTable(); }catch(e){}
    try{ if(typeof window.refreshFabricDropdowns==='function') window.refreshFabricDropdowns(); }catch(e){}
    try{ if(typeof window.renderColorSets==='function') window.renderColorSets(); }catch(e){}
  }

  const previousEdit = window.editProduct;
  window.editProduct = function(pid){
    const p=productById(pid);
    let result;
    if(typeof previousEdit==='function'){
      try{ result=previousEdit.apply(window, arguments); }catch(e){ console.warn('Original editProduct failed; using safe edit.', e); }
    }
    setTimeout(()=>{ repopulateProductForm(p || productById(pid)); }, 80);
    return result;
  };

  document.addEventListener('click', function(e){
    if(e.target && e.target.id==='addStandardSizeBtn'){ e.preventDefault(); e.stopPropagation(); addStandardSize(); }
    if(e.target && e.target.id==='addStandardFabricBtn'){ e.preventDefault(); e.stopPropagation(); addStandardFabric(); }
  }, true);
  document.addEventListener('change', function(e){
    if(e.target && e.target.id==='standardSizeSelect'){
      const s=STD_SIZES[Number(e.target.value)]; if(s){ if(q('sizeNameInput')) q('sizeNameInput').value=s.label; if(q('sizeWidthInput')) q('sizeWidthInput').value=s.width; if(q('sizeDepthInput')) q('sizeDepthInput').value=s.depth; if(q('sizeHeightInput')) q('sizeHeightInput').value=s.height; }
    }
    if(e.target && e.target.id==='standardFabricSelect'){
      const f=STD_FABRICS[Number(e.target.value)]; if(f){ if(q('fabricNameInput')) q('fabricNameInput').value=f.label; if(q('fabricDescInput')) q('fabricDescInput').value=f.description; }
    }
  }, true);

  function boot(){ installStandardDropdowns(); }
  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 500);
})();


/* === CV PAGE BUILDER + PAGE CONNECTION CONTROL ONLY ===
   Adds admin control for custom pages, menu/page connections, and publish page choices.
   Does not change shop rendering.
*/
(function(){
  'use strict';
  if(window.__cvPageBuilderControlOnly) return;
  window.__cvPageBuilderControlOnly = true;

  function q(id){ return document.getElementById(id); }
  function v(id){ return (q(id)?.value || '').trim(); }
  function checked(id){ return !!q(id)?.checked; }
  function esc(x){ return String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function msg(text, err){ if(typeof window.showAdminStatus === 'function') window.showAdminStatus(text, !!err); else alert(text); }
  function slugify(x){ return String(x || '').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06FF]+/g,'-').replace(/^-|-$/g,''); }
  function token(){ return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || ''; }

  async function apiSettings(next){
    if(typeof publishSettings === 'function') return publishSettings(next);
    const t = token();
    const res = await fetch('/api/settings', {method:'PUT', headers:{'Content-Type':'application/json', Authorization:'Bearer '+t}, body:JSON.stringify(next)});
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || ('HTTP '+res.status));
    return data;
  }

  function getSettings(){
    try{ if(typeof settings !== 'undefined') return settings || {}; }catch(e){}
    window.settings = window.settings || {};
    return window.settings;
  }

  function getPages(){
    const st = getSettings();
    if(!Array.isArray(st.custom_pages)) st.custom_pages = [];
    return st.custom_pages;
  }

  function builtinPages(){
    return [
      {id:'home', label:'Home', url:'index.html'},
      {id:'shop', label:'Shop', url:'shop.html'},
      {id:'discounted', label:'Discounted Items', url:'discounted-items.html'},
      {id:'custom', label:'Custom Order', url:'index.html#custom'},
      {id:'track', label:'Track Order', url:'track-order.html'},
      {id:'contact', label:'Contact Us', url:'contact.html'},
      {id:'account', label:'My Account', url:'account.html'}
    ];
  }

  function seoForBuiltin(id){
    const st = getSettings();
    const keyMap = {home:'home', shop:'shop', discounted:'discounted', custom:'home', track:'track', contact:'contact', account:'account'};
    return (st.seo_pages && st.seo_pages[keyMap[id] || id]) || {};
  }

  function menuInfoForUrl(url){
    const found = currentMenu().find(m => String(m.url || '') === String(url || ''));
    return found || {};
  }

  function builtinStoredContent(id){
    const st = getSettings();
    st.page_content = st.page_content || {};
    return st.page_content[id] || {};
  }

  function defaultHomeShopByRoom(){
    return {
      title_en:'Shop by Room', title_ar:'تسوق حسب الغرفة',
      shop_all_en:'Shop All', shop_all_ar:'تسوق الكل', shop_all_url:'shop.html',
      cards:[
        {key:'living', title_en:'Living Room', title_ar:'غرفة المعيشة', subtitle_en:'Explore', subtitle_ar:'استكشف', url:'shop.html?category=L%20Shape%20Sofas'},
        {key:'bedroom', title_en:'Bedroom', title_ar:'غرفة النوم', subtitle_en:'Explore', subtitle_ar:'استكشف', url:'shop.html?category=Beds'},
        {key:'majlis', title_en:'Majlis', title_ar:'المجلس', subtitle_en:'Explore', subtitle_ar:'استكشف', url:'shop.html?category=Single%20Chairs'},
        {key:'custom', title_en:'Custom Made', title_ar:'تفصيل حسب الطلب', subtitle_en:'Explore', subtitle_ar:'استكشف', url:'shop.html'}
      ]
    };
  }

  function mergeHomeShopByRoom(saved){
    const d = defaultHomeShopByRoom();
    const s = saved && typeof saved === 'object' ? saved : {};
    const cards = Array.isArray(s.cards) ? s.cards : [];
    return Object.assign({}, d, s, {
      cards: d.cards.map((card, i) => Object.assign({}, card, cards[i] || {}))
    });
  }

  function ensureHomeShopByRoomFields(){
    if(q('homeShopByRoomEditor')) return;
    const anchor = q('page_body_ar') || q('page_body_en');
    if(!anchor || !anchor.parentNode) return;
    const wrap = document.createElement('div');
    wrap.id = 'homeShopByRoomEditor';
    wrap.style.display = 'none';
    wrap.style.gridColumn = '1 / -1';
    wrap.innerHTML = `
      <h3>Home Page - Shop by Room Boxes</h3>
      <div class="admin-grid-3">
        <input id="home_room_title_en" placeholder="Shop by Room title English">
        <input id="home_room_title_ar" placeholder="Shop by Room title Arabic">
        <input id="home_room_shop_all_url" placeholder="Shop All URL">
        <input id="home_room_shop_all_en" placeholder="Shop All text English">
        <input id="home_room_shop_all_ar" placeholder="Shop All text Arabic">
      </div>
      <div class="admin-grid-3">
        ${['living','bedroom','majlis','custom'].map(key => `
          <div style="grid-column:1/-1;border:1px solid #eadfce;border-radius:14px;padding:12px;margin-top:8px;">
            <strong>${key.charAt(0).toUpperCase() + key.slice(1)} box</strong>
            <div class="admin-grid-3">
              <input id="home_room_${key}_title_en" placeholder="${key} title English">
              <input id="home_room_${key}_title_ar" placeholder="${key} title Arabic">
              <input id="home_room_${key}_url" placeholder="${key} link URL">
              <input id="home_room_${key}_subtitle_en" placeholder="${key} subtitle English">
              <input id="home_room_${key}_subtitle_ar" placeholder="${key} subtitle Arabic">
            </div>
          </div>`).join('')}
      </div>`;
    anchor.insertAdjacentElement('afterend', wrap);
  }

  function fillHomeShopByRoomFields(data){
    ensureHomeShopByRoomFields();
    const wrap = q('homeShopByRoomEditor');
    if(!wrap) return;
    const home = mergeHomeShopByRoom(data);
    const set = (id, val) => { if(q(id)) q(id).value = val || ''; };
    set('home_room_title_en', home.title_en); set('home_room_title_ar', home.title_ar);
    set('home_room_shop_all_en', home.shop_all_en); set('home_room_shop_all_ar', home.shop_all_ar); set('home_room_shop_all_url', home.shop_all_url);
    (home.cards || []).forEach(card => {
      const key = card.key;
      set(`home_room_${key}_title_en`, card.title_en); set(`home_room_${key}_title_ar`, card.title_ar);
      set(`home_room_${key}_subtitle_en`, card.subtitle_en); set(`home_room_${key}_subtitle_ar`, card.subtitle_ar);
      set(`home_room_${key}_url`, card.url);
    });
  }

  function collectHomeShopByRoomFields(){
    const keys = ['living','bedroom','majlis','custom'];
    return {
      title_en:v('home_room_title_en') || 'Shop by Room', title_ar:v('home_room_title_ar') || 'تسوق حسب الغرفة',
      shop_all_en:v('home_room_shop_all_en') || 'Shop All', shop_all_ar:v('home_room_shop_all_ar') || 'تسوق الكل', shop_all_url:v('home_room_shop_all_url') || 'shop.html',
      cards: keys.map(key => ({
        key,
        title_en:v(`home_room_${key}_title_en`), title_ar:v(`home_room_${key}_title_ar`),
        subtitle_en:v(`home_room_${key}_subtitle_en`), subtitle_ar:v(`home_room_${key}_subtitle_ar`),
        url:v(`home_room_${key}_url`)
      }))
    };
  }

  function toggleHomeShopByRoomEditor(show, data){
    ensureHomeShopByRoomFields();
    const wrap = q('homeShopByRoomEditor');
    if(!wrap) return;
    wrap.style.display = show ? 'block' : 'none';
    if(show) fillHomeShopByRoomFields(data);
  }

  function builtinEditablePage(id){
    const st = getSettings();
    const base = builtinPages().find(p => p.id === id);
    if(!base) return null;
    const stored = builtinStoredContent(id);
    const seo = seoForBuiltin(id);
    const menuItem = menuInfoForUrl(base.url);
    const defaults = {
      home:{
        title_en: st.hero_title_en || 'Home', title_ar: st.hero_title_ar || '',
        subtitle_en: st.hero_text_en || '', subtitle_ar: st.hero_text_ar || '',
        body_en: [st.intro_title_en, st.intro_text_en, st.about_title_en, st.about_text_en, st.footer_text_en].filter(Boolean).join('\n\n'),
        body_ar: [st.intro_title_ar, st.intro_text_ar, st.about_title_ar, st.about_text_ar, st.footer_text_ar].filter(Boolean).join('\n\n'),
        hero_image: st.hero_image || (Array.isArray(st.hero_banners) && st.hero_banners[0]) || '',
        home_shop_by_room: mergeHomeShopByRoom((st.page_content && st.page_content.home && st.page_content.home.home_shop_by_room) || {})
      },
      shop:{title_en:'Shop Collection', title_ar:'مجموعة المتجر', subtitle_en:'Browse products by category, fabric, color, size, and price.', subtitle_ar:'تصفح المنتجات حسب الفئة والقماش واللون والمقاس والسعر.', body_en:'Product grid, categories, filters, product details, cart buttons, and shop tools are controlled by the shop page.', body_ar:'شبكة المنتجات والفئات والفلاتر وتفاصيل المنتجات وأزرار السلة وأدوات المتجر يتم التحكم بها من صفحة المتجر.'},
      discounted:{title_en:'Discounted Items', title_ar:'المنتجات المخفضة', subtitle_en:'All active discounted products appear here automatically.', subtitle_ar:'تظهر هنا جميع المنتجات المخفضة النشطة تلقائياً.', body_en:'This page is connected to shop products and filters only discounted items.', body_ar:'هذه الصفحة مرتبطة بمنتجات المتجر وتعرض المنتجات المخفضة فقط.'},
      custom:{title_en:'Custom Order', title_ar:'طلب تفصيل', subtitle_en:'Custom furniture request form.', subtitle_ar:'نموذج طلب أثاث مخصص.', body_en:'Customer name, mobile, category, size, fabric, color, city, notes, and WhatsApp submission form.', body_ar:'نموذج الاسم والجوال والفئة والمقاس والقماش واللون والمدينة والملاحظات والإرسال عبر واتساب.'},
      track:{title_en:'Track Your Order', title_ar:'تتبع طلبك', subtitle_en:'Enter the full order number exactly as received.', subtitle_ar:'أدخل رقم الطلب كاملاً كما وصل إليك.', body_en:'Order tracking form and order status result area.', body_ar:'نموذج تتبع الطلب ومنطقة عرض حالة الطلب.'},
      contact:{title_en:'Contact Us', title_ar:'تواصل معنا', subtitle_en:'For furniture inquiries, custom orders, delivery, after-sales support, and project requests.', subtitle_ar:'لاستفسارات الأثاث والطلبات الخاصة والتوصيل وخدمة ما بعد البيع وطلبات المشاريع.', body_en:'Contact information, inquiry form, WhatsApp, social links, phone, email, and address.', body_ar:'معلومات التواصل ونموذج الاستفسار وواتساب وروابط التواصل والهاتف والبريد والعنوان.'},
      account:{title_en:'My Account', title_ar:'حسابي', subtitle_en:'Manage your saved delivery details.', subtitle_ar:'إدارة بيانات التوصيل المحفوظة.', body_en:'Customer profile, saved delivery details, account fields, and logout action.', body_ar:'ملف العميل وبيانات التوصيل المحفوظة وحقول الحساب وتسجيل الخروج.'}
    };
    const d = defaults[id] || {};
    return Object.assign({}, d, stored, {
      id:'builtin:' + id, builtin_id:id, slug:id, url:base.url,
      menu_label_en: stored.menu_label_en || menuItem.label_en || base.label,
      menu_label_ar: stored.menu_label_ar || menuItem.label_ar || stored.title_ar || d.title_ar || base.label,
      seo_title_en: stored.seo_title_en || seo.title_en || seo.title || '',
      seo_title_ar: stored.seo_title_ar || seo.title_ar || '',
      seo_description_en: stored.seo_description_en || seo.description_en || seo.description || '',
      seo_description_ar: stored.seo_description_ar || seo.description_ar || '',
      seo_keywords: stored.seo_keywords || (Array.isArray(seo.keywords) ? seo.keywords.join(', ') : (seo.keywords || '')),
      active: stored.active !== false,
      show_in_menu: stored.show_in_menu !== false && menuItem.visible !== false
    });
  }

  function fillPageForm(page){
    if(!page) return;
    const map = {
      page_edit_id:page.id, page_title_en:page.title_en, page_title_ar:page.title_ar, page_slug:page.slug,
      page_menu_en:page.menu_label_en, page_menu_ar:page.menu_label_ar, page_url:page.url,
      page_subtitle_en:page.subtitle_en, page_subtitle_ar:page.subtitle_ar, page_body_en:page.body_en, page_body_ar:page.body_ar,
      page_hero_image:page.hero_image, page_button_label_en:page.button_label_en, page_button_label_ar:page.button_label_ar, page_button_url:page.button_url,
      page_seo_title_en:page.seo_title_en, page_seo_title_ar:page.seo_title_ar, page_seo_description_en:page.seo_description_en, page_seo_description_ar:page.seo_description_ar,
      page_seo_keywords:page.seo_keywords
    };
    Object.entries(map).forEach(([id,val])=>{ if(q(id)) q(id).value = val || ''; });
    if(q('page_status')) q('page_status').value = page.active === false ? 'inactive' : 'active';
    if(q('page_show_menu')) q('page_show_menu').checked = page.show_in_menu !== false;
    toggleHomeShopByRoomEditor(page.builtin_id === 'home' || page.id === 'builtin:home', page.home_shop_by_room);
    q('pageManagerPanel')?.scrollIntoView({behavior:'smooth', block:'start'});
  }

  async function saveBuiltinPageContent(page){
    const st = getSettings();
    const builtinId = String(page.id || '').replace('builtin:', '');
    const base = builtinPages().find(p => p.id === builtinId);
    if(!base) throw new Error('Existing page not found.');
    st.page_content = st.page_content || {};
    st.page_content[builtinId] = Object.assign({}, page, {id:'builtin:' + builtinId, builtin_id:builtinId, url:base.url, updatedAt:new Date().toISOString()});

    st.seo_pages = st.seo_pages || {};
    const seoKey = {home:'home', shop:'shop', discounted:'discounted', custom:'home', track:'track', contact:'contact', account:'account'}[builtinId] || builtinId;
    st.seo_pages[seoKey] = Object.assign({}, st.seo_pages[seoKey] || {}, {
      title_en:page.seo_title_en || page.title_en || '', title_ar:page.seo_title_ar || page.title_ar || '',
      description_en:page.seo_description_en || page.subtitle_en || '', description_ar:page.seo_description_ar || page.subtitle_ar || '',
      keywords:String(page.seo_keywords || '').split(',').map(x=>x.trim()).filter(Boolean)
    });

    let items = currentMenu();
    const idx = items.findIndex(m => String(m.url || '') === String(base.url));
    const menuItem = {label_en:page.menu_label_en || page.title_en || base.label, label_ar:page.menu_label_ar || page.title_ar || page.menu_label_en || base.label, url:base.url, visible:page.show_in_menu !== false};
    if(idx >= 0) items[idx] = Object.assign({}, items[idx], menuItem);
    else items.push(menuItem);
    try{ menu = items; }catch(e){ window.menu = items; }
    st.menu = items;
    await apiSettings(st);
    localStorage.setItem('cms_settings', JSON.stringify(st));
    localStorage.setItem('cms_menu', JSON.stringify(items));
    if(typeof window.renderMenu === 'function') window.renderMenu();
  }

  function allPageOptions(){
    return builtinPages().concat(getPages().filter(p => p && p.active !== false).map(p => ({
      id:p.id || p.slug,
      label:p.menu_label_en || p.title_en || p.slug,
      url:p.url || ('page.html?slug=' + encodeURIComponent(p.slug || p.id || ''))
    })));
  }

  window.getSelectedPublishPages = function(containerId){
    const box = q(containerId);
    if(!box) return [];
    return Array.from(box.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value).filter(Boolean);
  };

  function renderPublishBoxes(){
    const options = allPageOptions();
    [['productPublishPages',['shop.html']], ['discountPublishPages',['discounted-items.html','shop.html']]].forEach(([id, defaults]) => {
      const box = q(id);
      if(!box) return;
      const selected = window.getSelectedPublishPages(id);
      const active = selected.length ? selected : defaults;
      box.innerHTML = options.map(p => `<label style="display:inline-flex;align-items:center;gap:6px;margin:4px 12px 4px 0;"><input type="checkbox" value="${esc(p.url)}" ${active.includes(p.url)?'checked':''}> ${esc(p.label)}</label>`).join('');
    });
  }

  function currentMenu(){
    try{ if(Array.isArray(menu)) return menu; }catch(e){}
    return [];
  }

  async function publishPagesAndMenu(){
    const st = getSettings();
    const pages = getPages();
    let items = currentMenu().filter(m => !m.__customPage);
    pages.forEach(p => {
      if(p.show_in_menu && p.active !== false){
        items.push({label_en:p.menu_label_en || p.title_en, label_ar:p.menu_label_ar || p.title_ar || p.menu_label_en || p.title_en, url:p.url, visible:true, __customPage:true, page_id:p.id});
      }
    });
    try{ menu = items; }catch(e){ window.menu = items; }
    st.menu = items;
    await apiSettings(st);
    localStorage.setItem('cms_settings', JSON.stringify(st));
    localStorage.setItem('cms_menu', JSON.stringify(items));
    if(typeof window.renderMenu === 'function') window.renderMenu();
  }

  function collectPage(){
    const title = v('page_title_en');
    const slug = slugify(v('page_slug') || title);
    if(!title) throw new Error('Add page title.');
    if(!slug) throw new Error('Add page slug.');
    return {
      id: v('page_edit_id') || slug,
      slug,
      url: v('page_url') || ('page.html?slug=' + encodeURIComponent(slug)),
      title_en:title,
      title_ar:v('page_title_ar'),
      menu_label_en:v('page_menu_en') || title,
      menu_label_ar:v('page_menu_ar') || v('page_title_ar') || title,
      subtitle_en:v('page_subtitle_en'),
      subtitle_ar:v('page_subtitle_ar'),
      body_en:v('page_body_en'),
      body_ar:v('page_body_ar'),
      hero_image:v('page_hero_image'),
      button_label_en:v('page_button_label_en'),
      button_label_ar:v('page_button_label_ar'),
      button_url:v('page_button_url'),
      seo_title_en:v('page_seo_title_en'),
      seo_title_ar:v('page_seo_title_ar'),
      seo_description_en:v('page_seo_description_en'),
      seo_description_ar:v('page_seo_description_ar'),
      seo_keywords:v('page_seo_keywords'),
      home_shop_by_room: (v('page_edit_id') === 'builtin:home') ? collectHomeShopByRoomFields() : undefined,
      active:v('page_status') !== 'inactive',
      show_in_menu:checked('page_show_menu'),
      updatedAt:new Date().toISOString()
    };
  }

  window.clearCustomPageForm = function(){
    ['page_edit_id','page_title_en','page_title_ar','page_slug','page_menu_en','page_menu_ar','page_url','page_subtitle_en','page_subtitle_ar','page_body_en','page_body_ar','page_hero_image','page_button_label_en','page_button_label_ar','page_button_url','page_seo_title_en','page_seo_title_ar','page_seo_description_en','page_seo_description_ar','page_seo_keywords'].forEach(id=>{ if(q(id)) q(id).value=''; });
    ['home_room_title_en','home_room_title_ar','home_room_shop_all_en','home_room_shop_all_ar','home_room_shop_all_url','home_room_living_title_en','home_room_living_title_ar','home_room_living_subtitle_en','home_room_living_subtitle_ar','home_room_living_url','home_room_bedroom_title_en','home_room_bedroom_title_ar','home_room_bedroom_subtitle_en','home_room_bedroom_subtitle_ar','home_room_bedroom_url','home_room_majlis_title_en','home_room_majlis_title_ar','home_room_majlis_subtitle_en','home_room_majlis_subtitle_ar','home_room_majlis_url','home_room_custom_title_en','home_room_custom_title_ar','home_room_custom_subtitle_en','home_room_custom_subtitle_ar','home_room_custom_url'].forEach(id=>{ if(q(id)) q(id).value=''; });
    toggleHomeShopByRoomEditor(false);
    if(q('page_status')) q('page_status').value='active';
    if(q('page_show_menu')) q('page_show_menu').checked=true;
  };

  window.saveCustomPage = async function(){
    try{
      if(typeof window.hasAdminPermission === 'function' && !window.hasAdminPermission('menu','write')) return msg('You have read-only access for page connections.', true);
      const page = collectPage();
      if(String(page.id || '').startsWith('builtin:')){
        await saveBuiltinPageContent(page);
        renderCustomPageList();
        renderPublishBoxes();
        window.clearCustomPageForm();
        msg('Existing page content saved.');
        return;
      }
      const st = getSettings();
      const pages = getPages();
      const idx = pages.findIndex(p => String(p.id) === String(page.id) || String(p.slug) === String(page.slug));
      if(idx >= 0) pages[idx] = Object.assign({}, pages[idx], page); else pages.push(page);
      st.custom_pages = pages;
      await publishPagesAndMenu();
      renderCustomPageList();
      renderPublishBoxes();
      window.clearCustomPageForm();
      msg('Page and menu connection saved.');
    }catch(e){ msg('Could not save page: ' + e.message, true); }
  };

  window.editCustomPage = function(id){
    const page = getPages().find(p => String(p.id) === String(id));
    if(!page) return;
    fillPageForm(page);
  };

  window.editExistingPageContent = function(id){
    const page = builtinEditablePage(id);
    if(!page) return msg('Existing page not found.', true);
    fillPageForm(page);
  };

  window.deleteCustomPage = async function(id){
    if(!confirm('Delete this page connection and content?')) return;
    const st = getSettings();
    st.custom_pages = getPages().filter(p => String(p.id) !== String(id));
    await publishPagesAndMenu();
    renderCustomPageList();
    renderPublishBoxes();
    msg('Page deleted.');
  };

  window.toggleCustomPage = async function(id){
    const st = getSettings();
    const page = getPages().find(p => String(p.id) === String(id));
    if(!page) return;
    page.active = page.active === false ? true : false;
    await publishPagesAndMenu();
    renderCustomPageList();
    renderPublishBoxes();
    msg('Page status updated.');
  };

  function renderCustomPageList(){
    const box = q('customPageList');
    if(!box) return;
    const existing = builtinPages().map(p => {
      const content = builtinEditablePage(p.id) || {};
      return `<div class="admin-item"><div><strong>${esc(content.title_en || p.label)}</strong><br>${esc(p.url)}<br>Existing page | Status: ${content.active === false ? 'Inactive' : 'Active'} | Menu: ${content.show_in_menu === false ? 'Hidden' : 'Shown'}</div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button type="button" data-existing-page-edit="${esc(p.id)}">Edit Existing Content</button></div></div>`;
    }).join('');
    const pages = getPages();
    const custom = pages.length ? pages.map(p => `<div class="admin-item"><div><strong>${esc(p.title_en || p.slug)}</strong><br>${esc(p.url)}<br>Custom page | Status: ${p.active === false ? 'Inactive' : 'Active'} | Menu: ${p.show_in_menu === false ? 'Hidden' : 'Shown'}</div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button type="button" onclick="editCustomPage('${esc(p.id)}')">Edit Content</button><button type="button" onclick="toggleCustomPage('${esc(p.id)}')">${p.active === false ? 'Enable' : 'Disable'}</button><button type="button" onclick="deleteCustomPage('${esc(p.id)}')">Delete</button></div></div>`).join('') : '<p>No custom pages yet.</p>';
    box.innerHTML = '<h3>Existing Pages</h3>' + existing + '<h3>Custom Pages</h3>' + custom;
    box.querySelectorAll('[data-existing-page-edit]').forEach(btn => {
      btn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); window.editExistingPageContent(this.getAttribute('data-existing-page-edit')); });
    });
  }

  window.renderCustomPageList = renderCustomPageList;


  function bindPageBuilderButtons(){
    const saveBtn = Array.from(document.querySelectorAll('button')).find(btn => (btn.getAttribute('onclick') || '').includes('saveCustomPage'));
    if(saveBtn && !saveBtn.dataset.cvPageSaveBound){
      saveBtn.dataset.cvPageSaveBound = '1';
      saveBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); window.saveCustomPage(); }, true);
    }
    const clearBtn = Array.from(document.querySelectorAll('button')).find(btn => (btn.getAttribute('onclick') || '').includes('clearCustomPageForm'));
    if(clearBtn && !clearBtn.dataset.cvPageClearBound){
      clearBtn.dataset.cvPageClearBound = '1';
      clearBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); window.clearCustomPageForm(); }, true);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureHomeShopByRoomFields();
    bindPageBuilderButtons();
    setTimeout(function(){ renderCustomPageList(); renderPublishBoxes(); }, 500);
  });
  setTimeout(function(){ bindPageBuilderButtons(); renderCustomPageList(); renderPublishBoxes(); }, 1000);


  /* === CV MENU EDIT BUTTON SAFE PATCH ===
     Adds Edit capability without replacing the existing menu renderer.
     Keeps Show/Hide and Delete buttons exactly as they were.
  */
  let cvMenuEditIndex = -1;

  function cvMenuAddButton(){
    return Array.from(document.querySelectorAll('button')).find(btn => (btn.getAttribute('onclick') || '').includes('addMenuItem'));
  }

  function cvMenuClearForm(){
    ['menu_label_en','menu_label_ar','menu_url'].forEach(id => { if(q(id)) q(id).value = ''; });
  }

  function cvMenuSetEditMode(index){
    cvMenuEditIndex = Number.isInteger(index) ? index : -1;
    const btn = cvMenuAddButton();
    if(btn) btn.textContent = cvMenuEditIndex >= 0 ? 'Update Menu Item' : 'Add Menu Item';
    let cancel = q('cvCancelMenuEditBtn');
    if(cvMenuEditIndex >= 0){
      if(btn && !cancel){
        cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.id = 'cvCancelMenuEditBtn';
        cancel.textContent = 'Cancel Edit';
        cancel.style.marginLeft = '8px';
        cancel.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          window.cancelMenuEdit();
        });
        btn.insertAdjacentElement('afterend', cancel);
      }
    }else if(cancel){
      cancel.remove();
    }
  }

  function cvMenuEnhanceButtons(){
    const list = q('menuList');
    if(!list) return;
    const items = getMenuItems();
    Array.from(list.children).forEach((row, index) => {
      if(!items[index]) return;
      if(row.querySelector('[data-cv-menu-edit]')) return;
      const buttons = row.querySelectorAll('button');
      if(!buttons.length) return;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.setAttribute('data-cv-menu-edit', String(index));
      edit.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        window.editMenuItem(index);
      });
      const deleteBtn = Array.from(buttons).find(btn => (btn.textContent || '').trim().toLowerCase() === 'delete');
      if(deleteBtn) deleteBtn.insertAdjacentElement('beforebegin', edit);
      else buttons[buttons.length - 1].insertAdjacentElement('afterend', edit);
    });
  }

  window.editMenuItem = function(index){
    if(!window.hasAdminPermission('menu','write')) return status('You have read-only access for Menu.', true);
    const items = getMenuItems();
    const item = items[Number(index)];
    if(!item) return status('Menu item not found.', true);
    if(q('menu_label_en')) q('menu_label_en').value = item.label_en || '';
    if(q('menu_label_ar')) q('menu_label_ar').value = item.label_ar || '';
    if(q('menu_url')) q('menu_url').value = item.url || '';
    cvMenuSetEditMode(Number(index));
    status('Editing menu item. Change the fields, then click Update Menu Item.');
  };

  window.cancelMenuEdit = function(){
    cvMenuClearForm();
    cvMenuSetEditMode(-1);
    status('Menu edit cancelled.');
  };

  const cvMenuOriginalAddMenuItem = window.addMenuItem;
  window.addMenuItem = async function(){
    if(cvMenuEditIndex < 0){
      const result = cvMenuOriginalAddMenuItem ? await cvMenuOriginalAddMenuItem() : undefined;
      setTimeout(cvMenuEnhanceButtons, 50);
      return result;
    }
    if(!window.hasAdminPermission('menu','write')) return status('You have read-only access for Menu.', true);
    const en = val('menu_label_en');
    const ar = val('menu_label_ar');
    const url = val('menu_url');
    if(!en || !url) return status('Add menu label and URL.', true);
    const items = getMenuItems();
    const current = items[cvMenuEditIndex];
    if(!current){
      cvMenuSetEditMode(-1);
      return status('Menu item not found. Please try again.', true);
    }
    items[cvMenuEditIndex] = Object.assign({}, current, {label_en:en, label_ar:ar, url:url});
    setMenuItems(items);
    cvMenuClearForm();
    cvMenuSetEditMode(-1);
    if(typeof window.renderMenu === 'function') window.renderMenu();
    setTimeout(cvMenuEnhanceButtons, 50);
    try{
      await publishSettings({menu:items});
      status('Menu item updated and published.');
    }catch(e){
      status('Menu item updated locally, but publish failed: '+e.message, true);
    }
  };

  const cvMenuOriginalRenderMenu = window.renderMenu;
  if(typeof cvMenuOriginalRenderMenu === 'function'){
    window.renderMenu = function(){
      const result = cvMenuOriginalRenderMenu.apply(this, arguments);
      cvMenuEnhanceButtons();
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){
      if(typeof window.renderMenu === 'function') window.renderMenu();
      cvMenuEnhanceButtons();
      cvMenuSetEditMode(-1);
    }, 400);
  });
  setTimeout(cvMenuEnhanceButtons, 1000);

})();

/* === CV MENU EDIT BUTTON ONLY FINAL PATCH ===
   Adds Edit button to Menu Control without changing other sections.
*/
(function(){
  'use strict';
  if(window.__cvMenuEditOnlyFinalPatch) return;
  window.__cvMenuEditOnlyFinalPatch = true;

  var editIndex = -1;

  function byId(id){ return document.getElementById(id); }
  function value(id){ var el = byId(id); return el ? String(el.value || '').trim() : ''; }
  function setValue(id, v){ var el = byId(id); if(el) el.value = v || ''; }
  function statusMsg(msg, isError){
    if(typeof window.status === 'function') return window.status(msg, isError);
    if(typeof window.showAdminStatus === 'function') return window.showAdminStatus(msg, isError);
    var box = byId('adminSaveStatus');
    if(box){ box.textContent = msg || ''; box.className = 'admin-save-status' + (isError ? ' error' : ''); }
  }
  function canWriteMenu(){
    return !(typeof window.hasAdminPermission === 'function') || window.hasAdminPermission('menu','write');
  }
  function currentMenu(){
    if(!Array.isArray(window.menu)){
      try{ window.menu = JSON.parse(localStorage.getItem('cms_menu') || '[]'); }catch(e){ window.menu = []; }
    }
    return window.menu;
  }
  function saveLocal(items){
    window.menu = items;
    try{ localStorage.setItem('cms_menu', JSON.stringify(items)); }catch(e){}
    try{ sessionStorage.setItem('cms_menu', JSON.stringify(items)); }catch(e){}
  }
  async function publishMenu(items){
    if(typeof window.publishSettings === 'function'){
      await window.publishSettings({menu: items});
    }
  }
  function escapeHtml(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
  }
  function addButton(){
    return Array.from(document.querySelectorAll('#menuControl button')).find(function(btn){
      return (btn.getAttribute('onclick') || '').indexOf('addMenuItem') !== -1 || btn.id === 'cvMenuAddUpdateBtn';
    });
  }
  function setMode(index){
    editIndex = Number.isInteger(index) ? index : -1;
    var btn = addButton();
    if(btn){
      btn.id = 'cvMenuAddUpdateBtn';
      btn.textContent = editIndex >= 0 ? 'Update Menu Item' : 'Add Menu Item';
    }
    var cancel = byId('cvCancelMenuEditBtn');
    if(editIndex >= 0){
      if(btn && !cancel){
        cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.id = 'cvCancelMenuEditBtn';
        cancel.className = 'btn secondary';
        cancel.textContent = 'Cancel Edit';
        cancel.style.marginLeft = '8px';
        btn.insertAdjacentElement('afterend', cancel);
      }
    }else if(cancel){
      cancel.remove();
    }
  }
  function clearForm(){
    setValue('menu_label_en','');
    setValue('menu_label_ar','');
    setValue('menu_url','');
  }

  window.renderMenu = function(){
    var list = byId('menuList');
    if(!list) return;
    var items = currentMenu();
    list.innerHTML = items.map(function(m, i){
      return '<div class="admin-item" data-menu-index="' + i + '">' +
        '<div><strong>' + escapeHtml(m.label_en) + '</strong> / ' + escapeHtml(m.label_ar || '') + '<br>' +
        escapeHtml(m.url || '') + '<br>Visible: ' + (m.visible !== false) + '</div>' +
        '<div>' +
          '<button type="button" data-menu-action="toggle" data-menu-index="' + i + '">Show/Hide</button>' +
          '<button type="button" data-menu-action="edit" data-menu-index="' + i + '">Edit</button>' +
          '<button type="button" data-menu-action="delete" data-menu-index="' + i + '">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
    setMode(editIndex >= 0 && items[editIndex] ? editIndex : -1);
  };

  var previousAddMenuItem = window.addMenuItem;
  window.addMenuItem = async function(){
    if(!canWriteMenu()) return statusMsg('You have read-only access for Menu.', true);
    var en = value('menu_label_en');
    var ar = value('menu_label_ar');
    var url = value('menu_url');
    if(!en || !url) return statusMsg('Add menu label and URL.', true);
    var items = currentMenu();

    if(editIndex >= 0){
      if(!items[editIndex]){ setMode(-1); return statusMsg('Menu item not found. Please try again.', true); }
      items[editIndex] = Object.assign({}, items[editIndex], {label_en: en, label_ar: ar, url: url});
      saveLocal(items);
      clearForm();
      setMode(-1);
      window.renderMenu();
      try{ await publishMenu(items); statusMsg('Menu item updated and published.'); }
      catch(e){ statusMsg('Menu item updated locally, but publish failed: ' + e.message, true); }
      return;
    }

    if(typeof previousAddMenuItem === 'function'){
      var result = await previousAddMenuItem.apply(this, arguments);
      window.renderMenu();
      return result;
    }
    items.push({label_en: en, label_ar: ar, url: url, visible: true});
    saveLocal(items);
    clearForm();
    window.renderMenu();
    try{ await publishMenu(items); statusMsg('Menu item added and published.'); }
    catch(e){ statusMsg('Menu item added locally, but publish failed: ' + e.message, true); }
  };

  window.editMenuItem = function(index){
    if(!canWriteMenu()) return statusMsg('You have read-only access for Menu.', true);
    var items = currentMenu();
    var item = items[Number(index)];
    if(!item) return statusMsg('Menu item not found.', true);
    setValue('menu_label_en', item.label_en || '');
    setValue('menu_label_ar', item.label_ar || '');
    setValue('menu_url', item.url || '');
    setMode(Number(index));
    statusMsg('Editing menu item. Click Update Menu Item to save.');
  };

  window.cancelMenuEdit = function(){
    clearForm();
    setMode(-1);
    statusMsg('Menu edit cancelled.');
  };

  document.addEventListener('click', function(e){
    var actionBtn = e.target.closest('#menuList [data-menu-action], #cvCancelMenuEditBtn, #cvMenuAddUpdateBtn');
    if(!actionBtn) return;

    if(actionBtn.id === 'cvCancelMenuEditBtn'){
      e.preventDefault(); e.stopPropagation();
      window.cancelMenuEdit();
      return;
    }
    if(actionBtn.id === 'cvMenuAddUpdateBtn'){
      e.preventDefault(); e.stopPropagation();
      window.addMenuItem();
      return;
    }

    var action = actionBtn.getAttribute('data-menu-action');
    var index = Number(actionBtn.getAttribute('data-menu-index'));
    if(action === 'edit'){
      e.preventDefault(); e.stopPropagation();
      window.editMenuItem(index);
    }else if(action === 'toggle'){
      e.preventDefault(); e.stopPropagation();
      if(typeof window.toggleMenu === 'function') window.toggleMenu(index);
      setTimeout(window.renderMenu, 50);
    }else if(action === 'delete'){
      e.preventDefault(); e.stopPropagation();
      if(typeof window.removeMenu === 'function') window.removeMenu(index);
      setTimeout(window.renderMenu, 50);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(window.renderMenu, 300); });
  setTimeout(window.renderMenu, 800);
})();
