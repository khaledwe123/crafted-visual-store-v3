# Changelog – Discounted Items End-to-End Fix Only

## Source
Base folder used: `Final for checking.zip` — the last deployed folder provided by the user.

## Files Modified

| File | Change | Effect |
|---|---|---|
| `admin.html` | Added Color selector field and Size + Fabric + Color Combination option in the Discount Page UI | Admin/Super Admin can choose exact product variant color when creating a discount |
| `public/admin.html` | Same admin UI update for deployed public build | Keeps Railway-served admin page aligned |
| `admin-core-consolidated.js` | Added color extraction, selector population, validation, save/edit/list support, and selected-value preservation | Discount combinations now save and display Product + Size + Fabric + Color correctly |
| `public/admin-core-consolidated.js` | Same backend admin-browser logic update for public build | Keeps Railway deployment aligned |
| `script.js` | Added exact product/variant discount matcher and discounted-page filter | Discounted products appear on Discounted Items page while remaining visible in Shop |
| `public/script.js` | Same shop discount logic for public build | Keeps production shop aligned |
| `quickview-final-fix.js` | Refreshes price when color changes inside the active Quick View modal | Variant/color-specific discounts update in product detail modal |
| `public/quickview-final-fix.js` | Same Quick View modal update for public build | Keeps production modal aligned |

## What Was Not Changed

- Authentication and authorization rules
- Environment variables
- Database schema
- Product publishing workflow
- Cart and checkout structure
- Reviews
- Menu Control
- Page Builder
- Analytics Center
- Styling/layout

## Verification Performed

- `node -c script.js`
- `node -c public/script.js`
- `node -c admin-core-consolidated.js`
- `node -c public/admin-core-consolidated.js`
- `node -c quickview-final-fix.js`
- `node -c public/quickview-final-fix.js`
