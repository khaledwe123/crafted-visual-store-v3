POSTGRES + RAILWAY READY PACKAGE

This package is prepared for Railway PostgreSQL deployment.

Required Railway variables on the website service:
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}} or ${{Postgres.DATABASE_PRIVATE_URL}}
JWT_SECRET=your-long-random-secret-32-plus-characters
DEFAULT_ADMIN_EMAIL=admin@craftedvisual.com
DEFAULT_ADMIN_PASSWORD=change-this-to-a-new-strong-password
ALLOWED_ORIGINS=https://your-railway-domain.up.railway.app

Important:
1. ALLOWED_ORIGINS must include https://
2. Change DEFAULT_ADMIN_PASSWORD before deploying.
3. Upload these extracted files to GitHub, not the ZIP itself.
4. Railway will install dependencies from package.json. This version uses pg, not better-sqlite3.
5. On first deploy, the server creates the PostgreSQL tables automatically.

Railway start command:
npm start
