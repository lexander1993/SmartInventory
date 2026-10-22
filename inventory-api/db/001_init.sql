CREATE TABLE IF NOT EXISTS suppliers (
 id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', lead_days INTEGER NOT NULL DEFAULT 7 CHECK(lead_days BETWEEN 0 AND 365));
CREATE TABLE IF NOT EXISTS products (
 id SERIAL PRIMARY KEY, sku TEXT NOT NULL UNIQUE, barcode TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT 'General', supplier_id INTEGER REFERENCES suppliers(id),
 cost NUMERIC(12,2) NOT NULL CHECK(cost>=0), price NUMERIC(12,2) NOT NULL CHECK(price>=0),
 stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), min_stock INTEGER NOT NULL DEFAULT 5 CHECK(min_stock>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS movements (
 id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), kind TEXT NOT NULL CHECK(kind IN ('sale','receipt','adjustment')),
 quantity INTEGER NOT NULL CHECK(quantity<>0), unit_price NUMERIC(12,2) NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS movements_product_date ON movements(product_id,created_at);
CREATE TABLE IF NOT EXISTS alerts (
 product_id INTEGER PRIMARY KEY REFERENCES products(id), message TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS purchase_orders (
 id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
 quantity INTEGER NOT NULL CHECK(quantity>0), status TEXT NOT NULL DEFAULT 'ordered' CHECK(status IN ('ordered','received')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), received_at TIMESTAMPTZ);
