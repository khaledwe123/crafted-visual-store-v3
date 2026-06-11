/* Crafted Visual production API helper. Uses HttpOnly cookies for online auth; sessionStorage keeps only non-sensitive user display data. */
const CV_API = {
  tokenKey: 'cvApiToken',
  adminTokenKey: 'cvAdminApiToken',
  async available(){ try{ const r=await fetch('/api/health',{credentials:'same-origin'}); return r.ok; }catch(e){ return false; } },
  token(admin=false){ return sessionStorage.getItem(admin ? this.adminTokenKey : this.tokenKey) || ''; },
  async request(path, options={}){
    const admin = options.admin === true;
    const headers = Object.assign({'Content-Type':'application/json'}, options.headers || {});
    const t = this.token(admin); if(t) headers.Authorization = 'Bearer ' + t; // local dev fallback only
    const res = await fetch('/api' + path, Object.assign({}, options, {credentials:'same-origin', headers, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body}));
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || 'API request failed');
    return data;
  },
  async adminLogin(email,password){
    const r=await this.request('/admin/login',{method:'POST',body:{email,password}});
    sessionStorage.removeItem(this.adminTokenKey); localStorage.removeItem(this.adminTokenKey);
    if(r.token) sessionStorage.setItem(this.adminTokenKey,r.token);
    sessionStorage.setItem('cvAdminSession', JSON.stringify(r.user));
    localStorage.removeItem('cvAdminSession');
    return r;
  },
  currentAdmin(){ try{return JSON.parse(sessionStorage.getItem('cvAdminSession') || 'null');}catch(e){return null;} },
  async refreshAdmin(){ const r=await this.request('/admin/me',{admin:true}); sessionStorage.setItem('cvAdminSession', JSON.stringify(r.user)); return r.user; },
  async customerLogin(email,password){
    const r=await this.request('/customers/login',{method:'POST',body:{email,password}});
    sessionStorage.removeItem(this.tokenKey); localStorage.removeItem(this.tokenKey);
    if(r.token) sessionStorage.setItem(this.tokenKey,r.token);
    localStorage.setItem('currentUser', JSON.stringify(r.user));
    return r;
  },
  async customerRegister(payload){
    const r=await this.request('/customers/register',{method:'POST',body:payload});
    sessionStorage.removeItem(this.tokenKey); localStorage.removeItem(this.tokenKey);
    if(r.token) sessionStorage.setItem(this.tokenKey,r.token);
    localStorage.setItem('currentUser', JSON.stringify(r.user));
    return r;
  },
  async forgotPassword(email){ return this.request('/customers/forgot-password',{method:'POST',body:{email}}); },
  async logout(){ try{ await this.request('/auth/logout',{method:'POST',body:{}}); }catch(e){} sessionStorage.removeItem(this.tokenKey); sessionStorage.removeItem(this.adminTokenKey); sessionStorage.removeItem('cvAdminSession'); localStorage.removeItem(this.tokenKey); localStorage.removeItem(this.adminTokenKey); localStorage.removeItem('cvAdminSession'); localStorage.removeItem('currentUser'); },
  async createOrderFromPrototype(order){
    const items = (order.items||[]).map(i=>({id:i.id, product_id:i.product_id, productId:i.productId, sku:i.sku, name:i.name, size:i.size, fabric:i.fabric, color:i.color, qty:i.qty||1, discountPercent:i.discountPercent||0, data:i}));
    const discountCode = order.discountCode && order.discountCode.code ? order.discountCode.code : '';
    return this.request('/orders',{method:'POST',body:{customer:order.customer,items,city:order.city,address:order.address,notes:order.notes,discount_code:discountCode}});
  }
};
