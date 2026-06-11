(function(){
  'use strict';

  function getToken(){
    return localStorage.getItem('cvAdminApiToken') ||
           sessionStorage.getItem('cvAdminApiToken') ||
           localStorage.getItem('adminToken') ||
           sessionStorage.getItem('adminToken') ||
           localStorage.getItem('token') ||
           sessionStorage.getItem('token') || '';
  }

  function setStatus(message, isError){
    if (typeof window.showAdminStatus === 'function') {
      window.showAdminStatus(message, !!isError);
      return;
    }
    var box = document.getElementById('adminSaveStatus');
    if (box) {
      box.textContent = message;
      box.className = 'admin-save-status ' + (isError ? 'error' : 'success');
    } else {
      (isError ? console.error : console.log)(message);
    }
  }

  function fullPermissions(){
    var keys = ['menu','pictures','products','categories','seo','discounts','orders','finance','crm','users','analytics','security','inventory','media','settings'];
    var out = {};
    keys.forEach(function(k){ out[k] = {read:true, write:true}; });
    return out;
  }

  function collectPermissions(){
    var out = {};
    document.querySelectorAll('#newAdminPermissionsMatrix input[type="checkbox"]').forEach(function(cb){
      var perm = cb.dataset.perm;
      var level = cb.dataset.level;
      if (!perm || !level) return;
      if (!out[perm]) out[perm] = {read:false, write:false};
      out[perm][level] = !!cb.checked;
    });
    return out;
  }

  async function adminRequest(path, options){
    options = options || {};
    var token = getToken();
    if (!token) throw new Error('Missing admin token. Please logout, login again, and retry.');
    var headers = Object.assign({}, options.headers || {}, { Authorization: 'Bearer ' + token });
    var body = options.body;
    if (!(body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      if (body !== undefined && typeof body !== 'string') body = JSON.stringify(body);
    }
    var res = await fetch(path, {
      method: options.method || 'GET',
      headers: headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: body
    });
    var text = await res.text();
    var data = null;
    try { data = text ? JSON.parse(text) : {}; } catch(e) { data = text; }
    if (!res.ok) {
      var msg = (data && data.error) ? data.error : (typeof data === 'string' && data ? data : 'HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }

  async function reloadUsers(){
    try {
      var users = await adminRequest('/api/admin-users');
      if (Array.isArray(users)) {
        window.cvAdminUsersCache = users;
        try { cvAdminUsersCache = users; } catch(e) {}
      }
      if (typeof window.renderAdminUsers === 'function') window.renderAdminUsers();
      if (typeof window.refreshAdminUsers === 'function') await window.refreshAdminUsers();
    } catch(e) {
      console.warn('Admin users reload skipped:', e.message || e);
    }
  }

  window.addAdminUser = async function addAdminUserLiveFinal(){
    var nameEl = document.getElementById('newAdminName');
    var emailEl = document.getElementById('newAdminEmail');
    var passwordEl = document.getElementById('newAdminPassword');
    var roleEl = document.getElementById('newAdminRole');
    var name = (nameEl && nameEl.value || '').trim();
    var email = (emailEl && emailEl.value || '').trim().toLowerCase();
    var password = (passwordEl && passwordEl.value || '');
    var role = String(roleEl && roleEl.value || 'admin').toLowerCase() === 'superadmin' ? 'superadmin' : 'admin';

    if (!name || !email || !password) {
      setStatus('Name, email and password are required.', true);
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStatus('Please enter a valid email address.', true);
      return;
    }
    if (password.length < 8) {
      setStatus('Password must be at least 8 characters.', true);
      return;
    }

    try {
      var permissions = role === 'superadmin' ? fullPermissions() : collectPermissions();
      await adminRequest('/api/admin-users', {
        method: 'POST',
        body: { name:name, email:email, password:password, role:role, permissions:permissions, active:true }
      });
      if (nameEl) nameEl.value = '';
      if (emailEl) emailEl.value = '';
      if (passwordEl) passwordEl.value = '';
      setStatus((role === 'superadmin' ? 'Super Admin' : 'Admin') + ' user created successfully.');
      await reloadUsers();
    } catch(e) {
      setStatus('Could not create user: ' + (e.message || e), true);
      console.error('Create admin user failed:', e);
    }
  };

  window.cvCreateAdminUserLiveFinal = window.addAdminUser;

  window.adminLogout = function(){
    ['cvAdminApiToken','adminToken','token','cvAdminSession','cvApiToken','customerToken','currentUser'].forEach(function(k){
      try { localStorage.removeItem(k); } catch(e) {}
      try { sessionStorage.removeItem(k); } catch(e) {}
    });
    window.location.href = '/admin-login.html';
  };

  document.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('logoutBtn') || document.querySelector('[data-admin-logout]');
    if (btn) btn.addEventListener('click', function(e){ e.preventDefault(); window.adminLogout(); });
  });
})();
