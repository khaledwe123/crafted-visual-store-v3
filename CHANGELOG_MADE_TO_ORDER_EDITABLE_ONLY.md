# Changelog – Made to Order Text Editable Only

## Changed files
- `admin.html`
- `public/admin.html`
- `admin-core-consolidated.js`
- `public/admin-core-consolidated.js`
- `customer-journey-95.js`
- `public/customer-journey-95.js`

## What changed
- Added editable fields in Website Content settings:
  - `made_to_order_en`
  - `made_to_order_ar`
- Included both fields in the existing settings save flow.
- Updated product card delivery text to read from saved settings.

## Effect
- Admin/Super Admin can now edit:
  - `Made to order: 15–20 working days`
  - `تفصيل حسب الطلب: 15–20 يوم عمل`
- If no custom value is saved, the original default text remains unchanged.

## Not changed
- Shop logic
- Discounts
- Cart
- Checkout
- Reviews
- Product publishing
- Menu/Page Builder
- Analytics
- Styling
