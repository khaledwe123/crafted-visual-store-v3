(function(){
  'use strict';
  const OWNER_EMAIL = 'admin@craftedvisual.com';
  const TOKEN_KEYS = ['cvAdminApiToken','adminToken','token'];

  function getToken(){
    for(const k of TOKEN_KEYS){
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if(v) return v;
    }
    return '';
  }

  function currentSession(){
    try{ return JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null'); }
    catch(e){ return null; }
  }

  function isSuperAdmin(){
    const u = currentSession();
    if(!u) return false;
    return String(u.role || '').toLowerCase() === 'superadmin' || String(u.email || '').toLowerCase() === OWNER_EMAIL;
  }

  function show(message, isError){
    if(typeof window.showAdminStatus === 'function') window.showAdminStatus(message, !!isError);
    else console[isError ? 'error' : 'log'](message);
  }

  async function api(path, options){
    options = options || {};
    const token = getToken();
    if(!token) throw new Error('Missing admin token. Please logout and login again.');
    const headers = Object.assign({}, options.headers || {}, { Authorization: 'Bearer ' + token });
    if(!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    const res = await fetch(path, Object.assign({}, options, {
      headers,
      credentials: 'same-origin',
      body: options.body instanceof FormData ? options.body : (options.body !== undefined && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body)
    }));
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json().catch(()=>({})) : await res.text().catch(()=>'');
    if(!res.ok) throw new Error((data && data.error) || (typeof data === 'string' && data) || ('HTTP ' + res.status));
    return data;
  }

  function esc(x){
    return String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function permissionsText(permissions){
    if(!permissions || typeof permissions !== 'object') return 'No custom permissions';
    const parts = [];
    Object.keys(permissions).sort().forEach(k => {
      const p = permissions[k] || {};
      parts.push(k + ': ' + (p.read ? 'R' : '-') + '/' + (p.write ? 'W' : '-'));
    });
    return parts.join(', ') || 'No custom permissions';
  }

  function canDeleteUser(user){
    const current = currentSession() || {};
    const email = String(user.email || '').toLowerCase();
    if(email === OWNER_EMAIL) return false;
    if(String(current.email || '').toLowerCase() === email) return false;
    if(Number(current.id) && Number(current.id) === Number(user.id)) return false;
    return isSuperAdmin();
  }

  let usersCache = [];

  async function loadUsers(){
    usersCache = await api('/api/admin-users', { method:'GET' });
    if(!Array.isArray(usersCache)) usersCache = [];
    return usersCache;
  }

  function renderUsers(){
    const box = document.getElementById('adminUsersList');
    if(!box) return;
    const visible = (usersCache || []).filter(u => Number(u.active) !== 0);
    if(!visible.length){
      box.innerHTML = '<p>No admin users loaded.</p>';
      return;
    }
    box.innerHTML = visible.map(u => {
      const isOwner = String(u.email || '').toLowerCase() === OWNER_EMAIL;
      const role = String(u.role || 'admin').toLowerCase();
      const authorities = (role === 'superadmin' || isOwner) ? 'FULL ACCESS (ALL READ / WRITE)' : permissionsText(u.permissions);
      const editBtn = isSuperAdmin() ? '<button type="button" data-admin-edit="' + esc(u.id) + '">Edit Authorities</button>' : '';
      const deleteBtn = canDeleteUser(u) ? '<button type="button" class="btn danger" data-admin-delete="' + esc(u.id) + '" style="margin-left:8px;background:#b42318;color:#fff;border-color:#b42318;">Delete</button>' : '';
      const ownerNote = isOwner ? '<br><small>System owner cannot be deleted.</small>' : '';
      return '<div class="admin-item" data-admin-row="' + esc(u.id) + '">' +
        '<div><strong>' + esc(u.name || '') + '</strong><br>' + esc(u.email || '') + '<br>Role: ' + esc(role) + ownerNote + '<br>Authorities: ' + esc(authorities) + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' + editBtn + deleteBtn + '</div>' +
      '</div>';
    }).join('');
  }

  async function refreshUsers(){
    try{
      await loadUsers();
      renderUsers();
    }catch(e){
      show('Could not load admin users from backend: ' + (e.message || e), true);
    }
  }

  async function deleteUser(id){
    const user = (usersCache || []).find(u => Number(u.id) === Number(id));
    if(!user){ show('User not found. Refreshing list...', true); await refreshUsers(); return; }
    if(!canDeleteUser(user)){
      show('This user cannot be deleted. The system owner and your own active account are protected.', true);
      return;
    }
    if(!confirm('Delete admin user "' + user.email + '"? They will no longer be able to sign in.')) return;
    try{
      await api('/api/admin-users/' + encodeURIComponent(id), { method:'DELETE' });
      usersCache = usersCache.filter(u => Number(u.id) !== Number(id));
      renderUsers();
      show('Admin user deleted/disabled successfully.');
    }catch(e){
      show('Could not delete user: ' + (e.message || e), true);
    }
  }

  document.addEventListener('click', function(e){
    const del = e.target.closest('[data-admin-delete]');
    if(del){
      e.preventDefault();
      deleteUser(del.getAttribute('data-admin-delete'));
      return;
    }
    const edit = e.target.closest('[data-admin-edit]');
    if(edit){
      e.preventDefault();
      if(typeof window.editAdminPermissions === 'function') window.editAdminPermissions(edit.getAttribute('data-admin-edit'));
      else show('Edit authorities function is not loaded yet. Refresh the page and try again.', true);
    }
  });

  window.refreshAdminUsers = refreshUsers;
  window.renderAdminUsers = renderUsers;
  window.deleteAdminUser = deleteUser;

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(refreshUsers, 700);
  });
})();
