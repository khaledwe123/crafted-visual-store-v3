# Legal / Help Pages Backend Control

Added backend-controlled footer legal/help pages.

## New public pages
- privacy-policy.html
- terms-and-conditions.html
- cookie-policy.html
- help.html

These pages render content from CMS settings/custom_pages.

## How to edit content
Open Admin > Page Manager, then edit:
- Privacy Policy
- Terms & Conditions
- Cookie Policy
- Help Center

## What changed
- server.js seeds default editable legal/help pages and footer legal links if missing.
- page-builder.js supports legal page filenames and footer links.
- cv-ui-dedupe-fix.js renders footer legal/help links on public pages.
- Added 4 public page wrappers.

No admin login, discount logic, payment logic, product logic, or database schema was changed.
