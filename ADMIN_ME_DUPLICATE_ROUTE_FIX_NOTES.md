# Duplicate /api/admin/me route fix

Changed file: `server.js` only.

What changed:
- Removed only the second duplicate `app.get('/api/admin/me', auth, ...)` route block.
- Kept the existing authoritative `/api/admin/me` route that starts with `app.get('/api/admin/me',(req,res)=>{ auth(req,res,()=>{ ... }) })`.

Verification:
- Remaining `/api/admin/me` active route count: 1.
- `node --check server.js` passed.

Not changed:
- Admin login route
- Auth cookie logic
- Arabic toggle
- Discounts
- Payment
- Products/shop
- SEO rendering
- CSS/HTML/frontend files
