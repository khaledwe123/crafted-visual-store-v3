# Maintainability Cleanup Report - 2026-06-11

## What changed

- Consolidated Admin UI loading to a single active bundle: `admin-core-consolidated.js`.
- Synchronized `public/admin.html` with root `admin.html` so Railway serves the same consolidated Admin UI.
- Removed obsolete legacy admin patch files from both root and `public/`:
  - `admin.js`
  - `admin-workflow-fix-v34.js`
  - `admin-stable-final-fix.js`
  - `admin-authority-final.js`
  - `admin-menu-compat.js`
  - `admin-superadmin-control-fix.js`
  - `admin-users-live-final.js`
  - `admin-users-delete-live-final.js`
  - `admin-create-user-live-fix.js`
- Moved old patch/readme notes into `docs/archive-notes/` to reduce root-folder noise.
- Added a real `.gitignore` and removed the incorrectly named `gitignore` file.
- Updated server static serving so production serves frontend assets from `public/` instead of falling back to root files.

## Why this matters

This reduces future conflicts, prevents old admin code from being accidentally loaded, makes deployment behavior deterministic, and improves maintainability without changing the user interface or business flow.

## Preserved

- Super Admin authentication and permissions.
- Admin/Super Admin creation and deletion protections.
- HttpOnly cookie authentication.
- PostgreSQL integration.
- Cloudinary/S3 upload support.
- Audit logs.
- Existing page design and customer/admin flow.
