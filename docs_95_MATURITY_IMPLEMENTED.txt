Crafted Visual 95/100 Maturity Implementation

Implemented in this version:
1. Customer journey tracking API: /api/journey
2. UTM/source/referrer tracking through analytics-tracker.js
3. Funnel dashboard: customer-journey-dashboard.html
4. Abandoned cart storage endpoint: /api/cart/abandoned
5. Inventory summary endpoint: /api/inventory/summary
6. Security audit log table and endpoint: /api/audit-logs
7. New maturity database tables created automatically by schema.js
8. SEO remains active with robots.txt, sitemap.xml and settings.
9. Security hardening remains active through Helmet, JWT, rate limits and safer upload validation.

Railway Variables recommended:
NODE_ENV=production
JWT_SECRET=long-random-secret-minimum-32-characters
DEFAULT_ADMIN_EMAIL=your-admin-email
DEFAULT_ADMIN_PASSWORD=strong-password-minimum-12-characters
PUBLIC_SITE_URL=https://your-domain
ALLOWED_ORIGINS=https://your-domain
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GTM_ID=GTM-XXXXXXX
CLARITY_PROJECT_ID=xxxxxxxx
META_PIXEL_ID=xxxxxxxx

After deployment:
1. Login to admin.html as Super Admin.
2. Open customer-journey-dashboard.html.
3. Visit the website using a UTM link like:
   https://your-domain/?utm_source=instagram&utm_medium=social&utm_campaign=launch
4. Refresh the dashboard to see source and journey data.
