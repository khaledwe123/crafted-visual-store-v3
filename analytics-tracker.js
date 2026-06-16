(function(){
  const SESSION_KEY='cv_session_id';
  const ATTR_KEY='cv_attribution';
  function uuid(){return 'cv-'+Date.now()+'-'+Math.random().toString(16).slice(2);}
  function getSession(){let id=localStorage.getItem(SESSION_KEY); if(!id){id=uuid(); localStorage.setItem(SESSION_KEY,id);} return id;}
  function params(){return new URLSearchParams(location.search);}
  function attribution(){
    const p=params();
    const existing=JSON.parse(localStorage.getItem(ATTR_KEY)||'{}');
    const next={
      source:p.get('utm_source')||existing.source||'',
      medium:p.get('utm_medium')||existing.medium||'',
      campaign:p.get('utm_campaign')||existing.campaign||'',
      term:p.get('utm_term')||existing.term||'',
      content:p.get('utm_content')||existing.content||'',
      first_landing:existing.first_landing||location.href,
      last_landing:location.href,
      referrer:document.referrer||existing.referrer||''
    };
    localStorage.setItem(ATTR_KEY,JSON.stringify(next));
    return next;
  }
  const attr=attribution();
  const sid=getSession();
  function send(eventType, metadata){
    const body=Object.assign({
      session_id:sid,
      event_type:eventType,
      page_url:location.pathname+location.search,
      page_title:document.title,
      referrer:document.referrer,
      source:attr.source,
      medium:attr.medium,
      campaign:attr.campaign,
      term:attr.term,
      content:attr.content,
      metadata:metadata||{}
    }, metadata&&metadata.product_id?{product_id:metadata.product_id, product_name:metadata.product_name||''}:{});
    try{
      var token = (document.cookie.split('; ').find(function(v){ return v.indexOf('cv_csrf_token=') === 0; }) || '').split('=').slice(1).join('=');
      fetch('/api/journey', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type':'application/json', 'X-CSRF-Token': decodeURIComponent(token || '')},
        body: JSON.stringify(body),
        keepalive: true
      }).catch(function(){});
    } catch(e){}
  }
  window.CVTrack={event:send, sessionId:sid, attribution:attr};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init(){
    send('page_view',{language:document.documentElement.lang||'', path:location.pathname});
    const productParam=new URLSearchParams(location.search).get('product');
    if(productParam) send('product_view',{product_id:productParam});
    document.body.addEventListener('click', function(e){
      const a=e.target.closest('a,button'); if(!a) return;
      const txt=(a.innerText||a.textContent||a.getAttribute('aria-label')||'').trim().slice(0,80);
      const href=a.getAttribute('href')||'';
      if(/whatsapp|wa\.me|api\.whatsapp/i.test(href)) send('whatsapp_click',{label:txt, href});
      else if(/add to cart|cart|سلة|اضف|أضف/i.test(txt)) send('add_to_cart_click',{label:txt});
      else if(/view details|details|تفاصيل/i.test(txt)) send('view_details',{label:txt});
      else send('click',{label:txt, href});
    }, true);
  }
})();
