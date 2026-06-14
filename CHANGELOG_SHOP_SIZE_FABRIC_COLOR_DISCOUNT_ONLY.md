# Changelog – Shop Size + Fabric + Color Discount Display Only

## Scope
Affected area only: shop frontend discount calculation and display.

## Files Modified
- `script.js`
- `public/script.js`

## What Changed
1. Added shop-side support for scoped discount rules saved as `product.discountRules`.
2. Added matching for exact discount combinations:
   - Size
   - Fabric
   - Color
3. Updated price calculation so a scoped discount applies only when the customer selects the matching Size + Fabric + Color combination.
4. Updated product cards to show the best available discounted variant when at least one variant has an active discount.
5. Updated Quick View modal price display to refresh when size, fabric, or color changes.
6. Updated Add to Cart so the selected matching variant uses the discounted price and correct discount percentage.
7. Improved API product parsing so `data_json.discountRules` is read correctly when products are loaded from Railway/Postgres.

## Effect
- Discounts created in Admin/Super Admin for one exact Size + Fabric + Color combination now appear in the shop.
- Non-matching combinations remain at full price.
- Product-wide, category, and all-product discounts continue to work as before.
- No admin, backend, menu, page builder, auth, styling, or checkout files were changed.

## Testing Steps
1. Create a discount in Admin/Super Admin:
   - Specific Product
   - Choose Size
   - Choose Fabric
   - Choose Color
   - Save discount
2. Open `shop.html`.
3. Confirm the product card shows discounted price if that product has any discounted variant.
4. Click Quick View or Customize.
5. Select the same Size + Fabric + Color combination.
6. Confirm the original price is crossed out, discounted price appears in red, and discount percentage appears.
7. Select a different size/fabric/color combination and confirm no scoped discount is applied.
8. Add the matching combination to cart and confirm the cart price uses the discounted price.
