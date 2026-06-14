# Changelog – Discount Specific Product Size + Fabric + Color Only

## Scope
Affected area only: Admin/Super Admin Discount Page.

## Files Modified
- `admin.html`
- `admin-workflow-fix-v34.js`

## What Changed
1. Added variant targeting controls under Discount Page for Specific Product:
   - Size dropdown
   - Fabric dropdown
   - Color dropdown
2. The Size/Fabric/Color controls only appear when `Specific Product` is selected.
3. The dropdowns populate from the selected product's saved product data.
4. Applying a Specific Product discount now saves a scoped discount rule:
   - `scope: size_fabric_color`
   - selected `size`
   - selected `fabric`
   - selected `color`
   - selected discount percentage
5. Category and All Products discounts keep the existing product-wide discount behavior.
6. Active discount list now shows exact Size + Fabric + Color scoped discounts.
7. Added edit support for scoped variant discount rows to refill the same discount form.

## Effect
- Admin/Super Admin can discount one exact product combination instead of discounting the full product.
- Existing product, category, and all-product discount flows remain unchanged.
- No shop, cart, checkout, auth, page builder, menu, or styling files were modified.

## Database Changes
- No database migration required.
- Scoped rules are stored inside each product `data.discountRules` payload.

## Testing Steps
1. Login as Super Admin or Admin with discount permission.
2. Open Discount Page.
3. Choose `Specific Product`.
4. Select a product.
5. Confirm Size, Fabric, and Color dropdowns appear.
6. Select Size + Fabric + Color.
7. Enter discount percentage.
8. Click Apply Discount.
9. Confirm the saved discount appears in the discount list with the exact combination.
10. Test Category and All Products discounts to confirm they still work as before.
