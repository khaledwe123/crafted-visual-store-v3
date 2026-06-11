/* Crafted Visual stable admin user + API compatibility patch. Loaded last on admin.html. */
(function(){
  'use strict';
  const OWNER_EMAIL = 'admin@craftedvisual.com';
  const MODULES = ['menu','pictures','products','categories','seo','discounts','orders','finance','crm','users','analytics','security','inventory','media','settings'];
  function getToken(){
    return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') ||
           localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken') ||
           localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }
  function getSession(){
    try{return JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null');}
    catch(e){return null;}
  }
  function isSuper(){
    const u = getSession();
    return !!u && (String(u.role||'').toLowerCase()==='superadmin' || String(u.email||'').toLowerCase()===OWNER_EMAIL);
  }
  function fullPermissions(){ const out={}; MODULES.forEach(k=>out[k]={read:true,write:true}); return out; }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function status(msg, err){
    if(typeof window.showAdminStatus === 'function') return window.showAdminStatus(msg, !!err);
    const box = document.getElementById('adminSaveStatus');
    if(box){ box.textContent = msg; box.className = 'admin-save-status ' + (err?'error':'success'); }
    else (err?console.error:console.log)(msg);
  }
  async function api(path, options={}){
    if(window.CV_API && typeof window.CV_API.request === 'function') return window.CV_API.request(path, Object.assign({}, options, {admin:true}));
    const token = getToken();
    if(!token) throw new Error('Missing admin token. Please logout and login again.');
    let url = String(path || '');
    if(!url.startsWith('/api/')) url = '/api/' + url.replace(/^\/+/, '').replace(/^api\//, '');
    const headers = Object.assign({}, options.headers || {}, {Authorization:'Bearer ' + token});
    let body = options.body;
    if(body !== undefined && !(body instanceof FormData)){
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      if(typeof body !== 'string') body = JSON.stringify(body);
    }
    const res = await fetch(url, {method: options.method || 'GET', credentials:'same-origin', cache:'no-store', headers, body});
    const text = await res.text();
    let data = {}; try{data = text ? JSON.parse(text) : {};}catch(e){data = text;}
    if(!res.ok) throw new Error((data && data.error) || (typeof data === 'string' && data) || ('HTTP '+res.status));
    return data;
  }
  window.cvAdminApiRequest = api;
  if(window.CV_API && typeof window.CV_API.request !== 'function'){
    window.CV_API.request = function(path, options){ return api(path, options || {}); };
  }
  function collectPermissions(){
    const role = String(document.getElementById('newAdminRole')?.value || 'admin').toLowerCase();
    if(role === 'superadmin') return fullPermissions();
    const out = {};
    MODULES.forEach(k=>out[k]={read:false,write:false});
    document.querySelectorAll('#newAdminPermissionsMatrix input[type="checkbox"]').forEach(cb=>{
      const p = cb.dataset.perm; const l = cb.dataset.level;
      if(!p || !l) return;
      if(!out[p]) out[p] = {read:false, write:false};
      out[p][l === 'write' ? 'write' : 'read'] = !!cb.checked;
    });
    return out;
  }
  function permissionText(p){
    try{
      return Object.entries(p||{}).filter(([_,v])=>v && (v.read||v.write)).map(([k,v])=>`${k}: ${v.read?'R':''}${v.write?'W':''}`).join(' | ') || 'No permissions';
    }catch(e){ return 'Permissions saved'; }
  }
  function isOwner(u){ return String(u && u.email || '').toLowerCase() === OWNER_EMAIL; }
  window.cvAdminUsersCache = window.cvAdminUsersCache || [];
  window.renderAdminUsers = function(){
    const box = document.getElementById('adminUsersList');
    if(!box) return;
    const list = Array.isArray(window.cvAdminUsersCache) ? window.cvAdminUsersCache : [];
    if(!list.length){ box.innerHTML = '<p>No admin users loaded yet.</p>'; return; }
    box.innerHTML = list.map(u => {
      const role = String(u.role || 'admin').toLowerCase();
      const perms = role === 'superadmin' || isOwner(u) ? 'FULL ACCESS (ALL READ / WRITE)' : permissionText(u.permissions || {});
      const disabled = Number(u.active) === 0 ? ' <strong>(disabled)</strong>' : '';
      const canDelete = isSuper() && !isOwner(u) && Number(u.active) !== 0;
      return `<div class="admin-item" data-admin-user-id="${esc(u.id)}"><div><strong>${esc(u.name||'')}</strong><br>${esc(u.email||'')}<br>Role: ${esc(role)}${disabled}<br>Authorities: ${esc(perms)}</div><div><button type="button" data-edit-admin="${esc(u.id)}">Edit Authorities</button>${canDelete ? ` <button type="button" class="danger" data-delete-admin="${esc(u.id)}">Delete</button>` : ''}</div></div>`;
    }).join('');
  };
  window.refreshAdminUsers = async function(){
    const users = await api('/admin-users', {method:'GET'});
    window.cvAdminUsersCache = Array.isArray(users) ? users : [];
    window.renderAdminUsers();
    return window.cvAdminUsersCache;
  };
  window.addAdminUser = async function(){
    if(!isSuper()){ status('Only Super Admin can create Admin or Super Admin users.', true); return; }
    const name = (document.getElementById('newAdminName')?.value || '').trim();
    const email = (document.getElementById('newAdminEmail')?.value || '').trim().toLowerCase();
    const password = document.getElementById('newAdminPassword')?.value || '';
    const role = String(document.getElementById('newAdminRole')?.value || 'admin').toLowerCase() === 'superadmin' ? 'superadmin' : 'admin';
    if(!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8){ status('Enter name, valid email, and password of at least 8 characters.', true); return; }
    try{
      await api('/admin-users', {method:'POST', body:{name,email,password,role,permissions: role==='superadmin'?fullPermissions():collectPermissions(),active:true}});
      ['newAdminName','newAdminEmail','newAdminPassword'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
      await window.refreshAdminUsers();
      status((role === 'superadmin' ? 'Super Admin' : 'Admin') + ' created successfully.');
    }catch(e){ status('Could not create user: ' + (e.message || e), true); console.error(e); }
  };
  window.deleteAdminUser = async function(id){
    if(!isSuper()){ status('Only Super Admin can delete users.', true); return; }
    const u = (window.cvAdminUsersCache || []).find(x=>String(x.id)===String(id));
    if(!u){ status('User not found.', true); return; }
    if(isOwner(u)){ status('The system owner cannot be deleted.', true); return; }
    if(!confirm('Disable admin user "' + (u.email || u.name || id) + '"?')) return;
    try{ await api('/admin-users/'+id, {method:'DELETE'}); await window.refreshAdminUsers(); status('Admin user disabled.'); }
    catch(e){ status('Could not delete user: ' + (e.message || e), true); console.error(e); }
  };
  function bind(){
    document.querySelectorAll('[data-delete-admin]').forEach(btn=>{ if(btn.dataset.bound) return; btn.dataset.bound='1'; btn.addEventListener('click', e=>{ e.preventDefault(); window.deleteAdminUser(btn.dataset.deleteAdmin); }); });
    document.querySelectorAll('[data-edit-admin]').forEach(btn=>{ if(btn.dataset.bound) return; btn.dataset.bound='1'; btn.addEventListener('click', e=>{ e.preventDefault(); if(typeof window.editAdminPermissions === 'function') window.editAdminPermissions(btn.dataset.editAdmin); else if(typeof editAdminPermissions === 'function') editAdminPermissions(btn.dataset.editAdmin); }); });
    const create = Array.from(document.querySelectorAll('button')).find(b=>/^create user$/i.test((b.textContent||'').trim()));
    if(create && !create.dataset.cvStableBound){ create.dataset.cvStableBound='1'; create.addEventListener('click', e=>{ e.preventDefault(); e.stopImmediatePropagation(); window.addAdminUser(); }, true); }
    const logout = document.getElementById('adminLogoutBtn') || document.getElementById('logoutBtn') || document.querySelector('[data-admin-logout]');
    if(logout && !logout.dataset.cvStableBound){ logout.dataset.cvStableBound='1'; logout.addEventListener('click', e=>{ e.preventDefault(); ['cvAdminApiToken','adminToken','token','cvAdminSession'].forEach(k=>{try{localStorage.removeItem(k);sessionStorage.removeItem(k);}catch(_){}}); location.href='/admin-login.html'; }); }
  }
  document.addEventListener('click', function(e){
    const del = e.target.closest && e.target.closest('[data-delete-admin]'); if(del){ e.preventDefault(); window.deleteAdminUser(del.dataset.deleteAdmin); }
    const edit = e.target.closest && e.target.closest('[data-edit-admin]'); if(edit){ e.preventDefault(); if(typeof window.editAdminPermissions === 'function') window.editAdminPermissions(edit.dataset.editAdmin); }
  }, true);
  document.addEventListener('DOMContentLoaded', function(){ bind(); if(getToken()) window.refreshAdminUsers().catch(e=>console.warn('admin users load skipped', e.message||e)); });
  setInterval(bind, 1200);
})();
