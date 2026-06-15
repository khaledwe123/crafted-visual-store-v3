ADMIN UNAUTHORIZED FIX

Replace only this file in the website root:
- adminAuthGuard.js

What this fixes:
- Clears stale admin tokens after deployment/server restart.
- Redirects to admin-login.html when the backend says the token is Unauthorized/Forbidden.
- Stops the admin page from showing "Super Admin" from old browser storage while API calls fail.

After upload:
1. Hard refresh the browser.
2. If still stuck, click Logout or clear site data once.
3. Sign in again.

This does not change products, payment, discounts, or website content.
