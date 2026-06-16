/* Crafted Visual legal/help footer links
   Adds policy/help links without changing existing business logic. */
(function(){
  'use strict';
  const LINKS = [
    {href:'privacy-policy.html', en:'Privacy Policy', ar:'سياسة الخصوصية'},
    {href:'terms-and-conditions.html', en:'Terms & Conditions', ar:'الشروط والأحكام'},
    {href:'cookie-policy.html', en:'Cookie Policy', ar:'سياسة ملفات تعريف الارتباط'},
    {href:'help.html', en:'Help Center', ar:'مركز المساعدة'}
  ];
  function currentLang(){
    return (localStorage.getItem('lang') || document.documentElement.lang || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }
  function ensureStyle(){
    if(document.getElementById('cvLegalFooterStyle')) return;
    const style=document.createElement('style');
    style.id='cvLegalFooterStyle';
    style.textContent=`
      .cv-legal-footer-links{display:flex;flex-wrap:wrap;justify-content:center;gap:12px 18px;margin:18px auto 8px;max-width:900px;font-size:14px;line-height:1.6}
      .cv-legal-footer-links a{color:inherit;text-decoration:none;border-bottom:1px solid currentColor;opacity:.92}
      .cv-legal-footer-links a:hover{opacity:1}
      .cv-generated-footer{background:#183d32;color:#fff;padding:28px 6%;text-align:center;margin-top:40px}
    `;
    document.head.appendChild(style);
  }
  function render(){
    ensureStyle();
    const lang=currentLang();
    let footer=document.querySelector('footer');
    if(!footer){
      footer=document.createElement('footer');
      footer.className='cv-generated-footer';
      document.body.appendChild(footer);
    }
    let wrap=footer.querySelector('.cv-legal-footer-links');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='cv-legal-footer-links';
      const details=footer.querySelector('#footerDetails,.footer-details');
      if(details && details.parentNode) details.parentNode.insertBefore(wrap, details.nextSibling);
      else footer.appendChild(wrap);
    }
    wrap.setAttribute('dir', lang==='ar'?'rtl':'ltr');
    wrap.innerHTML=LINKS.map(l=>`<a href="${l.href}">${lang==='ar'?l.ar:l.en}</a>`).join('');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', render); else render();
  window.addEventListener('storage', render);
  document.addEventListener('click', function(e){
    if(e.target && (e.target.matches('.lang-btn,[data-cv-lang-toggle]') || e.target.closest('.lang-btn,[data-cv-lang-toggle]'))){ setTimeout(render,80); setTimeout(render,350); }
  }, true);
  window.cvRenderLegalFooterLinks=render;
})();
