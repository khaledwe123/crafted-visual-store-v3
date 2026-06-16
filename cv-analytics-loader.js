(function(){
  window.CV_ANALYTICS_READY = false;
  async function loadCVAnalytics(){
    try{
      var local = localStorage.getItem('cms_settings');
      var settings = local ? JSON.parse(local) : await fetch('settings.json').then(function(r){ return r.json(); });

      if(settings.google_analytics_id && settings.google_analytics_id !== 'G-XXXXXXXXXX'){
        var ga = document.createElement('script');
        ga.async = true;
        ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(settings.google_analytics_id);
        document.head.appendChild(ga);
        window.dataLayer = window.dataLayer || [];
        function gtag(){ window.dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', settings.google_analytics_id);
      }

      if(settings.google_tag_manager_id && settings.google_tag_manager_id !== 'GTM-XXXXXXX'){
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({'gtm.start': new Date().getTime(), event:'gtm.js'});
        var gtm = document.createElement('script');
        gtm.async = true;
        gtm.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(settings.google_tag_manager_id);
        document.head.appendChild(gtm);
      }

      if(settings.meta_pixel_id){
        !function(f,b,e,v,n,t,s){
          if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
          t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
        }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
        if(window.fbq){ window.fbq('init', settings.meta_pixel_id); window.fbq('track','PageView'); }
      }
      window.CV_ANALYTICS_READY = true;
    }catch(e){ console.warn('Analytics loader skipped:', e); }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadCVAnalytics);
  else loadCVAnalytics();
})();
