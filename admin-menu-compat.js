(function(){
  'use strict';

  function readStoredMenu(){
    try{
      var raw = localStorage.getItem('cms_menu') || sessionStorage.getItem('cms_menu') || '[]';
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }catch(e){
      console.warn('Stored menu read failed', e);
      return [];
    }
  }

  window.getMenuItems = window.getMenuItems || function(){
    try{
      if(typeof menu !== 'undefined' && Array.isArray(menu)) return menu;
    }catch(e){}
    try{
      if(Array.isArray(window.menu)) return window.menu;
    }catch(e){}
    return readStoredMenu();
  };

  window.setMenuItems = window.setMenuItems || function(items){
    if(!Array.isArray(items)) items = [];
    try{
      if(typeof menu !== 'undefined') menu = items;
    }catch(e){}
    try{ window.menu = items; }catch(e){}
    try{ localStorage.setItem('cms_menu', JSON.stringify(items)); }catch(e){}
    try{ sessionStorage.setItem('cms_menu', JSON.stringify(items)); }catch(e){}
    try{ if(typeof renderMenu === 'function') renderMenu(); }catch(e){}
    try{ if(typeof window.renderMenu === 'function') window.renderMenu(); }catch(e){}
    return items;
  };

  window.addMenuItemCompat = window.addMenuItemCompat || function(item){
    var list = window.getMenuItems();
    list.push(item);
    return window.setMenuItems(list);
  };
})();
