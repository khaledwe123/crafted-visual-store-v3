(function(){
  'use strict';
  // Compatibility layer for older admin workflow patches.
  // Loaded before admin-workflow-fix-v34.js so menu enhancement functions never crash.
  window.getMenuItems = window.getMenuItems || function(){
    try{ if(Array.isArray(window.menu)) return window.menu; }catch(e){}
    try{ if(typeof menu !== 'undefined' && Array.isArray(menu)) return menu; }catch(e){}
    try{
      var raw = localStorage.getItem('cms_menu') || sessionStorage.getItem('cms_menu') || '[]';
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }catch(e){
      console.warn('getMenuItems fallback failed', e);
      return [];
    }
  };
  window.setMenuItems = window.setMenuItems || function(items){
    if(!Array.isArray(items)) items = [];
    try{ window.menu = items; }catch(e){}
    try{ if(typeof menu !== 'undefined') menu = items; }catch(e){}
    try{ localStorage.setItem('cms_menu', JSON.stringify(items)); }catch(e){}
    try{ sessionStorage.setItem('cms_menu', JSON.stringify(items)); }catch(e){}
    try{ if(typeof window.renderMenu === 'function') window.renderMenu(); }catch(e){}
    return items;
  };
  window.cvAdminLogout = window.cvAdminLogout || function(){
    [localStorage, sessionStorage].forEach(function(store){
      try{
        ['cvAdminApiToken','adminToken','token','authToken','cvAdminSession','adminSession'].forEach(function(k){ store.removeItem(k); });
      }catch(e){}
    });
    window.location.href = '/admin-login.html';
  };
  document.addEventListener('DOMContentLoaded', function(){
    var selectors = ['#logoutBtn','#adminLogoutBtn','[data-admin-logout]','.admin-logout'];
    selectors.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(btn){
        if(btn.dataset.cvLogoutBound === '1') return;
        btn.dataset.cvLogoutBound = '1';
        btn.addEventListener('click', function(ev){ ev.preventDefault(); window.cvAdminLogout(); });
      });
    });
  });
})();
