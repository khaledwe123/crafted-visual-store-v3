/*
 * Integration tests for super admin authority, access control, and the media library.
 * Boots the real server.js against a throwaway database on a random port.
 *
 * Run:  npm test
 *
 * Notes:
 *  - Uses Node's built-in test runner + fetch (Node 18+).
 *  - DATABASE_FILE is pointed at a temp file and removed afterwards.
 *  - DEFAULT_ADMIN_PASSWORD is set so the seeded super admin is deterministic.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 4187 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const TMP_DB = path.join(os.tmpdir(), `cv_test_${Date.now()}.sqlite`);
const OWNER_EMAIL = 'admin@craftedvisual.com';
const OWNER_PASS = 'OwnerPass12345!';


if (!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL) {
  test('PostgreSQL integration tests require DATABASE_URL or TEST_DATABASE_URL', { skip: true }, () => {});
  process.exit(0);
}

let server;

function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      fetch(`${BASE}/api/health`)
        .then(r => (r.ok ? resolve() : retry()))
        .catch(retry);
      function retry() {
        if (Date.now() - start > timeoutMs) return reject(new Error('Server did not start'));
        setTimeout(poll, 200);
      }
    })();
  });
}

async function api(path, { method = 'GET', token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body && !raw) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: raw ? body : (body ? JSON.stringify(body) : undefined),
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
}

test.before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PORT),
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      DEFAULT_ADMIN_EMAIL: OWNER_EMAIL,
      DEFAULT_ADMIN_PASSWORD: OWNER_PASS,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', d => { if (process.env.TEST_VERBOSE) process.stderr.write(d); });
  await waitForHealth();
});

test.after(() => {
  if (server) server.kill('SIGKILL');
  for (const f of [TMP_DB, TMP_DB + '-wal', TMP_DB + '-shm']) {
    try { fs.unlinkSync(f); } catch (_) {}
  }
});

// ---- Authentication ----

test('unauthenticated requests are blocked on protected endpoints', async () => {
  assert.equal((await api('/api/admin-users')).status, 401);
  assert.equal((await api('/api/admin/me')).status, 401);
  assert.equal((await api('/api/media')).status, 401);
  assert.equal((await api('/api/admin-users', { method: 'POST', body: { name: 'x', email: 'x@x.com', password: 'password123' } })).status, 401);
});

test('super admin can log in and is reported as superadmin', async () => {
  const { status, data } = await api('/api/admin/login', { method: 'POST', body: { email: OWNER_EMAIL, password: OWNER_PASS } });
  assert.equal(status, 200);
  assert.ok(data.token, 'token returned');
  assert.equal(String(data.user.role).toLowerCase(), 'superadmin');
});

// Shared state for later tests
const ctx = {};

test('GET /api/admin/me confirms the live superadmin session', async () => {
  const login = await api('/api/admin/login', { method: 'POST', body: { email: OWNER_EMAIL, password: OWNER_PASS } });
  ctx.superToken = login.data.token;
  const me = await api('/api/admin/me', { token: ctx.superToken });
  assert.equal(me.status, 200);
  assert.equal(me.data.isSuperAdmin, true);
  assert.equal(me.data.permissions.media.write, true, 'media permission granted to superadmin');
});

test('super admin can access every protected admin endpoint', async () => {
  for (const p of ['/api/admin-users', '/api/orders', '/api/crm', '/api/finance/summary', '/api/discounts', '/api/media', '/api/audit-logs', '/api/inventory/summary']) {
    const { status } = await api(p, { token: ctx.superToken });
    assert.equal(status, 200, `superadmin should access ${p}`);
  }
});

// ---- User / admin / superadmin creation ----

test('super admin can create a normal admin', async () => {
  const r = await api('/api/admin-users', {
    method: 'POST', token: ctx.superToken,
    body: { name: 'Normal Admin', email: 'normal@cv.com', password: 'normalPass123', role: 'admin', permissions: { products: { read: true, write: true } } },
  });
  assert.equal(r.status, 200);
  assert.ok(r.data.id);
  ctx.adminId = r.data.id;
});

test('super admin can create another super admin', async () => {
  const r = await api('/api/admin-users', {
    method: 'POST', token: ctx.superToken,
    body: { name: 'Second Owner', email: 'owner2@cv.com', password: 'ownerPass123', role: 'superadmin' },
  });
  assert.equal(r.status, 200);
  const login = await api('/api/admin/login', { method: 'POST', body: { email: 'owner2@cv.com', password: 'ownerPass123' } });
  assert.equal(String(login.data.user.role).toLowerCase(), 'superadmin');
});

test('duplicate admin email is rejected', async () => {
  const r = await api('/api/admin-users', {
    method: 'POST', token: ctx.superToken,
    body: { name: 'Dup', email: 'normal@cv.com', password: 'normalPass123', role: 'admin' },
  });
  assert.equal(r.status, 409);
});

// ---- Restricted access for non-super-admins ----

test('a normal admin cannot create or manage admin accounts (no privilege escalation)', async () => {
  const login = await api('/api/admin/login', { method: 'POST', body: { email: 'normal@cv.com', password: 'normalPass123' } });
  ctx.adminToken = login.data.token;

  // Cannot create users at all (user management is superadmin-only)
  const create = await api('/api/admin-users', {
    method: 'POST', token: ctx.adminToken,
    body: { name: 'Escalated', email: 'evil@cv.com', password: 'evilPass123', role: 'superadmin' },
  });
  assert.equal(create.status, 403, 'normal admin must not create users');

  // Cannot promote anyone to superadmin
  const promote = await api(`/api/admin-users/${ctx.adminId}`, {
    method: 'PUT', token: ctx.adminToken, body: { role: 'superadmin' },
  });
  assert.equal(promote.status, 403, 'normal admin must not promote roles');

  // Cannot delete users
  const del = await api(`/api/admin-users/${ctx.adminId}`, { method: 'DELETE', token: ctx.adminToken });
  assert.equal(del.status, 403, 'normal admin must not delete users');
});

test('a normal admin only has its assigned permissions', async () => {
  // Was granted products only; finance was not granted.
  const prodBody = { sku: 'T-1', name_en: 'Test', name_ar: '', category_name: '', description_en: '', description_ar: '', base_price: 10, vat_rate: 15, active: true, data: {} };
  assert.equal((await api('/api/products', { method: 'POST', token: ctx.adminToken, body: prodBody })).status, 200);
  assert.equal((await api('/api/finance/summary', { token: ctx.adminToken })).status, 403);
  assert.equal((await api('/api/media', { token: ctx.adminToken })).status, 403, 'no media permission -> blocked');
});

// ---- Owner protections ----

test('the system owner cannot be demoted or deleted', async () => {
  const owner = await api('/api/admin-users', { token: ctx.superToken });
  const ownerRow = owner.data.find(u => u.email === OWNER_EMAIL);
  assert.ok(ownerRow);
  assert.equal((await api(`/api/admin-users/${ownerRow.id}`, { method: 'PUT', token: ctx.superToken, body: { role: 'admin' } })).status, 400);
  assert.equal((await api(`/api/admin-users/${ownerRow.id}`, { method: 'DELETE', token: ctx.superToken })).status, 400);
});

// ---- Media library ----

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function uploadImage(token, altText) {
  const form = new FormData();
  form.append('file', new Blob([PNG_1x1], { type: 'image/png' }), 'pixel.png');
  if (altText) form.append('alt_text', altText);
  const res = await fetch(BASE + '/api/media', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
  return { status: res.status, data: await res.json().catch(() => null) };
}

test('super admin can upload an image with metadata', async () => {
  const r = await uploadImage(ctx.superToken, 'A test pixel');
  assert.equal(r.status, 200);
  assert.ok(r.data.id);
  assert.match(r.data.url, /^\/uploads\//);
  assert.equal(r.data.alt_text, 'A test pixel');
  assert.equal(r.data.mime, 'image/png');
  assert.ok(r.data.size_bytes > 0);
  ctx.mediaId = r.data.id;
});

test('media listing returns the uploaded asset', async () => {
  const r = await api('/api/media', { token: ctx.superToken });
  assert.equal(r.status, 200);
  assert.ok(r.data.some(m => m.id === ctx.mediaId));
});

test('a non-image upload is rejected', async () => {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from('not an image')], { type: 'text/plain' }), 'bad.txt');
  const res = await fetch(BASE + '/api/media', { method: 'POST', headers: { Authorization: 'Bearer ' + ctx.superToken }, body: form });
  assert.equal(res.status, 400);
});

test('an image can be assigned to a product, banner, and section', async () => {
  // product (use the SKU created earlier)
  const prod = await api(`/api/media/${ctx.mediaId}/assign`, { method: 'POST', token: ctx.superToken, body: { target_type: 'product', target_id: 'T-1' } });
  assert.equal(prod.status, 200);
  // banner slot 1
  const banner = await api(`/api/media/${ctx.mediaId}/assign`, { method: 'POST', token: ctx.superToken, body: { target_type: 'banner', target_id: '1' } });
  assert.equal(banner.status, 200);
  // section
  const section = await api(`/api/media/${ctx.mediaId}/assign`, { method: 'POST', token: ctx.superToken, body: { target_type: 'section', target_id: 'home-hero' } });
  assert.equal(section.status, 200);

  // invalid target type rejected
  const bad = await api(`/api/media/${ctx.mediaId}/assign`, { method: 'POST', token: ctx.superToken, body: { target_type: 'spaceship', target_id: '1' } });
  assert.equal(bad.status, 400);

  // assignment reflected in listing
  const list = await api('/api/media', { token: ctx.superToken });
  const asset = list.data.find(m => m.id === ctx.mediaId);
  assert.ok(asset.assignments.length >= 3);
});

test('super admin can delete media', async () => {
  assert.equal((await api(`/api/media/${ctx.mediaId}`, { method: 'DELETE', token: ctx.superToken })).status, 200);
  const list = await api('/api/media', { token: ctx.superToken });
  assert.ok(!list.data.some(m => m.id === ctx.mediaId));
});
