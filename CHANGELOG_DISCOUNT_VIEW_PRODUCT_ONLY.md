# CHANGELOG — Discount Display While Viewing Product Only

## Scope
Corrected files only. This patch fixes discount visibility in the customer shop product view/modal.

## Files Changed
- `script.js`
- `public/script.js`
- `quickview-final-fix.js`
- `public/quickview-final-fix.js`

## What Changed
- Added frontend discount matching for product-level and variant-level discount rules.
- Variant matching now supports Size + Fabric + Color rules.
- Product modal price display now checks the selected size, fabric, and color.
- Color changes in Quick View now refresh the price area so color-specific discounts appear immediately.
- Original price, discounted red price, and discount percentage are displayed when the selected combination matches.

## Effect
- Discount appears while viewing the product in the shop.
- Discount applies only to the matching product/variant/combination.
- Non-matching size/fabric/color combinations remain full price.
- Main shop, admin, cart, checkout, reviews, menu, page builder, analytics, auth, and styling were not changed.
