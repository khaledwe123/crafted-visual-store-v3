# CSRF Protection Latest Fix

Changed file: server.js only.

Changes applied:
- Added `X-CSRF-Token` to CORS allowed headers.
- Added CSRF cookie generation using `cv_csrf_token`.
- Added CSRF validation for authenticated unsafe API requests: POST, PUT, PATCH, DELETE.
- Added frontend fetch bridge injection to automatically send the CSRF token on same-origin write requests.
- Preserved existing SEO server rendering.
- Preserved duplicate `/api/admin/me` fix; route count remains 1.

Validation:
- `node --check server.js` passed.
- `/api/admin/me` route count verified as 1.
