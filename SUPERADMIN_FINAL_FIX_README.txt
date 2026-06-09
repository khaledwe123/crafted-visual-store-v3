SUPERADMIN FINAL FIX

This package fixes the admin/superadmin loop permanently.

What changed:
1. server.js forces DEFAULT_ADMIN_EMAIL to role=superadmin when logging in with DEFAULT_ADMIN_PASSWORD.
2. admin-login.js handles both button click and form submit, and clears old prototype role data.
3. adminAuthGuard.js trusts backend session and does not downgrade role from localStorage.
4. admin.js no longer merges cvAdminUsers localStorage over backend session.
5. Cache busting updated for admin scripts.

Railway variables required:
NODE_ENV=production
JWT_SECRET=CV95-2026-SuperSecure-Furniture-Auth-Key-987654321
DEFAULT_ADMIN_EMAIL=admin@craftedvisual.com
DEFAULT_ADMIN_PASSWORD=Admin@12345Secure
RESET_ADMIN_PASSWORD=true

After successful login, you may set RESET_ADMIN_PASSWORD=false and redeploy.

Admin login:
/admin-login.html
admin@craftedvisual.com
Admin@12345Secure

Verify after deploy:
/api/version must show UX95-SUPERADMIN-FINAL-FIX-20260607-10
