# CHANGELOG_AUTH_ARABIC_ONLY

## Scope
Corrected files only for Arabic translation on authentication pages.

## Files changed
- auth.html
- public/auth.html
- admin-login.html
- public/admin-login.html

## Changes
- Added a safe Arabic localization layer for the customer Sign In / Sign Up / Forgot Password page.
- Arabic is applied when `localStorage.lang` is `ar` or when the URL contains `?lang=ar`.
- The active mode title and submit button now remain Arabic when switching between Sign In, Sign Up, and Forgot Password.
- Auth field placeholders, captcha text, forgot password instructions, and common status messages now display in Arabic.
- Added the same Arabic language handling for the Admin Login page.

## Not changed
- Shop
- Discounts
- Cart
- Checkout
- Reviews
- Analytics
- Menu Control
- Page Builder
- Product publishing
- Quick View / Customize
- Database
- Railway configuration

## Effect
The sign-in/auth pages no longer fall back to English when the site language is Arabic.
