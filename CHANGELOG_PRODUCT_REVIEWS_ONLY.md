# Product Reviews Targeted Change Log

## Scope
Enabled customer product ratings and written reviews in the shop/customer product view only.

## Files Changed

| File | Change | Effect |
|---|---|---|
| `server.js` | Added `product_reviews` table auto-check/creation and public review API endpoints: `GET /api/product-reviews` and `POST /api/product-reviews`. | Customer reviews are stored persistently in the database and loaded for all customers. The endpoint fails safely with an empty review set instead of crashing. |
| `product-reviews.js` | Rebuilt customer review frontend module. | Customers can rate products, write reviews, and view all reviews from other customers inside the product modal. Review summaries update the visible star rating. |
| `public/product-reviews.js` | Same frontend review module for Railway/public build alignment. | Ensures deployed/public builds load the same review behavior. |
| `shop.html` | Added script reference to `product-reviews.js`. | Activates review functionality on the shop page. |
| `public/shop.html` | Added script reference to `product-reviews.js`. | Ensures deployed/public shop page activates review functionality. |

## What Was Not Changed
- Shop product rendering logic
- Quick View / Customize handlers
- Cart logic
- Discount logic
- Checkout logic
- Product publishing logic
- Admin dashboard logic
- Styling files
- Database schema unrelated to reviews

## Testing Notes
- `node -c server.js` passed.
- `node -c product-reviews.js` passed.
- Review API is designed to auto-create the review table if missing.
- If the API is unavailable, the review is temporarily saved in browser localStorage so the customer is not blocked.
