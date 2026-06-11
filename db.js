const path = require('path');
const fs = require('fs');
const os = require('os');
const { Worker } = require('worker_threads');

require('dotenv').config();

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Add Railway Postgres DATABASE_URL variable before starting the app.');
}

let seq = 0;
const responseDir = path.join(os.tmpdir(), 'cv-pg-sync-responses');
fs.mkdirSync(responseDir, { recursive: true });

const worker = new Worker(path.join(__dirname, 'pg-sync-worker.js'), {
  workerData: {
    databaseUrl: process.env.DATABASE_URL,
    isProd: process.env.NODE_ENV === 'production',
    responseDir
  }
});
worker.on('error', (err) => {
  console.error('PostgreSQL worker error:', err);
});

function convertPlaceholders(sql) {
  let i = 0;
  return String(sql).replace(/\?/g, () => `$${++i}`);
}

function normalizeSql(sql, wantsInsertedId = false) {
  let out = convertPlaceholders(sql)
    .replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'SERIAL PRIMARY KEY')
    .replace(/\bREAL\b/gi, 'NUMERIC')
    .replace(/\bCURRENT_DATE\b/gi, 'CURRENT_DATE')
    .replace(/\bCURRENT_TIMESTAMP\b/gi, 'CURRENT_TIMESTAMP');

  if (wantsInsertedId && /^\s*insert\s+into\s+/i.test(out) && !/\breturning\b/i.test(out) && !/\bon\s+conflict\b/i.test(out)) {
    out = out.replace(/;\s*$/, '') + ' RETURNING id';
  }
  return out;
}

function callWorker(kind, sql, params = []) {
  const id = `${process.pid}-${Date.now()}-${++seq}-${Math.random().toString(16).slice(2)}`;
  const signal = new SharedArrayBuffer(4);
  const view = new Int32Array(signal);
  const responseFile = path.join(responseDir, `${id}.json`);
  worker.postMessage({ id, kind, sql, params, responseFile, signal });
  const result = Atomics.wait(view, 0, 0, 30000);
  if (result === 'timed-out') throw new Error('PostgreSQL query timed out');
  const payload = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
  try { fs.unlinkSync(responseFile); } catch (_) {}
  if (!payload.ok) throw new Error(payload.error || 'PostgreSQL query failed');
  return payload;
}

function prepare(sql) {
  return {
    get: (...params) => {
      const payload = callWorker('all', normalizeSql(sql), params);
      return payload.rows[0];
    },
    all: (...params) => {
      const payload = callWorker('all', normalizeSql(sql), params);
      return payload.rows || [];
    },
    run: (...params) => {
      const payload = callWorker('run', normalizeSql(sql, true), params);
      const row = payload.rows && payload.rows[0];
      return { changes: payload.rowCount || 0, lastInsertRowid: row && row.id ? row.id : undefined };
    }
  };
}

function exec(sql) {
  return callWorker('exec', normalizeSql(sql), []);
}

function transaction(fn) {
  // Existing code uses this as a synchronous callback wrapper. Individual writes are
  // executed by PostgreSQL. Order creation has server-side recalculation and safe inserts.
  return (...args) => fn(...args);
}

module.exports = { prepare, exec, transaction };
