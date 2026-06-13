
(function(){
  function cleanPublicUX(){
    if (/admin\.html|admin-login\.html/.test(location.pathname)) return;
    document.querySelectorAll('.ux95-release-ribbon,#ux95-home-hardcoded,#ux95-home-journey,#ux95-tools-home,#cvStandaloneTools').forEach(el=>el.remove());
    document.querySelectorAll('a,button').forEach(el=>{
      const t=(el.textContent||'').trim().toLowerCase();
      if(t==='analytics' || t==='room tools' || t==='ux95 analytics') el.remove();
    });
  }
  document.addEventListener('DOMContentLoaded', cleanPublicUX);
  setInterval(cleanPublicUX, 800);
})();
