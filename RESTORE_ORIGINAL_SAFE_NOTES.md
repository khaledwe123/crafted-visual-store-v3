# Restore Original Admin Login + Arabic + Discount Color

These files are copied directly from the original uploaded folder `Final for checking (1).zip`.

Replace only these files if admin login is broken after prior patches:

- server.js
- admin.html
- admin-login.html
- admin-login.js
- adminAuthGuard.js
- language-toggle-fix.js

Purpose:
- Restore original admin authentication flow.
- Restore original admin discount page UI, including Color selector.
- Restore original Arabic language toggle helper.
- Avoid touching payment.html, product files, discount engine files, or shop files.

After upload:
1. Restart Railway/app server.
2. Open a private/incognito browser window.
3. Go to admin-login.html.
4. Sign in again.
5. Do not reuse old cached admin tab.
