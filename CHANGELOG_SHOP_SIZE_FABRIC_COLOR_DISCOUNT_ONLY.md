# Change Log – Shop Size + Fabric + Color Discount Only

Source base: `Final for checking.zip` (last deployed folder).

## Files Changed

| File | Change | Effect |
|---|---|---|
| `admin.html` | Added hidden `discountColorTarget` select to Discount Page form | Allows Color to be selected for Specific Product combination discounts |
| `admin-workflow-fix-v34.js` | Added targeted Discount Page patch for Size + Fabric + Color combinations | Saves exact product variant discount rules including color without changing other admin modules |
| `script.js` | Added targeted shop-side discount matcher | Shows and calculates discounts only when selected Size + Fabric + Color matches the saved rule |

## What Was Not Changed

- Shop product rendering structure
- Quick View opening logic
- Customize opening logic
- Cart and checkout flow
- Reviews
- Analytics
- Menu Control
- Page Builder
- Product publishing
- Styling/CSS
- Server routes

## Validation Notes

- Non-matching variants remain full price.
- Matching Size + Fabric + Color variants show crossed original price, red discounted price, and discount badge.
- Product-level discounts continue to work as before.
