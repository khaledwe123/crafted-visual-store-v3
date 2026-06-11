/* Crafted Visual real backend API helper. Existing localStorage prototype remains as offline fallback. */
const CV_API = {
  tokenKey: 'cvApiToken',
  adminTokenKey: 'cvAdminApiToken',
  async available(){ try{ const r=await fetch('/api/health'); return r.ok; }catch(e){ return false; } },
  token(admin=false){ return localStorage.getItem(admin ? this.adminTokenKey : this.tokenKey) || sessionStorage.getItem(admin ? this.adminTokenKey : this.tokenKey) || ''; },
  async request(path, options={}){
    const admin = options.admin === true;
    const headers = Object.assign({'Content-Type':'application/json'}, options.headers || {});
    const t = this.token(admin); if(t) headers.Authorization = 'Bearer ' + t;
    const res = await fetch('/api' + path, Object.assign({}, options, {headers, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body}));
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || 'API request failed');
    return data;
  },
  async adminLogin(email,password){ const r=await this.request('/admin/login',{method:'POST',body:{email,password}}); localStorage.setItem(this.adminTokenKey,r.token); sessionStorage.setItem(this.adminTokenKey,r.token); localStorage.setItem('cvAdminSession', JSON.stringify(r.user)); sessionStorage.setItem('cvAdminSession', JSON.stringify(r.user)); return r; },
  currentAdmin(){ try{return JSON.parse(sessionStorage.getItem('cvAdminSession') || localStorage.getItem('cvAdminSession') || 'null');}catch(e){return null;} },
  async customerLogin(email,password){ const r=await this.request('/customers/login',{method:'POST',body:{email,password}}); localStorage.setItem(this.tokenKey,r.token); localStorage.setItem('currentUser', JSON.stringify(r.user)); return r; },
  async customerRegister(payload){ const r=await this.request('/customers/register',{method:'POST',body:payload}); localStorage.setItem(this.tokenKey,r.token); localStorage.setItem('currentUser', JSON.stringify(r.user)); return r; },
  async createOrderFromPrototype(order){
    const items = (order.items||[]).map(i=>({id:i.id, product_id:i.product_id, productId:i.productId, sku:i.sku, name:i.name, size:i.size, fabric:i.fabric, color:i.color, qty:i.qty||1, discountPercent:i.discountPercent||0, data:i}));
    const discountCode = order.discountCode && order.discountCode.code ? order.discountCode.code : '';
    return this.request('/orders',{method:'POST',body:{customer:order.customer,items,city:order.city,address:order.address,notes:order.notes,delivery_before_vat:order.deliveryBeforeVat||0,discount_code:discountCode}});
  }
};
