let pageLang = localStorage.getItem('lang') || 'en';
let pageSettings = {};

function pageParam(name){ return new URLSearchParams(location.search).get(name) || ''; }
function inferredPageSlug(){
  const fromQuery = pageParam('slug');
  if(fromQuery) return fromQuery;
  const file = (location.pathname.split('/').pop() || '').replace(/\.html$/i,'');
  const known = ['privacy-policy','terms-and-conditions','cookie-policy','help'];
  return known.includes(file) ? file : '';
}
function pageEsc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function pageNl2br(v){ return pageEsc(v).replace(/\n/g, '<br>'); }

async function pageGetSettings(){
  try{
    const res = await fetch('/api/settings', {cache:'no-store'});
    if(res.ok) return await res.json();
  }catch(e){}
  try{ return JSON.parse(localStorage.getItem('cms_settings') || '{}'); }catch(e){ return {}; }
}

function pageMenuItems(){
  const fallback = [
    {label_en:'Home',label_ar:'الرئيسية',url:'index.html',visible:true},
    {label_en:'Shop',label_ar:'المتجر',url:'shop.html',visible:true},
    {label_en:'Discounted Items',label_ar:'العروض',url:'discounted-items.html',visible:true},
    {label_en:'Custom Order',label_ar:'طلب تفصيل',url:'index.html#custom',visible:true},
    {label_en:'Track Order',label_ar:'تتبع الطلب',url:'track-order.html',visible:true},
    {label_en:'Contact Us',label_ar:'تواصل معنا',url:'contact.html',visible:true},
    {label_en:'My Account',label_ar:'حسابي',url:'account.html',visible:true}
  ];
  return Array.isArray(pageSettings.menu) && pageSettings.menu.length ? pageSettings.menu : fallback;
}

function renderPageMenu(){
  const nav = document.getElementById('mainMenu');
  if(!nav) return;
  nav.innerHTML = pageMenuItems().filter(i => i.visible !== false).map(i => `<a href="${pageEsc(i.url)}">${pageEsc(pageLang === 'ar' ? (i.label_ar || i.label_en) : (i.label_en || i.label_ar))}</a>`).join('');
}

function setPageMeta(page){
  const title = pageLang === 'ar' ? (page.seo_title_ar || page.title_ar || page.title_en) : (page.seo_title_en || page.title_en || page.title_ar);
  const desc = pageLang === 'ar' ? (page.seo_description_ar || page.subtitle_ar || page.subtitle_en) : (page.seo_description_en || page.subtitle_en || page.subtitle_ar);
  if(title) document.title = title + ' | Crafted Visual';
  let meta = document.querySelector('meta[name="description"]');
  if(!meta){ meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
  meta.content = desc || '';
}


function renderPageFooterLegalLinks(){
  const footer = document.querySelector('footer.footer') || document.querySelector('footer');
  if(!footer) return;
  let box = document.getElementById('footerLegalLinks');
  if(!box){
    box = document.createElement('div');
    box.id = 'footerLegalLinks';
    box.className = 'footer-legal-links';
    box.style.marginTop = '14px';
    box.style.display = 'flex';
    box.style.gap = '14px';
    box.style.flexWrap = 'wrap';
    box.style.justifyContent = 'center';
    footer.appendChild(box);
  }
  const fallback = [
    {label_en:'Privacy Policy', label_ar:'سياسة الخصوصية', url:'privacy-policy.html', visible:true},
    {label_en:'Terms & Conditions', label_ar:'الشروط والأحكام', url:'terms-and-conditions.html', visible:true},
    {label_en:'Cookie Policy', label_ar:'سياسة ملفات تعريف الارتباط', url:'cookie-policy.html', visible:true},
    {label_en:'Help Center', label_ar:'مركز المساعدة', url:'help.html', visible:true}
  ];
  const links = Array.isArray(pageSettings.footer_legal_links) && pageSettings.footer_legal_links.length ? pageSettings.footer_legal_links : fallback;
  box.innerHTML = links.filter(l => l.visible !== false).map(l => `<a href="${pageEsc(l.url)}">${pageEsc(pageLang === 'ar' ? (l.label_ar || l.label_en) : (l.label_en || l.label_ar))}</a>`).join('');
}

function renderDynamicPage(){
  const slug = inferredPageSlug();
  const pages = Array.isArray(pageSettings.custom_pages) ? pageSettings.custom_pages : [];
  const page = pages.find(p => String(p.slug) === String(slug) || String(p.id) === String(slug));
  document.documentElement.lang = pageLang;
  document.documentElement.dir = pageLang === 'ar' ? 'rtl' : 'ltr';
  document.querySelector('.lang-btn').textContent = pageLang === 'ar' ? 'English' : 'عربي';
  document.getElementById('brandText').textContent = pageLang === 'ar' ? (pageSettings.brand_ar || 'كرافتد فيجوال') : (pageSettings.brand_en || 'Crafted Visual');
  document.getElementById('footerBrand').textContent = document.getElementById('brandText').textContent;
  document.getElementById('footerText').textContent = pageLang === 'ar' ? (pageSettings.footer_text_ar || '') : (pageSettings.footer_text_en || '');

  if(!page || page.active === false){
    document.getElementById('pageTitle').textContent = pageLang === 'ar' ? 'الصفحة غير متاحة' : 'Page not available';
    document.getElementById('pageSubtitle').textContent = '';
    document.getElementById('pageContent').innerHTML = `<p>${pageLang === 'ar' ? 'هذه الصفحة غير منشورة حالياً.' : 'This page is not currently published.'}</p>`;
    renderPageMenu();
    renderPageFooterLegalLinks();
    return;
  }

  setPageMeta(page);
  const title = pageLang === 'ar' ? (page.title_ar || page.title_en) : (page.title_en || page.title_ar);
  const subtitle = pageLang === 'ar' ? (page.subtitle_ar || page.subtitle_en) : (page.subtitle_en || page.subtitle_ar);
  const body = pageLang === 'ar' ? (page.body_ar || page.body_en) : (page.body_en || page.body_ar);
  const btnLabel = pageLang === 'ar' ? (page.button_label_ar || page.button_label_en) : (page.button_label_en || page.button_label_ar);

  document.getElementById('pageTitle').textContent = title || '';
  document.getElementById('pageSubtitle').textContent = subtitle || '';
  if(page.hero_image){
    const hero = document.querySelector('.page-hero');
    hero.style.background = `linear-gradient(90deg,rgba(24,61,50,.86),rgba(24,61,50,.35)),url('${page.hero_image}') center/cover`;
    hero.style.color = '#fff';
  }
  document.getElementById('pageContent').innerHTML = `
    <div class="dynamic-page-body">${pageNl2br(body || '')}</div>
    ${btnLabel && page.button_url ? `<p style="margin-top:24px;"><a class="btn primary" href="${pageEsc(page.button_url)}">${pageEsc(btnLabel)}</a></p>` : ''}
  `;
  renderPageMenu();
  renderPageFooterLegalLinks();
}

function togglePageLang(){
  pageLang = pageLang === 'en' ? 'ar' : 'en';
  localStorage.setItem('lang', pageLang);
  renderDynamicPage();
}

(async function initDynamicPage(){
  pageSettings = await pageGetSettings();
  renderDynamicPage();
})();
