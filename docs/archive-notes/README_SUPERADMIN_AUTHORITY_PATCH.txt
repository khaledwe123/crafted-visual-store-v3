Crafted Visual Super Admin Authority Patch v20

Changed files:
- server.js
- admin.html
- admin-superadmin-control-fix.js

Upload these files to the GitHub root, overwrite server.js and admin.html, add admin-superadmin-control-fix.js, commit, then redeploy Railway.

After deploy:
1. Open /api/version
2. Confirm: CRAFTED-VISUAL-SUPERADMIN-AUTHORITY-PATCH-20260609-20
3. Clear browser storage:
   localStorage.clear(); sessionStorage.clear(); location.href='/admin-login.html';
4. Login with the admin account.
