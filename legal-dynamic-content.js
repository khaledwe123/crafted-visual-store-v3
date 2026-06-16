(function(){
  'use strict';

  const pageKey = document.body && document.body.getAttribute('data-policy-page');
  if (!pageKey || !['privacy','terms','cookie','help'].includes(pageKey)) return;

  function asObject(value){
    if (!value) return {};
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (_) { return {}; }
    }
    return {};
  }

  function cleanText(value){
    return String(value || '').trim();
  }

  function escapeHtml(value){
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Allow simple, safe formatting for legal content entered from Admin.
  // Supports: <strong>, <b>, <em>, <i>, <p>, <br>, <ul>, <ol>, <li>, <h1>-<h4>, and safe links.
  function sanitizeHtml(html){
    const template = document.createElement('template');
    template.innerHTML = html;
    const allowedTags = new Set(['STRONG','B','EM','I','P','BR','UL','OL','LI','H1','H2','H3','H4','A','DIV','SPAN']);
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      if (!allowedTags.has(node.tagName)) {
        const text = document.createTextNode(node.textContent || '');
        node.parentNode && node.parentNode.replaceChild(text, node);
        return;
      }

      Array.from(node.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = attr.value || '';
        if (node.tagName === 'A' && name === 'href') {
          if (/^(https?:\/\/|mailto:|\/|#)/i.test(value)) return;
        }
        if (node.tagName === 'A' && ['target','rel'].includes(name)) return;
        node.removeAttribute(attr.name);
      });

      if (node.tagName === 'A') {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    return template.innerHTML;
  }

  function markdownToHtml(text){
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inUl = false;
    let inOl = false;
    let para = [];

    function inlineFormat(value){
      return escapeHtml(value)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>');
    }

    function closeLists(){
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    }
    function flushPara(){
      if (para.length) {
        out.push('<p>' + para.map(inlineFormat).join('<br>') + '</p>');
        para = [];
      }
    }

    lines.forEach(raw => {
      const line = raw.trim();
      if (!line) { flushPara(); closeLists(); return; }

      const h = line.match(/^(#{1,4})\s+(.+)$/);
      if (h) {
        flushPara(); closeLists();
        const level = Math.min(h[1].length, 4);
        out.push('<h' + level + '>' + inlineFormat(h[2]) + '</h' + level + '>');
        return;
      }

      const bullet = line.match(/^[-*•]\s+(.+)$/);
      if (bullet) {
        flushPara();
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (!inUl) { out.push('<ul>'); inUl = true; }
        out.push('<li>' + inlineFormat(bullet[1]) + '</li>');
        return;
      }

      const numbered = line.match(/^\d+[.)]\s+(.+)$/);
      if (numbered) {
        flushPara();
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (!inOl) { out.push('<ol>'); inOl = true; }
        out.push('<li>' + inlineFormat(numbered[1]) + '</li>');
        return;
      }

      para.push(line);
    });

    flushPara();
    closeLists();
    return out.join('\n');
  }

  function formattedContent(text){
    const value = cleanText(text);
    if (!value) return '';
    // If user entered HTML tags in Admin, preserve only safe formatting tags.
    if (/<\/?(strong|b|em|i|p|br|ul|ol|li|h1|h2|h3|h4|a|div|span)\b/i.test(value)) {
      return sanitizeHtml(value);
    }
    // Otherwise support Markdown-like formatting such as **bold** and # headings.
    return sanitizeHtml(markdownToHtml(value));
  }

  function updateHero(titleEn, titleAr){
    if (titleEn) {
      const h1En = document.querySelector('.page-hero h1[data-lang-block="en"]');
      if (h1En) h1En.textContent = titleEn;
    }
    if (titleAr) {
      const h1Ar = document.querySelector('.page-hero h1[data-lang-block="ar"]');
      if (h1Ar) h1Ar.textContent = titleAr;
    }
  }

  function renderSimple(section){
    if (!section) return;
    const titleEn = cleanText(section.title_en);
    const titleAr = cleanText(section.title_ar);
    const bodyEn = cleanText(section.body_en);
    const bodyAr = cleanText(section.body_ar);
    updateHero(titleEn, titleAr);

    const en = document.querySelector('.legal-content[data-lang-block="en"]');
    const ar = document.querySelector('.legal-content[data-lang-block="ar"]');
    if (en && bodyEn) en.innerHTML = formattedContent(bodyEn);
    if (ar && bodyAr) ar.innerHTML = formattedContent(bodyAr);
    if (ar) ar.setAttribute('dir', 'rtl');
  }

  function renderHelp(section){
    if (!section) return;
    updateHero(cleanText(section.title_en), cleanText(section.title_ar));
    const en = document.querySelector('.legal-content[data-lang-block="en"]');
    const ar = document.querySelector('.legal-content[data-lang-block="ar"]');

    const returnsEn = cleanText(section.returns_en);
    const warrantyEn = cleanText(section.warranty_en);
    const deliveryEn = cleanText(section.delivery_en);
    const returnsAr = cleanText(section.returns_ar);
    const warrantyAr = cleanText(section.warranty_ar);
    const deliveryAr = cleanText(section.delivery_ar);

    if (en && (returnsEn || warrantyEn || deliveryEn)) {
      en.innerHTML = ''
        + (returnsEn ? '<h2>1. Returns Process / Return Policy</h2>' + formattedContent(returnsEn) : '')
        + (warrantyEn ? '<h2>2. Warranty Policy</h2>' + formattedContent(warrantyEn) : '')
        + (deliveryEn ? '<h2>3. Delivery Information</h2>' + formattedContent(deliveryEn) : '');
    }
    if (ar && (returnsAr || warrantyAr || deliveryAr)) {
      ar.innerHTML = ''
        + (returnsAr ? '<h2>١. إجراءات الإرجاع / سياسة الإرجاع</h2>' + formattedContent(returnsAr) : '')
        + (warrantyAr ? '<h2>٢. سياسة الضمان</h2>' + formattedContent(warrantyAr) : '')
        + (deliveryAr ? '<h2>٣. معلومات التوصيل</h2>' + formattedContent(deliveryAr) : '');
      ar.setAttribute('dir', 'rtl');
    }
  }

  async function loadPoliciesLegal(){
    try {
      const res = await fetch('/api/settings', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return;
      const settings = await res.json();
      const policies = asObject(settings.policies_legal);
      if (!policies || !policies[pageKey]) return;
      if (pageKey === 'help') renderHelp(policies.help);
      else renderSimple(policies[pageKey]);
    } catch (_) {
      // Keep the static page content if backend settings are unavailable.
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadPoliciesLegal, { once:true });
  else loadPoliciesLegal();
})();
