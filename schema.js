const db = require('./db');
function migrate(){
  db.exec(`
CREATE TABLE IF NOT EXISTS admin_users(
 id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', permissions_json TEXT NOT NULL DEFAULT '{}', active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS customers(
 id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, mobile TEXT, password_hash TEXT,
 city TEXT, address TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories(
 id SERIAL PRIMARY KEY, name_en TEXT NOT NULL UNIQUE, name_ar TEXT, active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products(
 id SERIAL PRIMARY KEY, sku TEXT UNIQUE, name_en TEXT NOT NULL, name_ar TEXT, category_id INTEGER,
 description_en TEXT, description_ar TEXT, base_price NUMERIC DEFAULT 0, vat_rate NUMERIC DEFAULT 15, active INTEGER NOT NULL DEFAULT 1,
 data_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(category_id) REFERENCES categories(id)
);
CREATE TABLE IF NOT EXISTS product_variants(
 id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL, size TEXT, fabric TEXT, color TEXT, color_code TEXT,
 selling_price_before_vat NUMERIC NOT NULL DEFAULT 0, cost NUMERIC NOT NULL DEFAULT 0, stock_qty INTEGER DEFAULT 0, data_json TEXT DEFAULT '{}',
 FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS discount_codes(
 id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, percent NUMERIC NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
 expires_at TEXT, usage_limit INTEGER, usage_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders(
 id SERIAL PRIMARY KEY, order_no TEXT NOT NULL UNIQUE, customer_id INTEGER, customer_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new', payment_status TEXT NOT NULL DEFAULT 'pending', payment_method TEXT,
 city TEXT, address TEXT, notes TEXT, subtotal_before_vat NUMERIC DEFAULT 0, vat_amount NUMERIC DEFAULT 0, delivery_before_vat NUMERIC DEFAULT 0,
 delivery_vat NUMERIC DEFAULT 0, discount_amount NUMERIC DEFAULT 0, total_amount NUMERIC DEFAULT 0, cogs_amount NUMERIC DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE TABLE IF NOT EXISTS order_items(
 id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL, product_id INTEGER, variant_id INTEGER, name TEXT NOT NULL,
 size TEXT, fabric TEXT, color TEXT, qty INTEGER NOT NULL DEFAULT 1, unit_price_before_vat NUMERIC NOT NULL DEFAULT 0, vat_rate NUMERIC DEFAULT 15,
 unit_cost NUMERIC DEFAULT 0, line_total NUMERIC DEFAULT 0, line_cogs NUMERIC DEFAULT 0, data_json TEXT DEFAULT '{}',
 FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS crm_activities(
 id SERIAL PRIMARY KEY, customer_id INTEGER, order_id INTEGER, type TEXT NOT NULL, channel TEXT,
 subject TEXT, body TEXT, status TEXT NOT NULL DEFAULT 'open', metadata_json TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS automation_outbox(
 id SERIAL PRIMARY KEY, order_id INTEGER, customer_id INTEGER, channel TEXT NOT NULL, recipient TEXT NOT NULL,
 subject TEXT, body TEXT NOT NULL, provider_status TEXT NOT NULL DEFAULT 'queued', provider_response TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TEXT
);
CREATE TABLE IF NOT EXISTS expenses(
 id SERIAL PRIMARY KEY, type TEXT NOT NULL DEFAULT 'general', name TEXT NOT NULL, amount NUMERIC NOT NULL, expense_date TEXT NOT NULL DEFAULT CURRENT_DATE, notes TEXT
);

CREATE TABLE IF NOT EXISTS customer_journey_events(
 id SERIAL PRIMARY KEY,
 session_id TEXT NOT NULL,
 customer_id INTEGER,
 event_type TEXT NOT NULL,
 page_url TEXT,
 page_title TEXT,
 product_id INTEGER,
 product_name TEXT,
 source TEXT,
 medium TEXT,
 campaign TEXT,
 term TEXT,
 content TEXT,
 referrer TEXT,
 device TEXT,
 ip_hash TEXT,
 user_agent TEXT,
 metadata_json TEXT DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_journey_session ON customer_journey_events(session_id);
CREATE INDEX IF NOT EXISTS idx_journey_event_type ON customer_journey_events(event_type);
CREATE INDEX IF NOT EXISTS idx_journey_created ON customer_journey_events(created_at);
CREATE TABLE IF NOT EXISTS abandoned_carts(
 id SERIAL PRIMARY KEY,
 session_id TEXT NOT NULL,
 customer_id INTEGER,
 cart_json TEXT NOT NULL DEFAULT '[]',
 source TEXT,
 campaign TEXT,
 status TEXT NOT NULL DEFAULT 'open',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE TABLE IF NOT EXISTS inventory_movements(
 id SERIAL PRIMARY KEY,
 product_id INTEGER,
 variant_id INTEGER,
 movement_type TEXT NOT NULL,
 qty INTEGER NOT NULL DEFAULT 0,
 unit_cost NUMERIC DEFAULT 0,
 notes TEXT,
 created_by INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(product_id) REFERENCES products(id),
 FOREIGN KEY(variant_id) REFERENCES product_variants(id),
 FOREIGN KEY(created_by) REFERENCES admin_users(id)
);
CREATE TABLE IF NOT EXISTS audit_logs(
 id SERIAL PRIMARY KEY,
 admin_id INTEGER,
 action TEXT NOT NULL,
 entity_type TEXT,
 entity_id TEXT,
 ip_hash TEXT,
 metadata_json TEXT DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(admin_id) REFERENCES admin_users(id)
);
CREATE TABLE IF NOT EXISTS product_reviews(
 id SERIAL PRIMARY KEY,
 product_id TEXT NOT NULL,
 customer_name TEXT DEFAULT '',
 rating INTEGER NOT NULL,
 review_text TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'approved',
 ip_hash TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON product_reviews(status);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS media_assets(
 id SERIAL PRIMARY KEY,
 filename TEXT NOT NULL,
 original_name TEXT,
 url TEXT NOT NULL,
 mime TEXT,
 type TEXT NOT NULL DEFAULT 'image',
 size_bytes INTEGER NOT NULL DEFAULT 0,
 alt_text TEXT DEFAULT '',
 uploaded_by INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(uploaded_by) REFERENCES admin_users(id)
);
CREATE TABLE IF NOT EXISTS media_assignments(
 id SERIAL PRIMARY KEY,
 media_id INTEGER NOT NULL,
 target_type TEXT NOT NULL,
 target_id TEXT,
 created_by INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(media_id) REFERENCES media_assets(id) ON DELETE CASCADE,
 FOREIGN KEY(created_by) REFERENCES admin_users(id)
);
CREATE INDEX IF NOT EXISTS idx_media_created ON media_assets(created_at);
CREATE INDEX IF NOT EXISTS idx_media_assign_media ON media_assignments(media_id);
CREATE INDEX IF NOT EXISTS idx_media_assign_target ON media_assignments(target_type, target_id);
`);
}
module.exports = { migrate };
