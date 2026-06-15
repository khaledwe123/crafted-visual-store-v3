# Server SEO Render Proper Fix

Changed file:
- `server.js`

Purpose:
- Makes SEO tags render directly in the initial HTML response before JavaScript runs.
- Keeps the existing backend SEO panel/settings as the source of SEO values.
- Improves Google crawling and social previews for WhatsApp, Facebook, LinkedIn, and Twitter/X.

What was added:
- Server-side SEO tag builder using existing `settings.seo_pages` and `DEFAULT_SEO_PAGES`.
- Server-rendered `<title>`, meta description, keywords, robots, canonical, Open Graph, Twitter Card tags.
- Server-rendered JSON-LD FurnitureStore schema.
- Product JSON-LD when a product is opened via `shop.html?product=...`.
- Admin/private pages receive `noindex, nofollow`.

What was not changed:
- Admin login logic
- Arabic toggle logic
- Discount logic
- Product logic
- Payment logic
- Database schema
- CSP directives
- API routes
- Frontend JS/CSS/HTML files

Validation:
- `node --check server.js` passed.
