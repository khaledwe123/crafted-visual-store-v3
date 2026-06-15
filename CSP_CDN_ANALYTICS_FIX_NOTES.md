# CSP CDN / Analytics Fix

## Files changed
- `server.js` only

## What was fixed
The Helmet Content-Security-Policy was expanded so the existing website can load the analytics/CDN resources already referenced by the site, including:

- Google Tag Manager
- Google Analytics
- Meta/Facebook Pixel
- Tailwind CDN
- Chart.js/CDN JS resources
- Google Fonts

## What was not changed
- No admin files
- No Arabic button files
- No payment files
- No product, discount, cart, or shop logic
- No database logic
- No authentication logic

## Upload instruction
Replace only the root `server.js` file, then redeploy/restart the app.

## Notes
This keeps the current inline-script compatibility because the existing site still uses inline scripts and inline handlers. A stronger future security improvement would be removing inline scripts and then removing `'unsafe-inline'` and `'unsafe-eval'` from CSP.
