Crafted Furniture v1.0-final Super Admin Production Fix

What changed:
- Fixed server.js syntax error that crashed Railway at startup.
- Repaired Super Admin bootstrap/reset logic.
- Ensured DEFAULT_ADMIN_EMAIL + DEFAULT_ADMIN_PASSWORD can securely repair/create the Super Admin record only when the exact Railway password is used.
- Ensured /api/admin/login returns the backend role exactly as stored in the database.
- Added /api/admin/me to verify the authenticated admin role and permissions.
- Updated /api/version to CRAFTED-FURNITURE-SUPERADMIN-PROD-FIX-20260608-12.

Railway variables required:
NODE_ENV=production
JWT_SECRET=CV95-2026-SuperSecure-Furniture-Auth-Key-987654321
DEFAULT_ADMIN_EMAIL=admin@craftedvisual.com
DEFAULT_ADMIN_PASSWORD=Admin@12345Secure
RESET_ADMIN_PASSWORD=true

Deployment:
1. Upload all files in this ZIP to the GitHub repository root.
2. Commit changes to main.
3. Railway > Deployments > Redeploy latest commit.
4. Open /api/version and confirm CRAFTED-FURNITURE-SUPERADMIN-PROD-FIX-20260608-12.
5. Clear browser storage for the Railway site.
6. Login at /admin-login.html with DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD.
7. Verify role in browser console: JSON.parse(sessionStorage.getItem('cvAdminSession')).role should be superadmin.
8. After successful login, set RESET_ADMIN_PASSWORD=false and redeploy again.
