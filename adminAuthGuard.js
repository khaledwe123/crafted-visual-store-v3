(function(){
  const isLoginPage = location.pathname.endsWith('admin-login.html');
  if(isLoginPage) return;

  const OWNER_EMAIL = 'admin@craftedvisual.com';
  const TOKEN_KEYS = ['cvAdminApiToken','adminToken'];
  const SESSION_KEYS = ['cvAdminSession','adminSession'];

  function getStored(key){
    return localStorage.getItem(key) || sessionStorage.getItem(key) || '';
  }

  function setStored(key, value){
    try { localStorage.setItem(key, value); } catch(e) {}
    try { sessionStorage.setItem(key, value); } catch(e) {}
  }

  function removeStored(key){
    try { localStorage.removeItem(key); } catch(e) {}
    try { sessionStorage.removeItem(key); } catch(e) {}
  }

  function token(){
    for(const key of TOKEN_KEYS){
      const value = getStored(key);
      if(value) return value;
    }
    return '';
  }

  function session(){
    for(const key of SESSION_KEYS){
      const raw = getStored(key);
      if(raw){
        try { return JSON.parse(raw); } catch(e) {}
      }
    }
    return null;
  }

  function clearAdminSession(){
    TOKEN_KEYS.forEach(removeStored);
    SESSION_KEYS.forEach(removeStored);
  }

  function redirectLogin(){
    clearAdminSession();
    location.href = 'admin-login.html';
  }

  const currentToken = token();
  if(!currentToken){
    redirectLogin();
    return;
  }

  window.cvCurrentAdmin = function(){ return session(); };

  window.cvIsSuperAdmin = function(){
    const u = window.cvCurrentAdmin();
    return !!u && (String(u.role || '').toLowerCase() === 'superadmin' || String(u.email || '').toLowerCase() === OWNER_EMAIL);
  };

  window.cvNormalizePermissions = function(perms){
    const all = ['menu','pictures','products','categories','seo','discounts','orders','finance','crm','users','analytics','security','inventory','media','settings'];
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

  // Validate the browser token against the live backend after every deployment.
  // This prevents the admin page from showing an old localStorage session while API
  // calls fail with "Unauthorized" because the JWT was rotated or the server restarted.
  fetch('/api/admin/me', { headers:{ Authorization:'Bearer ' + currentToken } })
    .then(async res => {
      if(res.status === 401 || res.status === 403){
        redirectLogin();
        return null;
      }
      if(!res.ok) return null;
      return res.json().catch(()=>null);
    })
    .then(user => {
      if(!user) return;
      if(String(user.email || '').toLowerCase() === OWNER_EMAIL){
        user.name = 'Super Admin';
        user.role = 'superadmin';
        user.isSuperAdmin = true;
      }
      setStored('cvAdminSession', JSON.stringify(user));
    })
    .catch(() => {
      // Network/API outage: keep existing UI session so the page can still render,
      // but secured API calls will still be protected by the backend.
    });
})();
