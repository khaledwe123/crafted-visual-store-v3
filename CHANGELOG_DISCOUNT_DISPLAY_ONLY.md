# CHANGELOG - Discount Display Only Fix

Source folder: Final for checking.zip

## Files changed
| File | Change | Effect |
|---|---|---|
| script.js | Added scoped discount display matcher for product-level, size, fabric, color, size+fabric, and size+fabric+color discount rules. | Shop and product modal now calculate and show the correct discounted price when a saved discount rule matches the selected product/variant. |

## What was fixed
- Discounts saved as `discountRules` were not being read by the main shop pricing functions.
- The shop only used `discountPercent`, so variant discounts such as Size + Fabric + Color did not appear.
- Product modal pricing now checks the selected size, fabric, and color before applying a discount.
- Product card starting price now uses the lowest matching discounted variant when a variant-level discount exists.

## What was not changed
- Admin discount form
- Discount saving logic
- Discounted Items page
- Cart structure
- Checkout
- Reviews
- Quick View structure
- Customize flow
- Menu Control
- Page Builder
- Analytics
- Authentication
- Styling/CSS
- Database schema

## Testing steps
1. In admin, create a discount for a specific product.
2. Select Size + Fabric + Color Combination.
3. Save the discount.
4. Open Shop.
5. Confirm the product card shows original price and discounted price if the discount is the lowest matching variant.
6. Open Quick View / Customize.
7. Select the exact size, fabric, and color.
8. Confirm the modal shows:
   - Total before discount crossed/old price
   - After discount price in red
   - Discount percentage
9. Select a non-matching variant and confirm full price remains.
