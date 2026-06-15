# Discount combination color safe fix

Based on the uploaded original root folder: `Final for checking (1).zip`.

## Files changed
- `admin.html`
- `admin-core-consolidated.js`

## What changed
- Added back the missing `discountColorTarget` select field in the Discount Page UI.
- Updated the product discount combination option label to `Size + Fabric + Color Combination`.
- When `Specific Product` + `combo` is selected, the discount page now loads:
  - Size
  - Fabric
  - Color
- Saved discount rules now include `color` for combo discounts.
- Edit discount reloads the saved color into the form.
- Discount list displays color when the rule includes it.

## What was not touched
- `server.js` was not changed.
- Admin login/auth files were not changed.
- Arabic/language files were not changed.
- Payment files were not changed.
- Shop/front-end files were not changed.
- Database files were not changed.

## Validation
- `admin-core-consolidated.js` passed JavaScript syntax check with `node --check`.
