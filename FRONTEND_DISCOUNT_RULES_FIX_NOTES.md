# Frontend Discount Rules Fix

Changed file only:
- script.js

What this fixes:
- Frontend shop now reads product `discountRules` saved by the backend/admin discount page.
- Supports product-specific discounts by:
  - Size
  - Fabric
  - Color
  - Size + Fabric
  - Size + Fabric + Color
- Quick View / Customize modal recalculates price when size, fabric, or color changes.
- Add to Cart carries the correct discounted price and discount percentage for the selected combination.
- Product cards show the lowest discounted combination price when a combination discount exists.

Not touched:
- server.js
- admin.html
- admin login/auth files
- Arabic toggle files
- payment files
- product/category backend files

Verification:
- `node --check script.js` passed.
