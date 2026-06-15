Arabic toggle full text coverage fix

Changed file:
- translate-ar.js

Purpose:
- Makes the Arabic toggle translate hardcoded visible text, placeholders, select options, aria labels, and dynamically injected text on pages that load translate-ar.js.
- Fixes partial translation such as Contact page labels: Location, Working Hours, Saturday to Thursday, etc.

Not changed:
- server.js
- admin login/authentication
- discounts
- products
- payment logic
- shop pricing
- CSS/HTML layout
- database

Important:
- This is a translation-layer fix only. It stores original English text in memory and restores it when switching back to English.
