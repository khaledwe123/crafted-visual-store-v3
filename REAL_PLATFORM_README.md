# Crafted Visual — Real Database-Driven Ecommerce Platform

This version upgrades the previous static/localStorage prototype into a backend ecommerce platform.

## What is now included

- **Real database**: SQLite database stored in `data/crafted_visual.sqlite`.
- **Real CRM**: customers, CRM activities, order history, and automation outbox tables.
- **Real Admin Roles**: server-side admin users, JWT login, role and read/write permission enforcement.
- **Real Orders**: order header + line items saved in the database with status and payment status.
- **Real Financial Dashboard API**: sales before VAT, VAT, delivery, COGS, gross profit, margin, expenses, and net profit.
- **Real Email Automation**: queued email notifications, SMTP sending via Nodemailer.
- **Real WhatsApp Automation**: queued WhatsApp notifications, optional Meta WhatsApp Cloud API sending.
- **Secure backend foundation**: Express API, Helmet, JWT, bcrypt password hashing, SQLite schema, and upload endpoint.

## Run locally

```bash
cd crafted_visual_website
npm install
cp .env.example .env
npm start
```

Open:

```text
http://localhost:3000
```

Default admin:

```text
superadmin@craftedvisual.com
Admin@12345
```

## Important before going live

Edit `.env` and change:

```text
JWT_SECRET=change-this-secret-before-live
```

Then add SMTP details for real email automation:

```text
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Crafted Visual <do-not-reply@craftedvisual.com>"
```

For WhatsApp automation, add Meta WhatsApp Cloud API credentials:

```text
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v20.0
```

## API overview

### Admin
- `POST /api/admin/login`
- `GET /api/admin-users`
- `POST /api/admin-users`

### Catalog
- `GET /api/categories`
- `POST /api/categories`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `POST /api/products/:id/variants`

### Discounts
- `GET /api/discounts`
- `POST /api/discounts`
- `GET /api/discounts/validate/:code`

### Orders
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:orderNo`
- `PUT /api/orders/:id/status`

### CRM and automation
- `GET /api/crm`
- `POST /api/outbox/:id/send`

### Finance
- `GET /api/finance/summary`
- `POST /api/expenses`

## Frontend integration

`apiClient.js` was added and included in the key pages. The website now checks for the backend at `/api/health`. If the backend is running, login and order creation are saved to the database. If the backend is not running, the old localStorage prototype remains as a fallback for demo usage.

## Deployment options

Use a Node.js hosting provider such as:

- Render
- Railway
- DigitalOcean App Platform
- AWS Lightsail / EC2
- VPS with PM2 + Nginx

For a small production store, SQLite is acceptable at the beginning. For heavier traffic, migrate the same schema to PostgreSQL.
