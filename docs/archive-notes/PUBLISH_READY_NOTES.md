# Crafted Visual publish-ready package

This package is prepared for online deployment without changing the website look, feel, or customer/admin flow.

## Production environment variables required

Set these on Railway or your hosting provider before deploying:

- `NODE_ENV=production`
- `JWT_SECRET=` a random value of at least 32 characters
- `ALLOWED_ORIGINS=https://your-domain.com` comma-separated if more than one domain
- `DEFAULT_ADMIN_EMAIL=admin@craftedvisual.com` or your owner admin email
- Optional: `MAX_UPLOAD_MB=5`
- Optional email/WhatsApp provider variables if automation sending is needed

## Install and run

Use Node 20.x, then run:

```bash
npm ci
npm start
```

## Verification commands

```bash
npm ci
npm test
```

Tests could not be run inside the ChatGPT container because this environment uses Node 22 and cannot download/build the native `better-sqlite3` binding offline. The project declares Node 20.x, which is the intended deployment runtime.

## Security hardening included

- Public static serving is restricted to `/public` only.
- Admin/customer auth uses HttpOnly cookies in production.
- Browser localStorage no longer stores production admin/customer JWTs.
- Server recalculates checkout prices, VAT, discounts, COGS, and delivery from backend data.
- Discount code usage increments during order creation.
- Uploads validate MIME type and image file signatures.
- Production requires strong `JWT_SECRET` and explicit `ALLOWED_ORIGINS`.
- Removed `eval()` usage from admin workflow fixes.
- Added backend password reset request endpoint.
