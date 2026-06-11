# Crafted Visual — Super Admin & Media Library Fix

## Root causes fixed
1. **Super admin blocked from user management (primary).** `admin.js` called five helpers
   (`enforceSuperAdminRecord`, `persistCurrentAdminSession`, `isOwnerSuperAdminUser`,
   `cloneFullAdminPermissions`, `persistAdminUsers`) that were never defined. `currentAdmin()`
   threw on every call (caught -> returned `null`), so every `currentAdmin()?.role !== "superadmin"`
   check failed and the UI said "Only Super Admin can create users" even when signed in as the owner.
   The helpers are now defined once in admin.js.
2. **User management was localStorage-based.** Create/edit/delete now go through the backend
   (`/api/admin-users`), which is the real authority, so the UI and enforced access cannot diverge.
3. **Privilege escalation.** `POST/PUT/DELETE /api/admin-users` were gated only by `users:write`.
   They are now `superAdminOnly`, so only a super admin can create admins, create other super admins,
   assign/promote roles, or disable accounts. Normal admins keep only their assigned permissions.
4. **No media library.** Added a full backend media library + admin UI.
5. **No server-side session check.** Added `GET /api/admin/me` (authoritative role/permissions).

## Files changed
- server.js   — superAdminOnly guard, /api/admin/me, locked admin-user endpoints, media API, `media` permission.
- schema.js   — `media_assets` and `media_assignments` tables.
- admin.js    — defined missing helpers; backend-backed user management; media UI; `media` in permission lists.
- adminAuthGuard.js — added `media` permission.
- admin.html  — Media Library tab + section, media permission row, bumped script cache-busting versions.
- package.json — added `test` script.
- test/access.test.js — integration tests (new).

## Media library
- `GET /api/media`                         list with metadata + assignments  (media:read)
- `POST /api/media`  (multipart `file`)     upload, validates type+size       (media:write)
- `PUT /api/media/:id`                      update alt text                   (media:write)
- `DELETE /api/media/:id`                   delete file + row + assignments    (media:write)
- `POST /api/media/:id/assign`              assign to product|banner|page|section (media:write)
- `DELETE /api/media/assignments/:id`       remove an assignment              (media:write)
Super admin has full control automatically.

## Commands
Install / migrate / seed (migrations also run automatically on boot):
    npm install
    npm run seed
Run server:
    npm start
Tests:
    npm test
Required env (production): JWT_SECRET (>=32 chars), DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD (>=12 chars).
Cache: bump already applied to admin.js / adminAuthGuard.js query strings; users only need a normal refresh.

## Note on the test environment
Tests run on Node 22 via the built-in experimental `node:sqlite` (the project ships `better-sqlite3`
for its Node 20 production runtime). The `npm test` script passes `--experimental-sqlite` so the suite
runs anywhere; production is unaffected and continues to use `better-sqlite3`.
