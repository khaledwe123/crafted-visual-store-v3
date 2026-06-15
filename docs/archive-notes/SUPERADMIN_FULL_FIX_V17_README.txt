Crafted Visual Super Admin Full Actions Fix v17

Root cause fixed:
- Super Admin was authenticated correctly, but several admin actions still used legacy frontend logic.
- Menu/category controls saved only to browser storage and did not publish to the backend.
- Customer Journey dashboard searched for old token keys (adminToken) instead of cvAdminApiToken.
- UX95 Analytics tab was injected after initial tab listeners were attached, so the button could fail.
- Backend /api/settings was protected only by seo permission, while it is shared by menu, banners, content, categories and SEO.

Files changed:
- server.js: version updated; added fullPermissions(); login and admin-users return full Super Admin permissions; /api/settings now uses settings write guard with safe permission fallback.
- admin.js: added permanent Super Admin frontend action layer; backend publishing for menu, categories and settings; full permissions normalization; delegated tab clicks for UX95; token-safe admin fetch helper.
- apiClient.js: adminLogin now stores token/session in both localStorage and sessionStorage; added currentAdmin().
- customer-journey-dashboard.html: now uses cvAdminApiToken for protected analytics endpoints.
- admin.html: removed inline Analytics Center onclick and replaced with data-tab-link.

Railway variables required:
JWT_SECRET=at least 32 characters
DEFAULT_ADMIN_EMAIL=admin@craftedvisual.com
DEFAULT_ADMIN_PASSWORD=your secure password with 12+ characters
NODE_ENV=production
RESET_ADMIN_PASSWORD=true only when resetting admin password, then set false

After deployment:
1. Confirm /api/version shows CRAFTED-VISUAL-SUPERADMIN-FULL-ACTIONS-FIX-20260608-17.
2. Clear browser storage.
3. Log in again as admin@craftedvisual.com.
4. Test Menu Save, SEO Save, Category Add, Customer Journey and UX95 Analytics.
