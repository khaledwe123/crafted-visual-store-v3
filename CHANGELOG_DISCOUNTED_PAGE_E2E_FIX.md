# Changelog – Discounted Items Page E2E Fix

## Files Changed

| File | Change | Effect |
|------|--------|--------|
| `discounted-items.html` | Added `quickview-final-fix.js` and `discounted-items-final-fix.js` after existing scripts | Enables Quick View/Customize and discounted variant rendering on Discounted Items page |
| `public/discounted-items.html` | Same as root file | Keeps Railway/public deployment aligned |
| `quickview-final-fix.js` | Added preferred Size/Fabric/Color variant support | Quick View and Customize open with the discounted variant preselected |
| `public/quickview-final-fix.js` | Same as root file | Keeps Railway/public deployment aligned |
| `discounted-items-final-fix.js` | New page-only runtime fix | Renders only discounted products/variants with original price, discounted price, and discount badge |
| `public/discounted-items-final-fix.js` | Same as root file | Keeps Railway/public deployment aligned |

## Not Changed

- Main Shop rendering
- Admin discount page
- Cart structure
- Checkout structure
- Reviews
- Menu Control
- Page Builder
- Analytics
- Authentication/authorization
- Environment variables
- Database schema
