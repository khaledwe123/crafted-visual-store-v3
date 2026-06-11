# Security Hardening Notes - 2026-06-11

Implemented:
- Admin/customer JWTs are issued as HttpOnly SameSite cookies. In production the API no longer returns the real admin JWT to JavaScript.
- Legacy browser token keys now store only the non-secret marker `cookie-auth` so old admin scripts can continue working without exposing the JWT.
- Uploads support persistent Cloudinary or S3 storage through environment variables while keeping local upload fallback for development.
- CSP is tightened for scripts: inline script blocks receive a per-request nonce, and inline event attributes are disabled with `script-src-attr 'none'`.
- A CSP action bridge converts legacy `onclick`/`onchange`/`oninput` attributes into safe event listeners for compatibility.
- Added Audit Logs page at `/audit-logs.html` backed by `/api/audit-logs`.

Required Railway variables for Cloudinary:
- `UPLOAD_PROVIDER=cloudinary`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- optional `CLOUDINARY_FOLDER`

Required Railway variables for S3:
- `UPLOAD_PROVIDER=s3`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- optional `AWS_S3_PREFIX`
- optional `AWS_PUBLIC_BASE_URL`

Validation:
- `node --check` passed for modified JS files.
- `npm test` passed.
- `npm audit --omit=dev` returned 0 vulnerabilities.
