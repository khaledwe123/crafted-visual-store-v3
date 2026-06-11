/* Crafted Visual final authority manager. Loaded last on admin.html.
   Purpose: make Admin/Super Admin creation, listing, edit, delete deterministic against the live backend. */
(function(){
  'use strict';
  const OWNER_EMAIL = 'admin@craftedvisual.com';
  const MODULES = ['menu','pictures','products','categories','seo','discounts','orders','finance','crm','users','analytics','security','inventory','media','settings'];

  function byId(id){ return document.getElementById(id); }
  function clean(v){ return String(v || '').trim(); }
  function emailOk(v){ return /^\S+@\S+\.\S+$/.test(clean(v)); }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fullPermissions(){ const out = {}; MODULES.forEach(k => out[k] = {read:true, write:true}); return out; }
  function ownerEmail(){ return String((window.CV_OWNER_EMAIL || OWNER_EMAIL)).toLowerCase(); }
  function isOwner(u){ return String((u && u.email) || '').toLowerCase() === ownerEmail(); }
  function token(){
    return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') ||
           localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken') ||
           localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }
  function saveSession(user){
    if(!user) return;
    try{ localStorage.setItem('cvAdminSession', JSON.stringify(user)); sessionStorage.setItem('cvAdminSession', JSON.stringify(user)); }catch(e){}
  }
  function session(){
    try{ return JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null'); }catch(e){ return null; }
  }
  function isSuper(){
    const u = session();
    return !!u && (String(u.role || '').toLowerCase() === 'superadmin' || isOwner(u) || u.isSuperAdmin === true);
  }
  function status(msg, err){
    const box = byId('adminSaveStatus');
    if(box){
      box.textContent = msg;
      box.className = 'admin-save-status ' + (err ? 'error' : 'success');
      try{ setTimeout(() => { if(box.textContent === msg){ box.textContent=''; box.className='admin-save-status'; } }, 6500); }catch(e){}
      return;
    }
    (err ? console.error : console.log)(msg);
  }

  async function request(path, options = {}){
    let url = String(path || '');
    if(!url.startsWith('/api/')) url = '/api/' + url.replace(/^\/+/, '').replace(/^api\//, '');
    const t = token();
    if(!t) throw new Error('Missing admin token. Logout and login again.');
    const headers = Object.assign({}, options.headers || {}, { Authorization: 'Bearer ' + t });
    let body = options.body;
    if(body !== undefined && !(body instanceof FormData)){
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      if(typeof body !== 'string') body = JSON.stringify(body);
    }
    const res = await fetch(url, {
      method: options.method || (body !== undefined ? 'POST' : 'GET'),
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body
    });
    const text = await res.text();
    let data = {};
    try{ data = text ? JSON.parse(text) : {}; }catch(e){ data = text; }
    if(!res.ok){
      const msg = data && data.error ? data.error : (typeof data === 'string' && data ? data : 'HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }

  // Normalize/fix API helper for legacy files.
  window.CV_API = window.CV_API || {};
  window.CV_API.token = window.CV_API.token || function(admin){ return admin ? token() : (localStorage.getItem('cvApiToken') || sessionStorage.getItem('cvApiToken') || ''); };
  window.CV_API.available = window.CV_API.available || async function(){ try{ const r = await fetch('/api/health', {cache:'no-store', credentials:'same-origin'}); return r.ok; }catch(e){ return false; } };
  window.CV_API.request = request;
  window.cvAdminApiRequest = request;

  async function verifyCurrentAdmin(){
    const me = await request('/admin/me', {method:'GET'});
    const user = me.user || me;
    saveSession(user);
    return user;
  }

  function readPermissionsFromMatrix(){
    const role = String(byId('newAdminRole')?.value || 'admin').toLowerCase();
    if(role === 'superadmin') return fullPermissions();
    const out = {};
    MODULES.forEach(k => out[k] = {read:false, write:false});
    document.querySelectorAll('#newAdminPermissionsMatrix input[type="checkbox"]').forEach(cb => {
      const perm = cb.dataset.perm || cb.getAttribute('data-perm');
      const level = cb.dataset.level || cb.getAttribute('data-level');
      if(!perm || !level) return;
      if(!out[perm]) out[perm] = {read:false, write:false};
      out[perm][level === 'write' ? 'write' : 'read'] = !!cb.checked;
    });
    return out;
  }
  function permissionsLabel(u){
    const role = String(u.role || '').toLowerCase();
    if(role === 'superadmin' || isOwner(u)) return 'FULL ACCESS (ALL READ / WRITE)';
    const p = u.permissions || {};
    const parts = Object.entries(p).filter(([k,v]) => v && (v.read || v.write)).map(([k,v]) => `${k}: ${v.read?'R':''}${v.write?'W':''}`);
    return parts.join(' | ') || 'No authorities selected';
  }

  window.cvAdminUsersCache = window.cvAdminUsersCache || [];

  window.renderAdminUsers = function(){
    const box = byId('adminUsersList');
    if(!box) return;
    const list = Array.isArray(window.cvAdminUsersCache) ? window.cvAdminUsersCache : [];
    if(!list.length){ box.innerHTML = '<p>No admin users loaded yet.</p>'; return; }
    box.innerHTML = list.map(u => {
      const inactive = Number(u.active) === 0;
      const canDelete = isSuper() && !isOwner(u) && !inactive;
      const canEdit = isSuper();
      return `<div class="admin-item admin-user-row" data-admin-user-id="${esc(u.id)}">
        <div><strong>${esc(u.name || '')}</strong><br>${esc(u.email || '')}<br>Role: ${esc(u.role || 'admin')}${inactive ? ' <strong>(disabled)</strong>' : ''}<br>Authorities: ${esc(permissionsLabel(u))}</div>
        <div class="admin-user-actions">${canEdit ? `<button type="button" data-edit-admin="${esc(u.id)}">Edit Authorities</button>` : ''}${canDelete ? ` <button type="button" class="danger" data-delete-admin="${esc(u.id)}">Delete</button>` : ''}</div>
      </div>`;
    }).join('');
  };

  window.refreshAdminUsers = async function(){
    try{
      await verifyCurrentAdmin();
      const users = await request('/admin-users', {method:'GET'});
      window.cvAdminUsersCache = Array.isArray(users) ? users : [];
      window.renderAdminUsers();
      return window.cvAdminUsersCache;
    }catch(e){
      window.cvAdminUsersCache = [];
      window.renderAdminUsers();
      status('Could not load admin users from backend: ' + (e.message || e), true);
      throw e;
    }
  };

  window.addAdminUser = async function(){
    try{ await verifyCurrentAdmin(); }catch(e){ status('Admin session is invalid. Logout and login again.', true); return; }
    if(!isSuper()){ status('Only Super Admin can create Admin or Super Admin users.', true); return; }
    const name = clean(byId('newAdminName')?.value);
    const email = clean(byId('newAdminEmail')?.value).toLowerCase();
    const password = byId('newAdminPassword')?.value || '';
    const role = String(byId('newAdminRole')?.value || 'admin').toLowerCase() === 'superadmin' ? 'superadmin' : 'admin';
    if(!name){ status('Name is required.', true); return; }
    if(!emailOk(email)){ status('Enter a valid email address.', true); return; }
    if(password.length < 8){ status('Password must be at least 8 characters.', true); return; }
    try{
      await request('/admin-users', {method:'POST', body:{name,email,password,role,permissions: role === 'superadmin' ? fullPermissions() : readPermissionsFromMatrix(),active:true}});
      ['newAdminName','newAdminEmail','newAdminPassword'].forEach(id => { const el=byId(id); if(el) el.value=''; });
      await window.refreshAdminUsers();
      status((role === 'superadmin' ? 'Super Admin' : 'Admin') + ' created successfully.');
    }catch(e){
      status('Could not create user: ' + (e.message || e), true);
      console.error('Admin creation failed:', e);
    }
  };

  window.deleteAdminUser = async function(id){
    try{ await verifyCurrentAdmin(); }catch(e){ status('Admin session is invalid. Logout and login again.', true); return; }
    if(!isSuper()){ status('Only Super Admin can delete admin users.', true); return; }
    const u = (window.cvAdminUsersCache || []).find(x => String(x.id) === String(id));
    if(!u){ status('User not found.', true); return; }
    if(isOwner(u)){ status('The system owner cannot be deleted.', true); return; }
    if(!confirm(`Disable admin user "${u.email || u.name}"?`)) return;
    try{
      await request('/admin-users/' + encodeURIComponent(id), {method:'DELETE'});
      await window.refreshAdminUsers();
      status('Admin user disabled.');
    }catch(e){
      status('Could not delete user: ' + (e.message || e), true);
      console.error('Admin delete failed:', e);
    }
  };

  function bindAdminAuthorityControls(){
    const createBtn = Array.from(document.querySelectorAll('button')).find(b => /create user/i.test((b.textContent || '').trim()));
    if(createBtn && !createBtn.dataset.cvAuthorityBound){
      createBtn.dataset.cvAuthorityBound = '1';
      createBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopImmediatePropagation(); window.addAdminUser(); }, true);
    }
    document.querySelectorAll('[data-delete-admin]').forEach(btn => {
      if(btn.dataset.cvAuthorityBound) return;
      btn.dataset.cvAuthorityBound = '1';
      btn.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); window.deleteAdminUser(btn.dataset.deleteAdmin); }, true);
    });
    document.querySelectorAll('[data-edit-admin]').forEach(btn => {
      if(btn.dataset.cvAuthorityBound) return;
      btn.dataset.cvAuthorityBound = '1';
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if(typeof window.editAdminPermissions === 'function') window.editAdminPermissions(btn.dataset.editAdmin);
      }, true);
    });
  }

  document.addEventListener('click', function(e){
    const createBtn = e.target.closest && e.target.closest('button');
    if(createBtn && /create user/i.test((createBtn.textContent || '').trim())){
      e.preventDefault(); e.stopImmediatePropagation(); window.addAdminUser(); return;
    }
    const del = e.target.closest && e.target.closest('[data-delete-admin]');
    if(del){ e.preventDefault(); e.stopImmediatePropagation(); window.deleteAdminUser(del.dataset.deleteAdmin); return; }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    bindAdminAuthorityControls();
    if(token()) window.refreshAdminUsers().catch(()=>{});
  });
  setInterval(bindAdminAuthorityControls, 1000);
})();
