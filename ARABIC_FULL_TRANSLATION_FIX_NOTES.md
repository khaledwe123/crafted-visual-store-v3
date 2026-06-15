# Arabic Full Translation Fix

Master source: final-production-clean-folder.zip

Changed file only:
- translate-ar.js

What changed:
- Added an automatic Arabic translation pass for static and dynamic page text when localStorage lang is `ar`.
- Added MutationObserver so text injected after page load is translated.
- Added global brand translation:
  - Crafted Visual → كرافتد فيزوال
  - Crafted Visuals → كرافتد فيزوال
  - Crafted Visual Furniture → كرافتد فيزوال للأثاث
- Added Arabic translations for contact page labels, shop labels, buttons, placeholders, dropdown options, and common furniture terms.

Not touched:
- server.js
- admin.html
- admin login
- discounts
- payment
- products
- shop pricing
- CSS/layout
- database
