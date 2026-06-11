(function(){
  const isLoginPage = location.pathname.endsWith('admin-login.html');
  if(isLoginPage) return;
  const OWNER_EMAIL = 'admin@craftedvisual.com';

  function adminToken(){
    return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken') || localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }
  window.cvAdminToken = adminToken;
  function normalizeOwner(session){
    if(session && String(session.email || '').toLowerCase() === OWNER_EMAIL){
      session.name = session.name || 'Super Admin';
      session.role = 'superadmin';
      session.permissions = session.permissions || {};
    }
    return session;
  }
  function setSession(session){
    session = normalizeOwner(session);
    try{ sessionStorage.setItem('cvAdminSession', JSON.stringify(session)); }catch(e){}
    try{ localStorage.setItem('cvAdminSession', JSON.stringify(session)); }catch(e){}
  }
  function getSession(){
    try { return normalizeOwner(JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null')); } catch(e) { return null; }
  }

  window.cvCurrentAdmin = getSession;
  window.cvIsSuperAdmin = function(){
    const u = window.cvCurrentAdmin();
    return !!u && (String(u.role || '').toLowerCase() === 'superadmin' || String(u.email || '').toLowerCase() === OWNER_EMAIL);
  };
  window.cvNormalizePermissions = function(perms){
    const all = ['menu','pictures','products','categories','seo','discounts','orders','finance','crm','users','analytics','security','inventory','media','settings'];
    const obj = {}; all.forEach(p => obj[p] = {read:false, write:false});
    if(!perms) return obj;
    if(Array.isArray(perms)){ all.forEach(p => obj[p] = {read:perms.includes(p), write:perms.includes(p)}); return obj; }
    all.forEach(p => obj[p] = {read:!!perms[p]?.read, write:!!perms[p]?.write});
    return obj;
  };
  window.cvHasPermission = function(section, level='read'){
    if(window.cvIsSuperAdmin()) return true;
    const u = window.cvCurrentAdmin(); if(!u) return false;
    const perms = window.cvNormalizePermissions(u.permissions);
    return !!perms[section]?.[level];
  };

  async function verify(){
    const session = getSession();
    if(session){ setSession(session); return; }
    const t = adminToken();
    try{
      const headers = t ? {Authorization:'Bearer '+t} : {};
      const res = await fetch('/api/admin/me', {credentials:'same-origin', headers});
      if(!res.ok) throw new Error('not authenticated');
      const data = await res.json();
      setSession(data.user || data);
    }catch(e){ location.href = 'admin-login.html'; }
  }
  verify();
})();
