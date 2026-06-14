# Discount Color Combination Patch

## Scope
Corrected files only. No shop, cart, checkout, reviews, menu, page builder, analytics, styling, or Railway configuration files were changed.

## Files Modified

| File | Change | Effect |
|---|---|---|
| admin.html | Updated the Specific Product discount scope label from Size + Fabric Combination to Size + Fabric + Color Combination and added the Color dropdown field | Admin/Super Admin can select color as part of the discount combination |
| public/admin.html | Same frontend form update for public/Railway-served admin page | Keeps deployed admin form consistent |
| admin-workflow-fix-v34.js | Added color extraction, color dropdown population, validation, save/edit/list matching, and rule storage for Size + Fabric + Color combination discounts | Discounts can now be created for the exact product variant: size + fabric + color |

## Behavior After Update
- Select Discount Page.
- Choose Specific Product.
- Choose Size + Fabric + Color Combination.
- Select Size, Fabric, and Color.
- Save/apply discount.
- The discount rule is stored with size, fabric, and color.

## Not Changed
- Shop display logic
- Cart
- Checkout
- Product publishing
- Quick View / Customize
- Reviews
- Analytics
- Menu Control
- Page Builder
- Styling
