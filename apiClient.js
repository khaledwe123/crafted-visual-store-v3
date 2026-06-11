var CV_API;
/* Crafted Visual production API helper. Keeps legacy token keys for the existing admin UI while using secure server-side authorization checks. */
(function(){
  'use strict';

  const ADMIN_TOKEN_KEYS = ['cvAdminApiToken','adminToken','token','authToken'];
  const ADMIN_SESSION_KEYS = ['cvAdminSession','adminSession'];
  const CUSTOMER_TOKEN_KEYS = ['customerToken','cvApiToken'];

  function firstStored(keys){
    for (const key of keys) {
      try {
        const v = sessionStorage.getItem(key) || localStorage.getItem(key);
        if (v) return v;
      } catch (_) {}
    }
    return '';
  }

  function setBoth(key, value){
    try { sessionStorage.setItem(key, value); } catch (_) {}
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function removeBoth(key){
    try { sessionStorage.removeItem(key); } catch (_) {}
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function normalizeApiPath(path){
    const raw = String(path || '').trim();
    if (!raw) return '/api/health';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/api/')) return raw;
    if (raw === '/api') return raw;
    return '/api/' + raw.replace(/^\/+/, '');
  }

  async function parseResponse(res){
    const text = await res.text().catch(() => '');
    if (!text) return {};
    try { return JSON.parse(text); } catch (_) { return { raw: text }; }
  }

  const API = {
    tokenKey: 'cvApiToken',
    adminTokenKey: 'cvAdminApiToken',

    async available(){
      try {
        const r = await fetch('/api/health', { credentials:'same-origin', cache:'no-store' });
        return r.ok;
      } catch (_) {
        return false;
      }
    },

    token(admin=false){
      return admin ? firstStored(ADMIN_TOKEN_KEYS) : firstStored(CUSTOMER_TOKEN_KEYS);
    },

    currentAdmin(){
      for (const key of ADMIN_SESSION_KEYS) {
        try {
          const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
          if (raw) return JSON.parse(raw);
        } catch (_) {}
      }
      return null;
    },

    async request(path, options={}){
      const admin = !!options.admin;
      const url = normalizeApiPath(path);
      const headers = Object.assign({}, options.headers || {});
      const isFormData = options.body instanceof FormData;

      if (!isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

      const token = admin ? this.token(true) : this.token(false);
      if (token && !headers.Authorization) headers.Authorization = 'Bearer ' + token;

      let body = options.body;
      if (body !== undefined && !isFormData && typeof body !== 'string') body = JSON.stringify(body);

      const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body,
        credentials: 'same-origin',
        cache: options.cache || 'no-store'
      });

      const data = await parseResponse(res);
      if (!res.ok) {
        const msg = data.error || data.message || data.raw || ('HTTP ' + res.status);
        const err = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    },

    async adminLogin(email,password){
      const r = await this.request('/admin/login', { method:'POST', body:{ email, password } });
      if (r.token) ADMIN_TOKEN_KEYS.forEach(k => setBoth(k, r.token));
      if (r.user) ADMIN_SESSION_KEYS.forEach(k => setBoth(k, JSON.stringify(r.user)));
      return r;
    },

    async refreshAdmin(){
      const r = await this.request('/admin/me', { admin:true });
      if (r.user) ADMIN_SESSION_KEYS.forEach(k => setBoth(k, JSON.stringify(r.user)));
      return r.user;
    },

    async customerLogin(email,password){
      const r = await this.request('/customers/login', { method:'POST', body:{ email, password } });
      if (r.token) CUSTOMER_TOKEN_KEYS.forEach(k => setBoth(k, r.token));
      if (r.user) setBoth('currentUser', JSON.stringify(r.user));
      return r;
    },

    async customerRegister(payload){
      const r = await this.request('/customers/register', { method:'POST', body:payload });
      if (r.token) CUSTOMER_TOKEN_KEYS.forEach(k => setBoth(k, r.token));
      if (r.user) setBoth('currentUser', JSON.stringify(r.user));
      return r;
    },

    async forgotPassword(email){
      return this.request('/customers/forgot-password', { method:'POST', body:{ email } });
    },

    async logout(){
      try { await this.request('/auth/logout', { method:'POST', body:{} }); } catch (_) {}
      ADMIN_TOKEN_KEYS.concat(ADMIN_SESSION_KEYS, CUSTOMER_TOKEN_KEYS, ['currentUser']).forEach(removeBoth);
    },

    async createOrderFromPrototype(order){
      const items = (order.items || []).map(i => ({
        id:i.id, product_id:i.product_id, productId:i.productId, sku:i.sku, name:i.name,
        size:i.size, fabric:i.fabric, color:i.color, qty:i.qty || 1,
        discountPercent:i.discountPercent || 0, data:i
      }));
      const discountCode = order.discountCode && order.discountCode.code ? order.discountCode.code : '';
      return this.request('/orders', {
        method:'POST',
        body:{
          customer:order.customer, items, city:order.city, address:order.address,
          notes:order.notes, discount_code:discountCode
        }
      });
    }
  };

  window.CV_API = API;
  try { CV_API = API; } catch (_) {}
  try { if (typeof globalThis !== 'undefined') globalThis.CV_API = API; } catch (_) {}
})();
