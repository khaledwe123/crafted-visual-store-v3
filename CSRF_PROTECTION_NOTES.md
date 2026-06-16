# CSRF Protection Fix

Changed file: `server.js` only.

What changed:
- Adds a readable `cv_csrf_token` cookie.
- Adds server-side CSRF validation for authenticated cookie-based unsafe API requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- Adds a small nonce-protected fetch bridge into HTML pages so same-origin unsafe `fetch()` calls automatically send `X-CSRF-Token`.
- Allows `X-CSRF-Token` in CORS allowed headers.
- Preserves existing admin/customer auth cookies and appends cookies safely.

What was not changed:
- Admin login routes and credentials.
- Arabic translation files.
- Discounts.
- Products.
- Payment logic.
- SEO logic.
- Frontend HTML/CSS/JS files.

Verification:
- `node --check server.js` passed.
