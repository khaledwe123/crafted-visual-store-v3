DB LOCAL START FIX

Upload/replace only this file:
- db.js

What changed:
- Railway/production behavior is unchanged: NODE_ENV=production still requires DATABASE_URL.
- Local development no longer throws immediately when DATABASE_URL is missing.
- If DATABASE_URL is missing locally, the app uses:
  postgres://postgres:postgres@localhost:5432/crafted_visual_local
- You can override this by adding LOCAL_DATABASE_URL in your local .env file.

Important:
- This does not change server.js, package.json, admin files, shop files, or frontend files.
- For local use, PostgreSQL still needs to be running unless you provide a valid LOCAL_DATABASE_URL.
