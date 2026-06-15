# Payment / Order Flow Fix

## Files changed
- `payment.html`
- `thankyou.html`
- `server.js`

## What was fixed
The old `payment.html` collected fake card details, pushed the order to browser `localStorage`, and immediately marked the payment as `Paid`.

That has been removed.

## New behavior
1. `review.html` continues to create the backend order using `/api/orders` when the backend is available.
2. `payment.html` now requires backend availability.
3. The customer selects a payment method:
   - Bank Transfer
   - Pay in Showroom
   - Cash on Delivery
   - Geidea
4. The payment method is saved to the backend using:
   - `POST /api/orders/:orderNo/payment-method`
5. The order is **not** marked as paid.
6. Backend statuses become:
   - Manual methods: `payment_status = awaiting_manual_payment`, `status = payment_pending_review`
   - Geidea option: `payment_status = awaiting_gateway_payment`, `status = awaiting_payment`
7. `thankyou.html` now correctly says payment is pending verification.

## Important
This fix does not add live Geidea processing yet because real Geidea merchant API keys and webhook signature verification are required. It prepares the website safely so orders are saved in the backend and are not falsely marked as paid.

## Upload instruction
Replace only these files in your project:
- `payment.html`
- `thankyou.html`
- `server.js`
