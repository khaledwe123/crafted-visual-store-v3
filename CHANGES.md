# Crafted Visual — Corrected Files Patch Set

This zip contains **only the files that were modified**, with their original relative
paths preserved, so you can drop them into your existing repo and commit. It does
**not** contain the full project (per request, to save tokens/data).

## How to apply
1. Copy each file in this zip into the matching path in your project root, overwriting
   the existing file.
2. Apply the deletions listed below manually (delete these files/folders from your repo —
   they are dead code and are intentionally NOT included in this zip).
3. Run `npm install` (no new dependencies were added) and redeploy as usual.
4. If you use Postgres migrations on boot, `schema.js` will auto-add the two new
   `customers` columns (`reset_token_hash`, `reset_token_expires`) via
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

## Files modified (included in this zip)
- `.gitignore` — renamed from `gitignore` (was missing the leading dot, so Git never
  actually honored it; `.env`, `uploads/`, etc. were not being ignored).
- `responsive-all-devices.js` — removed a byte-for-byte duplicate IIFE block that was
  building the mobile menu/bottom-nav/sticky-CTA twice and running two redundant
  `setInterval(1000ms)` polling loops.
- `ux95-final-visible.js` — fixed wishlist localStorage key mismatch
  (`cv_wishlist` → `cv_wishlist_ids`) so the wishlist count/state shown by this widget
  stays in sync with the main wishlist feature in `customer-journey-95.js`.
- `cv-analytics-loader.js` — added a consent gate (`cv_consent_analytics` localStorage
  flag). GA4/GTM/Meta Pixel no longer load automatically on every page view; they only
  load after consent is granted (dispatch a `cv-consent-updated` window event once your
  consent banner sets `localStorage.cv_consent_analytics = 'granted'`).
- `customer-journey-dashboard.html` — added the missing `adminAuthGuard.js` script tag
  (every other admin page has it; this one didn't, so an expired/missing admin session
  wasn't redirected to login client-side).
- `schema.js` — added `reset_token_hash` / `reset_token_expires` columns to `customers`
  to support real password-reset tokens.
- `server.js` — `/api/customers/forgot-password` now actually generates a reset token,
  stores its hash with a 1-hour expiry, and emails a real reset link via
  `automation.js` (`sendEmailNow`) instead of just logging a CRM note that a human had
  to act on manually. Added a new `/api/customers/reset-password` endpoint that
  verifies the token/expiry and updates the password hash.

## Files deleted (apply this deletion yourself — not included in the zip)
Dead/orphaned admin "fix" files not referenced by any HTML page (`admin.html` only
loads 8 scripts; these were leftover patch-on-patch files from earlier hotfixes):
- `admin-authority-final.js`
- `admin-create-user-live-fix.js`
- `admin-menu-compat.js`
- `admin-stable-final-fix.js`
- `admin-superadmin-control-fix.js`
- `admin-users-delete-live-final.js`
- `admin-users-live-final.js`
- `admin-workflow-fix-v34.js`

Duplicate file (root-level copy was unused; `public/quickview-final-fix.js` is the one
actually served by `server.js`'s static asset resolver):
- `quickview-final-fix.js` (root level only — keep `public/quickview-final-fix.js`)

Empty placeholder directories with no files in them:
- `security/`, `analytics/`, `crm/`, `inventory/`

## Known follow-ups not covered in this patch (flagged in the audit, left out to limit scope/risk)
- No frontend "Forgot password" / "Reset password" UI was added; only the backend
  endpoints exist now (`POST /api/customers/forgot-password`,
  `POST /api/customers/reset-password`). Wire a form on `account.html` that posts to
  these.
- No consent-banner UI was added for `cv_consent_analytics`; only the gate in
  `cv-analytics-loader.js` was added. Add a simple banner that sets
  `localStorage.cv_consent_analytics = 'granted'` and dispatches
  `window.dispatchEvent(new Event('cv-consent-updated'))`.
- `cv-ui-dedupe-fix.js`'s perpetual `setInterval`/`MutationObserver` cleanup was left
  in place as a safety net; only one of the three duplicate-producing sources
  (`responsive-all-devices.js`) was de-duplicated at the root in this pass. Removing
  the other duplicate builders (`cv-premium-journey.js`, `ux95-final-visible.js`
  overlapping widgets) needs a closer look before deleting the dedupe net, so it was
  left untouched to avoid regressions.
- `test/access.test.js` was reviewed; its DB-required skip logic is correct as written
  and was left unchanged.
