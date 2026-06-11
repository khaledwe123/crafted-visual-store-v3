(function(){
  'use strict';
  let rows = [];
  function esc(x){ return String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function status(msg, err){ const el=document.getElementById('auditStatus'); if(el){ el.textContent=msg; el.className='admin-save-status '+(err?'error':'success'); } }
  function render(){
    const q = String(document.getElementById('auditSearch')?.value || '').toLowerCase();
    const list = rows.filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
    const body = document.getElementById('auditRows');
    if(!body) return;
    if(!list.length){ body.innerHTML = '<tr><td colspan="7">No audit logs found.</td></tr>'; return; }
    body.innerHTML = list.map(r => `<tr><td>${esc(r.created_at)}</td><td>${esc(r.admin_id||'')}</td><td><span class="audit-pill">${esc(r.action)}</span></td><td>${esc(r.entity_type||'')}</td><td>${esc(r.entity_id||'')}</td><td>${esc(r.ip_hash||'')}</td><td><div class="audit-meta">${esc(JSON.stringify(r.metadata||{}, null, 2))}</div></td></tr>`).join('');
  }
  async function load(){
    try{
      const api = window.CV_API;
      rows = api && api.request ? await api.request('/audit-logs', {admin:true}) : await fetch('/api/audit-logs', {credentials:'same-origin'}).then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });
      status('Audit logs loaded.');
      render();
    }catch(e){ console.error(e); status('Could not load audit logs: '+e.message, true); }
  }
  document.addEventListener('DOMContentLoaded', function(){
    document.getElementById('auditRefresh')?.addEventListener('click', load);
    document.getElementById('auditSearch')?.addEventListener('input', render);
    load();
  });
})();
