/* Crafted Visual production API helper. */
(function(){
  'use strict';
  const CV_API = {
    tokenKey: 'cvApiToken',
    adminTokenKey: 'cvAdminApiToken',
    async available(){
      try{ const r = await fetch('/api/health', {credentials:'same-origin', cache:'no-store'}); return r.ok; }
      catch(e){ return false; }
    },
    token(admin=false){
      if(admin){
        return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') || '';
      }
      return localStorage.getItem('cvApiToken') || sessionStorage.getItem('cvApiToken') ||
             localStorage.getItem('customerToken') || sessionStorage.getItem('customerToken') || '';
    },
    async request(path, options={}){
      const admin = !!options.admin;
      let url = String(path || '');
      if(!url.startsWith('/api/')) url = '/api/' + url.replace(/^\/+/, '').replace(/^api\//, '');
      const headers = Object.assign({}, options.headers || {});
      const t = this.token(admin);
      // Do not send the non-secret cookie marker as a Bearer token. The server will read
      // the HttpOnly cookie through credentials:'same-origin'.
      if(t && t !== 'cookie-auth' && t !== 'cv-cookie-auth') headers.Authorization = 'Bearer ' + t;
      let body = options.body;
      if(body !== undefined && !(body instanceof FormData)){
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        if(typeof body !== 'string') body = JSON.stringify(body);
      }
      const res = await fetch(url, {
        method: options.method || (body !== undefined ? 'POST' : 'GET'),
        credentials: 'same-origin',
        cache: options.cache || 'no-store',
        headers,
        body
      });
      const text = await res.text();
      let data = null;
      try{ data = text ? JSON.parse(text) : {}; }catch(e){ data = text; }
      if(!res.ok){
        const msg = data && data.error ? data.error : (typeof data === 'string' && data ? data : ('HTTP ' + res.status));
        if(admin && (res.status === 401 || res.status === 403)){
          ['cvAdminApiToken','adminToken','token','authToken','cvAdminSession','adminSession'].forEach(k=>{
            try{ localStorage.removeItem(k); sessionStorage.removeItem(k); }catch(_e){}
          });
          if(!location.pathname.endsWith('/admin-login.html')) setTimeout(()=>{ location.href='/admin-login.html'; }, 50);
        }
        throw new Error(msg);
      }
      return data;
    },
    async adminLogin(email,password){
      const r = await this.request('/admin/login', {method:'POST', body:{email,password}});
      try{ localStorage.setItem('cvAdminApiToken','cookie-auth'); sessionStorage.setItem('cvAdminApiToken','cookie-auth'); }catch(e){}
      if(r.user){
        try{ localStorage.setItem('cvAdminSession', JSON.stringify(r.user)); sessionStorage.setItem('cvAdminSession', JSON.stringify(r.user)); }catch(e){}
      }
      return r;
    },
    currentAdmin(){
      try{return JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null');}
      catch(e){return null;}
    },
    async refreshAdmin(){
      const r = await this.request('/admin/me', {admin:true});
      const user = r.user || r;
      if(user){
        try{ localStorage.setItem('cvAdminSession', JSON.stringify(user)); sessionStorage.setItem('cvAdminSession', JSON.stringify(user)); }catch(e){}
      }
      return user;
    },
    async customerLogin(email,password){
      const r = await this.request('/customers/login', {method:'POST', body:{email,password}});
      try{ localStorage.setItem(this.tokenKey,'cookie-auth'); sessionStorage.setItem(this.tokenKey,'cookie-auth'); }catch(e){}
      if(r.user){ try{ localStorage.setItem('currentUser', JSON.stringify(r.user)); }catch(e){} }
      return r;
    },
    async customerRegister(payload){
      const r = await this.request('/customers/register', {method:'POST', body:payload});
      try{ localStorage.setItem(this.tokenKey,'cookie-auth'); sessionStorage.setItem(this.tokenKey,'cookie-auth'); }catch(e){}
      if(r.user){ try{ localStorage.setItem('currentUser', JSON.stringify(r.user)); }catch(e){} }
      return r;
    },
    async forgotPassword(email){ return this.request('/customers/forgot-password', {method:'POST', body:{email}}); },
    async logout(){
      try{ await this.request('/auth/logout', {method:'POST', body:{}}); }catch(e){}
      ['cvApiToken','customerToken','currentUser','cvAdminApiToken','adminToken','token','cvAdminSession'].forEach(k=>{
        try{ localStorage.removeItem(k); sessionStorage.removeItem(k); }catch(e){}
      });
    },
    async createOrderFromPrototype(order){
      const items = (order.items||[]).map(i=>({id:i.id, product_id:i.product_id, productId:i.productId, sku:i.sku, name:i.name, size:i.size, fabric:i.fabric, color:i.color, qty:i.qty||1, data:i}));
      const discountCode = order.discountCode && order.discountCode.code ? order.discountCode.code : '';
      return this.request('/orders', {method:'POST', body:{customer:order.customer, items, city:order.city, address:order.address, notes:order.notes, discount_code:discountCode}});
    }
  };
  window.CV_API = CV_API;
})();
