# Frontend Discount Combination Fix

Replace only:

- `script.js`

What changed:

- Adds frontend support for backend/admin `discountRules`.
- Applies discounts for these scopes on the shop frontend:
  - product discount
  - size discount
  - fabric discount
  - color discount
  - size + fabric combination
  - size + fabric + color combination
- Keeps admin login, Arabic button, backend/server, payment, and admin files untouched.

No other file is included in this package.
