/*
  Crafted Visual Admin Authority Patch
  Purpose: one focused frontend authority layer for the live backend.
  Version: CRAFTED-VISUAL-SUPERADMIN-AUTHORITY-PATCH-20260609-20

  What it fixes:
  - stale / empty superadmin permissions in browser storage
  - localStorage-only fallbacks for menu/categories/SEO/banner/content settings
  - admin user create/edit/delete actions using old prototype logic
  - inline onclick handlers blocked by CSP in some Railway/browser states
  - customer journey and analytics links missing the admin token/session context
*/
(function(){
  'use strict';

  const OWNER_EMAIL = 'admin@craftedvisual.com';
  const MODULES = [
    'menu','pictures','products','categories','seo','discounts','orders',
    'finance','crm','users','analytics','security','inventory','media','settings'
  ];

  function fullPermissions(){
    const out = {};
    MODULES.forEach(k => out[k] = {read:true, write:true});
    return out;
  }

  function readJSON(storage, key, fallback=null){
    try { return JSON.parse(storage.getItem(key) || 'null') ?? fallback; }
    catch(_) { return fallback; }
  }

  function writeJSON(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(_){}
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch(_){}
  }

  function token(){
    return (
      localStorage.getItem('cvAdminApiToken') ||
      sessionStorage.getItem('cvAdminApiToken') ||
      localStorage.getItem('adminToken') ||
      sessionStorage.getItem('adminToken') ||
      ''
    );
  }

  function isOwnerEmail(email){
    return String(email || '').trim().toLowerCase() === OWNER_EMAIL;
  }

  function normalizeAdmin(admin){
    if(!admin) return null;
    const role = String(admin.role || '').trim().toLowerCase();
    const isSuper = role === 'superadmin' || admin.isSuperAdmin === true || isOwnerEmail(admin.email);
    const fixed = Object.assign({}, admin, {
      role: isSuper ? 'superadmin' : (role || 'admin'),
      isSuperAdmin: isSuper,
      permissions: isSuper ? fullPermissions() : (admin.permissions || {})
    });
    writeJSON('cvAdminSession', fixed);
    return fixed;
  }

  function currentAdmin(){
    return normalizeAdmin(
      readJSON(sessionStorage, 'cvAdminSession') ||
      readJSON(localStorage, 'cvAdminSession')
    );
  }

  async function refreshAdminFromBackend(){
    const t = token();
    if(!t) return currentAdmin();

    const res = await fetch('/api/admin/me', {
      headers: { Authorization: 'Bearer ' + t },
      cache: 'no-store'
    });

    if(!res.ok){
      if(res.status === 401 || res.status === 403){
        throw new Error('Admin session expired. Please login again.');
      }
      return currentAdmin();
    }

    const admin = await res.json();
    return normalizeAdmin(admin);
  }

  async function api(path, options={}){
    const t = token();
    if(!t) throw new Error('Missing admin token. Please login again.');

    const headers = Object.assign({}, options.headers || {});
    if(!(options.body instanceof FormData)){
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    headers.Authorization = 'Bearer ' + t;

    const payload = Object.assign({}, options, { headers });
    if(payload.body && !(payload.body instanceof FormData) && typeof payload.body !== 'string'){
      payload.body = JSON.stringify(payload.body);
    }

    const res = await fetch('/api' + path, payload);
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch(_) { data = {raw:text}; }

    if(!res.ok){
      throw new Error(data.error || data.raw || ('API failed: ' + res.status));
    }
    return data;
  }

  async function getSettings(){
    const res = await fetch('/api/settings', {cache:'no-store'});
    if(!res.ok) return {};
    return await res.json().catch(() => ({}));
  }

  async function patchSettings(patch){
    const existing = await getSettings();
    return api('/settings', {
      method:'PUT',
      body:Object.assign({}, existing || {}, patch || {})
    });
  }

  function status(msg, isError=false){
    if(typeof window.showAdminStatus === 'function'){
      window.showAdminStatus(msg, !!isError);
      return;
    }
    const el = document.getElementById('adminSaveStatus');
    if(el){
      el.textContent = msg;
      el.className = 'admin-save-status' + (isError ? ' error' : '');
    }else{
      alert(msg);
    }
  }

  function hasPermission(section, level='read'){
    const admin = currentAdmin();
    if(!admin) return false;
    if(admin.isSuperAdmin || admin.role === 'superadmin' || isOwnerEmail(admin.email)) return true;
    return !!admin.permissions?.[section]?.[level];
  }

  // Export canonical authority functions used by old and new admin code.
  window.cvFullPermissions = fullPermissions;
  window.cvAdminToken = token;
  window.cvCurrentAdmin = currentAdmin;
  window.currentAdmin = currentAdmin;
  window.cvIsSuperAdmin = function(){
    const admin = currentAdmin();
    return !!(admin && (admin.isSuperAdmin || admin.role === 'superadmin' || isOwnerEmail(admin.email)));
  };
  window.cvHasPermission = hasPermission;
  window.hasAdminPermission = hasPermission;

  // Harden CV_API without replacing the whole object.
  if(window.CV_API){
    window.CV_API.token = function(admin=false){
      return admin ? token() : (localStorage.getItem('cvApiToken') || sessionStorage.getItem('cvApiToken') || '');
    };
    window.CV_API.currentAdmin = currentAdmin;
    window.CV_API.request = async function(path, options={}){
      const admin = options.admin === true;
      const headers = Object.assign({}, options.headers || {});
      if(!(options.body instanceof FormData)){
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      }
      const t = admin ? token() : this.token(false);
      if(t) headers.Authorization = 'Bearer ' + t;
      const payload = Object.assign({}, options, {headers});
      delete payload.admin;
      if(payload.body && !(payload.body instanceof FormData) && typeof payload.body !== 'string'){
        payload.body = JSON.stringify(payload.body);
      }
      const res = await fetch('/api' + path, payload);
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; }
      catch(_) { data = {raw:text}; }
      if(!res.ok) throw new Error(data.error || data.raw || 'API request failed');
      return data;
    };
  }

  function collectPermissionMatrix(){
    const permissions = {};
    const boxes = document.querySelectorAll(
      '#newAdminPermissionsMatrix input[type="checkbox"], input[data-perm][data-level]'
    );

    boxes.forEach(cb => {
      const p = cb.dataset.perm || cb.dataset.editPerm;
      const level = cb.dataset.level || cb.dataset.editLevel;
      if(!p || !level) return;
      if(!permissions[p]) permissions[p] = {read:false, write:false};
      permissions[p][level] = !!cb.checked;
    });

    return permissions;
  }

  function fillSuperAdminMatrix(){
    if(!window.cvIsSuperAdmin()) return;
    document.querySelectorAll('#newAdminPermissionsMatrix input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
      cb.disabled = false;
    });
  }

  async function refreshAdminUsers(){
    if(!hasPermission('users','read')) return;
    const rows = await api('/admin-users', {method:'GET'});
    window.cvAdminUsersCache = rows;
    if(typeof window.renderAdminUsers === 'function') window.renderAdminUsers();
    return rows;
  }

  const oldRenderAdminUsers = window.renderAdminUsers;
  window.renderAdminUsers = function(){
    if(typeof oldRenderAdminUsers === 'function') oldRenderAdminUsers();

    const box = document.getElementById('adminUsersList');
    if(!box) return;

    // Ensure displayed owner/superadmin authority is never shown as empty permissions.
    box.querySelectorAll('.admin-item').forEach(item => {
      const txt = item.textContent || '';
      if(/Role:\s*superadmin/i.test(txt) || /admin@craftedvisual\.com/i.test(txt)){
        item.innerHTML = item.innerHTML.replace(
          /Authorities:[\s\S]*?(<\/div>)/i,
          'Authorities: FULL ACCESS (ALL READ / WRITE)$1'
        );
      }
    });
  };

  window.addAdminUser = async function(){
    if(!window.cvIsSuperAdmin()){
      status('Only Super Admin can create admin users.', true);
      return;
    }

    const name = document.getElementById('newAdminName')?.value?.trim();
    const email = document.getElementById('newAdminEmail')?.value?.trim().toLowerCase();
    const password = document.getElementById('newAdminPassword')?.value || '';
    const role = String(document.getElementById('newAdminRole')?.value || 'admin').toLowerCase();

    if(!name || !email || !password){
      status('Name, email and password are required.', true);
      return;
    }
    if(password.length < 8){
      status('Password must be at least 8 characters.', true);
      return;
    }

    const permissions = role === 'superadmin' ? fullPermissions() : collectPermissionMatrix();

    try{
      await refreshAdminFromBackend();
      await api('/admin-users', {
        method:'POST',
        body:{name, email, password, role, permissions, active:true}
      });

      ['newAdminName','newAdminEmail','newAdminPassword'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
      });

      await refreshAdminUsers();
      status((role === 'superadmin' ? 'Super Admin' : 'Admin') + ' created successfully.');
    }catch(e){
      console.error('addAdminUser failed', e);
      status('Could not create admin: ' + e.message, true);
    }
  };

  window.editAdminPermissions = async function(id){
    if(!window.cvIsSuperAdmin()){
      status('Only Super Admin can edit authorities.', true);
      return;
    }

    const rows = window.cvAdminUsersCache || await refreshAdminUsers() || [];
    const user = rows.find(u => Number(u.id) === Number(id));
    if(!user){
      status('Admin user not found.', true);
      return;
    }

    const nextRole = prompt('Role for ' + user.email + ' (admin or superadmin):', user.role || 'admin');
    if(!nextRole) return;

    const role = String(nextRole).toLowerCase() === 'superadmin' ? 'superadmin' : 'admin';
    const permissions = role === 'superadmin' ? fullPermissions() : (user.permissions || {});

    try{
      await api('/admin-users/' + encodeURIComponent(id), {
        method:'PUT',
        body:{name:user.name, role, permissions, active:user.active !== 0}
      });
      await refreshAdminUsers();
      status('Authorities updated.');
    }catch(e){
      console.error('editAdminPermissions failed', e);
      status('Could not update authorities: ' + e.message, true);
    }
  };

  window.deleteAdminUser = async function(id){
    if(!window.cvIsSuperAdmin()){
      status('Only Super Admin can delete admin users.', true);
      return;
    }

    const rows = window.cvAdminUsersCache || await refreshAdminUsers() || [];
    const user = rows.find(u => Number(u.id) === Number(id));
    if(!user) return;

    if(String(user.email || '').toLowerCase() === OWNER_EMAIL){
      status('The system owner cannot be deleted.', true);
      return;
    }

    if(!confirm('Disable admin user "' + user.email + '"?')) return;

    try{
      await api('/admin-users/' + encodeURIComponent(id), {method:'DELETE'});
      await refreshAdminUsers();
      status('Admin user disabled.');
    }catch(e){
      console.error('deleteAdminUser failed', e);
      status('Could not delete admin: ' + e.message, true);
    }
  };

  window.saveMenu = async function(){
    if(!hasPermission('menu','write')) return status('You have read-only access for Menu.', true);
    const currentMenu = window.menu || readJSON(localStorage, 'cms_menu', []);
    try{
      await patchSettings({menu: currentMenu});
      localStorage.setItem('cms_menu', JSON.stringify(currentMenu));
      sessionStorage.setItem('cms_menu', JSON.stringify(currentMenu));
      status('Menu published permanently.');
    }catch(e){
      console.error('saveMenu failed', e);
      status('Could not publish Menu: ' + e.message, true);
    }
  };

  window.saveCategories = async function(){
    if(!hasPermission('categories','write')) return status('You have read-only access for Categories.', true);
    const currentCategories = window.categories || readJSON(localStorage, 'cms_categories', []);
    try{
      await patchSettings({categories: currentCategories});
      localStorage.setItem('cms_categories', JSON.stringify(currentCategories));
      sessionStorage.setItem('cms_categories', JSON.stringify(currentCategories));
      status('Categories published permanently.');
    }catch(e){
      console.error('saveCategories failed', e);
      status('Could not publish Categories: ' + e.message, true);
    }
  };

  window.saveSeoPage = async function(){
    if(!hasPermission('seo','write')) return status('You have read-only access for SEO.', true);
    try{
      if(typeof window.ensureSeoPages === 'function') window.ensureSeoPages();
      window.settings = window.settings || {};
      window.settings.seo_pages = window.settings.seo_pages || {};
      const key = document.getElementById('seoPageKey')?.value || 'home';
      const page = window.settings.seo_pages[key] || {};
      const title = document.getElementById('seoTitle')?.value?.trim() || '';
      const description = document.getElementById('seoDescription')?.value?.trim() || '';
      window.settings.seo_pages[key] = Object.assign({}, page, {
        title, description,
        title_en:title,
        description_en:description,
        keywords:page.keywords || []
      });
      await patchSettings({seo_pages: window.settings.seo_pages});
      if(typeof window.renderSeoPagesList === 'function') window.renderSeoPagesList();
      status('SEO published permanently.');
    }catch(e){
      console.error('saveSeoPage failed', e);
      status('Could not publish SEO: ' + e.message, true);
    }
  };

  const safeFns = new Set([
    'openRealShop','openTab','addMenuItem','saveMenu','resetMenu','toggleMenu','removeMenu',
    'addCategory','saveCategories','toggleCategory','removeCategory','saveSeoPage','addSeoKeyword',
    'removeSeoKeyword','editSeoKeyword','addAdminUser','editAdminPermissions','deleteAdminUser',
    'adminLogout','loadAnalyticsCenter','uploadMedia','saveMediaAlt','deleteMedia','openAssignMedia',
    'saveSettings','saveProduct','editProduct','duplicateProduct','deleteProduct','clearHeroBanners'
  ]);

  function parseArgs(raw, el){
    if(!raw.trim()) return [];
    const parts = [];
    let cur = '', quote = null, depth = 0;
    for(const ch of raw){
      if(quote){
        cur += ch;
        if(ch === quote) quote = null;
        continue;
      }
      if(ch === '"' || ch === "'"){ quote = ch; cur += ch; continue; }
      if(ch === '(' || ch === '[' || ch === '{') depth++;
      if(ch === ')' || ch === ']' || ch === '}') depth--;
      if(ch === ',' && depth === 0){ parts.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if(cur.trim()) parts.push(cur.trim());
    return parts.map(x => {
      if(x === 'this') return el;
      if(x === 'true') return true;
      if(x === 'false') return false;
      if(x === 'null') return null;
      if(/^['"][\s\S]*['"]$/.test(x)) return x.slice(1,-1);
      if(/^-?\d+(\.\d+)?$/.test(x)) return Number(x);
      return x;
    });
  }

  function runInline(el, eventName, event){
    const raw = el.getAttribute(eventName);
    if(!raw) return;
    const clean = raw.replace(/return\s+false;?/g,'').replace(/;$/,'').trim();
    const match = clean.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
    if(!match) return;
    const fnName = match[1];
    if(!safeFns.has(fnName)) return;
    const fn = window[fnName];
    if(typeof fn !== 'function') return;
    event.preventDefault();
    event.stopPropagation();
    fn.apply(window, parseArgs(match[2], el));
  }

  document.addEventListener('click', function(e){
    const tab = e.target.closest('[data-tab]');
    if(tab && typeof window.openTab === 'function'){
      e.preventDefault();
      window.openTab(tab.dataset.tab, tab);
      return;
    }

    const link = e.target.closest('[data-tab-link]');
    if(link && typeof window.openTab === 'function'){
      e.preventDefault();
      window.openTab(link.dataset.tabLink, document.querySelector('[data-tab="' + link.dataset.tabLink + '"]'));
      return;
    }

    const inline = e.target.closest('[onclick]');
    if(inline) runInline(inline, 'onclick', e);
  }, true);

  document.addEventListener('change', function(e){
    const inline = e.target.closest('[onchange]');
    if(inline) runInline(inline, 'onchange', e);

    if(e.target && e.target.id === 'newAdminRole'){
      fillSuperAdminMatrix();
    }
  }, true);

  document.addEventListener('DOMContentLoaded', async function(){
    try{
      await refreshAdminFromBackend();
      fillSuperAdminMatrix();
      if(typeof window.renderAdminUserBar === 'function') window.renderAdminUserBar();
      if(document.getElementById('adminUsersList')) await refreshAdminUsers();
    }catch(e){
      console.warn('Admin authority refresh skipped:', e.message);
    }
  });
})();
