# Discount Save + Color Combination Fix - Corrected Files Only

## Files changed
- admin.html
- public/admin.html
- admin-core-consolidated.js
- public/admin-core-consolidated.js

## Root cause
The deployed discount page had multiple overlapping discount handlers. The active handler did not fully support Color or Size + Fabric + Color rules and used an admin API helper that could fail with cookie-based Railway authentication. This made the form appear to work while the product discount data was not reliably saved back to the product record.

## Fix applied
- Added Color selector to the discount page.
- Added Product Only, Size Only, Fabric Only, Color Only, Size + Fabric, and Size + Fabric + Color scope options.
- Replaced the active discount save flow with a cookie-safe admin API request.
- Saves discount rules into the selected product's data with size, fabric, color, percent, active status, and publish pages.
- Lists saved discount rules with Size/Fabric/Color visible.
- Edit and Delete work on the same Discount page.

## Effect
- Specific product discounts now save correctly.
- Variant discounts with Size + Fabric + Color save correctly.
- The discount list displays the selected combination.
- No shop/cart/checkout/reviews/menu/page-builder/analytics files were changed.

## Testing
1. Login as Super Admin.
2. Open Discount Page.
3. Choose Specific Product.
4. Choose Size + Fabric + Color Combination.
5. Select size, fabric, and color.
6. Add discount percent and click Apply Discount.
7. Confirm it appears in the discount list with size, fabric, and color.
8. Refresh admin and confirm it remains saved.
