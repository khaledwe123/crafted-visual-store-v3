const fs = require('fs');
const { parentPort, workerData } = require('worker_threads');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: workerData.databaseUrl,
  ssl: workerData.isProd ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

function finish(msg, payload) {
  fs.writeFileSync(msg.responseFile, JSON.stringify(payload));
  const view = new Int32Array(msg.signal);
  Atomics.store(view, 0, 1);
  Atomics.notify(view, 0, 1);
}

parentPort.on('message', async (msg) => {
  try {
    if (msg.kind === 'exec') {
      await pool.query(msg.sql);
      return finish(msg, { ok: true, rows: [], rowCount: 0 });
    }
    const result = await pool.query(msg.sql, msg.params || []);
    finish(msg, { ok: true, rows: result.rows || [], rowCount: result.rowCount || 0 });
  } catch (err) {
    finish(msg, { ok: false, error: err.message, sql: msg.sql });
  }
});
