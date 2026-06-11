Crafted Visual Furniture - Prototype Preview Mode

This version is intentionally not connected to a live database.

How product preview works:
1. Open admin.html.
2. Login as Super Admin.
3. Add product and save.
4. Open shop.html from the SAME folder/domain and SAME browser.

Important:
- If admin.html is opened as file:///Users/... and shop.html is opened on Railway, products will NOT sync.
- Browser local storage is separated by origin/domain.
- For prototype testing, use the same source for both pages:
  Option A: local file admin.html + local file shop.html
  Option B: Railway admin.html + Railway shop.html

This prototype stores products in browser storage under cvPrototypeProducts/adminProducts.
When you are ready for real publishing, connect the backend API and database.
