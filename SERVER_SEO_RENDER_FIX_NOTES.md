# Server SEO Render Fix

Master source used: last uploaded `Final for checking .zip`.

Changed file only:
- `server.js`

What changed:
- Added server-side SEO tag rendering for safe public HTML pages.
- Uses existing backend SEO settings from `/api/settings` / `seo_pages`.
- Injects/updates title, meta description, keywords, canonical URL, Open Graph tags, Twitter Card tags, and FurnitureStore JSON-LD before the HTML is sent.
- Keeps the existing JavaScript SEO updater in `script.js` untouched.

What was not touched:
- Admin login
- Arabic button
- Discounts
- Payment logic
- Products
- Shop functionality
- Frontend JavaScript/CSS/HTML files
- Database schema
- Authentication routes

Safety note:
- If SEO settings cannot be read for any reason, the server logs a warning and sends the original HTML instead of breaking the page.
