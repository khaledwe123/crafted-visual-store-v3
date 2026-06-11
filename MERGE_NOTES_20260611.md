# Merge Notes - 20260611

Merged `crafted-visual-store-v3-end-to-end-audit-fixed` with the mobile menu/chat dedupe fix.

Preserved:
- Admin creation/deletion/auth fixes from the end-to-end audited package.
- Final responsive admin/mobile CSS.
- Existing backend/security/PostgreSQL configuration.

Added:
- `cv-ui-dedupe-fix.js` in root and public.
- Script loading for dedupe fix on public pages.
- CSS rules to prevent duplicate mobile menus, bottom navs, and Furniture Expert buttons.
