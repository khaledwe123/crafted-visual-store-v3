(function(){
  const isLoginPage = location.pathname.endsWith('admin-login.html');
  if(isLoginPage) return;

  const OWNER_EMAIL = 'admin@craftedvisual.com';
  const token = localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken');
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null'); } catch(e) { session = null; }

  if(!token || !session){
    location.href = 'admin-login.html';
    return;
  }

  if(String(session.email || '').toLowerCase() === OWNER_EMAIL){
    session.name = 'Super Admin';
    session.role = 'superadmin';
    session.permissions = {};
    sessionStorage.setItem('cvAdminSession', JSON.stringify(session));
    localStorage.setItem('cvAdminSession', JSON.stringify(session));
  }

  window.cvCurrentAdmin = function(){
    try { return JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null'); } catch(e) { return null; }
  };

  window.cvIsSuperAdmin = function(){
    const u = window.cvCurrentAdmin();
    return !!u && (String(u.role || '').toLowerCase() === 'superadmin' || String(u.email || '').toLowerCase() === OWNER_EMAIL);
  };

  window.cvNormalizePermissions = function(perms){
    const all = ['menu','pictures','products','categories','seo','discounts','orders','finance','crm','users','analytics','security','inventory','media'];
    const obj = {};
    all.forEach(p => obj[p] = {read:false, write:false});
    if(!perms) return obj;
    if(Array.isArray(perms)){
      all.forEach(p => obj[p] = {read:perms.includes(p), write:perms.includes(p)});
      return obj;
    }
    all.forEach(p => obj[p] = {read:!!perms[p]?.read, write:!!perms[p]?.write});
    return obj;
  };

  window.cvHasPermission = function(section, level='read'){
    if(window.cvIsSuperAdmin()) return true;
    const u = window.cvCurrentAdmin();
    if(!u) return false;
    const perms = window.cvNormalizePermissions(u.permissions);
    return !!perms[section]?.[level];
  };
})();
