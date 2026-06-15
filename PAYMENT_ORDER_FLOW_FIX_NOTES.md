# Payment / Order Flow Fix Notes

## Fixed files
- `payment.html`
- `thankyou.html`
- `server.js`

## What was fixed
1. Removed the fake browser-only payment success behavior from `payment.html`.
2. Payment page no longer marks orders as `Paid` automatically.
3. Added backend endpoint `POST /api/orders/:orderNo/payment`.
4. Customer payment method selection now updates the real order in the backend as:
   - `status = awaiting_payment` and `payment_status = awaiting_payment_verification` for bank/card/Geidea options.
   - `status = confirmed` and `payment_status = cod_pending` for Cash on Delivery.
5. Added basic customer email verification before a public payment-method update is accepted.
6. Added CRM activity + automation outbox records when a payment method is selected.
7. Updated the thank-you page to show pending/verification language instead of falsely saying paid.
8. Kept Geidea-ready flow as a placeholder option without collecting live card data on the website.

## Important note for Geidea
This fix prepares the order flow for Geidea, but it does not include live Geidea API credentials or webhook verification. For production, connect Geidea Hosted Checkout from the backend and update orders to `paid` only after Geidea webhook/signature verification.

## Validation performed
- `node --check server.js` passed.
- Full `npm test` could not run in this environment because dependencies were not installed and `better-sqlite3` could not compile/download headers under Node 22. The project requires Node 20.x as stated in `package.json`.
