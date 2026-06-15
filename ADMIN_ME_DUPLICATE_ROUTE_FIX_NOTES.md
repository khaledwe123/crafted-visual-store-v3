# Duplicate /api/admin/me cleanup

Changed file: `server.js` only.

What changed:
- Removed the second duplicate `GET /api/admin/me` route.
- Kept the existing authoritative route that returns `id`, `name`, `email`, `role`, `isSuperAdmin`, and `permissions` at the top level.

Not touched:
- Admin login route
- Cookies/JWT/auth middleware
- Arabic language files
- Discount files
- Payment files
- Product/shop frontend files

Expected impact:
- Admin login should continue working the same.
- Reduces route conflict risk in `server.js`.
