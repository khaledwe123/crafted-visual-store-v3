# Discounted Items Final Redo - Files Only

## Files changed
- `discounted-items.html`
- `public/discounted-items.html`
- `discounted-items-final-fix.js`
- `public/discounted-items-final-fix.js`
- `CHANGELOG_DISCOUNTED_ITEMS_FINAL_REDO.md`

## What changed
- Added a dedicated Discounted Items page runtime that fetches product data directly when needed.
- Renders only products/variants with active discounts.
- Applies the discount directly on the discounted product card.
- Opens a dedicated Quick View / Customize modal from the Discounted Items page.
- Loads the discounted size/fabric/color variant automatically.
- Add to Cart from this modal uses the discounted price.

## What was not changed
- Main Shop page behavior
- Admin discount form
- Cart core logic
- Checkout/payment logic
- Reviews
- Analytics
- Menu/Page Builder
- Product publishing
- Auth/permissions
