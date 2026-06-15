ADMIN /api/admin/me DUPLICATE ROUTE FIX

Changed file:
- server.js

What changed:
- Removed only the duplicate second app.get('/api/admin/me', auth, ...) route.
- Kept the authoritative /api/admin/me route that appears earlier and is used for live role/permission checks.

Validation:
- node --check server.js passed.
- Remaining /api/admin/me route count: 1.

Not touched:
- Admin login route
- Admin cookies/auth middleware
- Arabic translation
- Discounts
- Products
- Payment
- SEO rendering logic
- CSS/JS/HTML files
