/* Crafted Visual production API helper. Uses same-origin API calls with cookie + token fallback. */
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
        return localStorage.getItem('cvAdminApiToken') || sessionStorage.getItem('cvAdminApiToken') ||
          localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken') ||
          localStorage.getItem('token') || sessionStorage.getItem('token') || '';
      }
      return localStorage.getItem('customerToken') || sessionStorage.getItem('customerToken') ||
        localStorage.getItem('cvApiToken') || sessionStorage.getItem('cvApiToken') || '';
    },
    async request(path, options={}){
      const headers = Object.assign({}, options.headers || {});
      const isForm = options.body instanceof FormData;
      if(!isForm && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      const t = this.token(!!options.admin);
      if(t && !headers.Authorization) headers.Authorization = 'Bearer ' + t;
      let body = options.body;
      if(body !== undefined && !isForm && typeof body !== 'string') body = JSON.stringify(body);
      const res = await fetch('/api' + path.replace(/^\/api/, ''), {
        method: options.method || 'GET',
        headers,
        body,
        credentials: 'same-origin',
        cache: options.cache || 'no-store'
      });
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json().catch(()=>({})) : await res.text().catch(()=> '');
      if(!res.ok){
        const msg = (data && data.error) || (typeof data === 'string' && data) || ('HTTP ' + res.status);
        throw new Error(msg);
      }
      return data;
    },
    async adminLogin(email,password){
      const r = await this.request('/admin/login', {method:'POST', body:{email,password}});
      if(r.token){
        localStorage.setItem(this.adminTokenKey, r.token);
        sessionStorage.setItem(this.adminTokenKey, r.token);
        localStorage.setItem('adminToken', r.token);
        sessionStorage.setItem('adminToken', r.token);
        localStorage.setItem('token', r.token);
        sessionStorage.setItem('token', r.token);
      }
      if(r.user){
        const s = JSON.stringify(r.user);
        localStorage.setItem('cvAdminSession', s);
        sessionStorage.setItem('cvAdminSession', s);
      }
      return r;
    },
    currentAdmin(){ try{return JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null');}catch(e){return null;} },
    async refreshAdmin(){ const r = await this.request('/admin/me', {admin:true}); if(r.user){ const s=JSON.stringify(r.user); sessionStorage.setItem('cvAdminSession',s); localStorage.setItem('cvAdminSession',s); } return r.user; },
    async customerLogin(email,password){ const r=await this.request('/customers/login',{method:'POST',body:{email,password}}); if(r.token){localStorage.setItem(this.tokenKey,r.token); sessionStorage.setItem(this.tokenKey,r.token);} localStorage.setItem('currentUser', JSON.stringify(r.user)); return r; },
    async customerRegister(payload){ const r=await this.request('/customers/register',{method:'POST',body:payload}); if(r.token){localStorage.setItem(this.tokenKey,r.token); sessionStorage.setItem(this.tokenKey,r.token);} localStorage.setItem('currentUser', JSON.stringify(r.user)); return r; },
    async forgotPassword(email){ return this.request('/customers/forgot-password',{method:'POST',body:{email}}); },
    async logout(){
      try{ await this.request('/auth/logout',{method:'POST',body:{}}); }catch(e){}
      ['cvApiToken','customerToken','currentUser','cvAdminApiToken','adminToken','token','cvAdminSession'].forEach(k=>{try{localStorage.removeItem(k);sessionStorage.removeItem(k);}catch(e){}});
    },
    async createOrderFromPrototype(order){
      const items = (order.items||[]).map(i=>({id:i.id, product_id:i.product_id, productId:i.productId, sku:i.sku, name:i.name, size:i.size, fabric:i.fabric, color:i.color, qty:i.qty||1, discountPercent:i.discountPercent||0, data:i}));
      const discountCode = order.discountCode && order.discountCode.code ? order.discountCode.code : '';
      return this.request('/orders',{method:'POST',body:{customer:order.customer,items,city:order.city,address:order.address,notes:order.notes,discount_code:discountCode}});
    }
  };
  window.CV_API = CV_API;
})();
