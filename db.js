const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

require('dotenv').config();

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const dbFile = process.env.DATABASE_FILE || path.join(dataDir, 'crafted_visual.sqlite');

const db = new Database(dbFile);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
