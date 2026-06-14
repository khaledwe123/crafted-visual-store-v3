# Discount Color Combination Final Patch

## Files changed

| File | Change | Effect |
|---|---|---|
| admin.html | Added `discountColorTarget` selector and renamed combo option to `Size + Fabric + Color Combination` | Admin form can display/select Color for specific product combination discounts. |
| public/admin.html | Same admin HTML update for public deployment path | Railway/static deployment stays aligned. |
| admin-core-consolidated.js | Added color extraction/population/validation/save/edit/list support for combo discounts | Discount rules now store and edit exact Size + Fabric + Color combinations. |
| public/admin-core-consolidated.js | Same consolidated admin runtime update for public deployment path | Production runtime uses the new color-combination logic. |

## Not changed
Shop, cart, checkout, reviews, menu, page builder, analytics, product publishing, styling, server, and database schema were not changed.
