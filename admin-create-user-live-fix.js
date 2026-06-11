/* Crafted Visual: final live backend admin/superadmin creation fix */
(function(){
  'use strict';

  const OWNER_EMAIL = 'admin@craftedvisual.com';
  const MODULES = ['menu','pictures','products','categories','seo','discounts','orders','finance','crm','users','analytics','security','inventory','media','settings'];

  function getToken(){
    return localStorage.getItem('cvAdminApiToken') ||
      sessionStorage.getItem('cvAdminApiToken') ||
      localStorage.getItem('adminToken') ||
      sessionStorage.getItem('adminToken') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') || '';
  }

  function getSession(){
    try { return JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null'); }
    catch(e){ return null; }
  }

  function fullPermissions(){
    const out = {};
    MODULES.forEach(k => out[k] = {read:true, write:true});
    return out;
  }

  function isSuperAdmin(){
    const u = getSession();
    return !!u && (String(u.role || '').toLowerCase() === 'superadmin' || String(u.email || '').toLowerCase() === OWNER_EMAIL);
  }

  function status(message, isError){
    if(typeof window.showAdminStatus === 'function') window.showAdminStatus(message, !!isError);
    else alert(message);
  }

  function collectPermissions(){
    const role = String(document.getElementById('newAdminRole')?.value || 'admin').toLowerCase();
    if(role === 'superadmin') return fullPermissions();

    if(typeof window.collectPermissionMatrix === 'function'){
      try { return window.collectPermissionMatrix(); } catch(e){}
    }

    const permissions = {};
    MODULES.forEach(k => permissions[k] = {read:false, write:false});

    document.querySelectorAll('#newAdminPermissionsMatrix input[type="checkbox"]').forEach(cb => {
      const perm = cb.dataset.perm || cb.dataset.section || cb.name || '';
      const level = cb.dataset.level || cb.dataset.action || (String(cb.name || '').toLowerCase().includes('write') ? 'write' : 'read');
      if(!perm) return;
      if(!permissions[perm]) permissions[perm] = {read:false, write:false};
      if(level === 'write' || level === 'edit') permissions[perm].write = !!cb.checked;
      else permissions[perm].read = !!cb.checked;
    });

    return permissions;
  }

  async function api(path, options){
    const token = getToken();
    if(!token) throw new Error('Missing admin token. Please logout and login again.');

    const body = options && options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const res = await fetch('/api' + path.replace(/^\/api/, ''), {
      method: (options && options.method) || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      credentials: 'same-origin',
      cache: 'no-store',
      body
    });

    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch(e){ data = {raw:text}; }
    if(!res.ok) throw new Error(data.error || data.raw || ('HTTP ' + res.status));
    return data;
  }

  async function refreshUsers(){
    try{
      const users = await api('/admin-users');
      window.cvAdminUsersCache = Array.isArray(users) ? users : [];
      if(typeof window.renderAdminUsers === 'function') window.renderAdminUsers();
      else if(typeof renderAdminUsers === 'function') renderAdminUsers();
    }catch(e){
      console.warn('Could not refresh admin users', e);
    }
  }

  window.addAdminUser = async function(){
    if(!isSuperAdmin()){
      status('Only Super Admin can create admin users.', true);
      return;
    }

    const name = (document.getElementById('newAdminName')?.value || '').trim();
    const email = (document.getElementById('newAdminEmail')?.value || '').trim().toLowerCase();
    const password = document.getElementById('newAdminPassword')?.value || '';
    const role = String(document.getElementById('newAdminRole')?.value || 'admin').toLowerCase() === 'superadmin' ? 'superadmin' : 'admin';

    if(!name || !email || !password){
      status('Name, email and password are required.', true);
      return;
    }
    if(password.length < 8){
      status('Password must be at least 8 characters.', true);
      return;
    }

    try{
      await api('/admin-users', {
        method:'POST',
        body:{
          name,
          email,
          password,
          role,
          permissions: role === 'superadmin' ? fullPermissions() : collectPermissions(),
          active:true
        }
      });

      ['newAdminName','newAdminEmail','newAdminPassword'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
      });

      await refreshUsers();
      status((role === 'superadmin' ? 'Super Admin' : 'Admin') + ' created successfully.');
    }catch(e){
      console.error('Final admin create user fix failed', e);
      status('Could not create user: ' + (e.message || e), true);
    }
  };

  function bindCreateButton(){
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => /create user/i.test((b.textContent || '').trim()));
    if(btn && !btn.dataset.cvCreateUserFixBound){
      btn.dataset.cvCreateUserFixBound = '1';
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        window.addAdminUser();
      }, true);
    }
  }

  document.addEventListener('DOMContentLoaded', bindCreateButton);
  setTimeout(bindCreateButton, 600);
  setTimeout(bindCreateButton, 1800);
})();
