ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_quantity INTEGER NOT NULL DEFAULT 0;
UPDATE purchase_orders SET received_quantity=quantity WHERE status='received' AND received_quantity=0;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES purchase_orders(id);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2);
UPDATE movements m SET order_id=o.id FROM purchase_orders o
 WHERE m.order_id IS NULL AND m.kind='receipt' AND m.product_id=o.product_id AND m.note='Purchase order #' || o.id::text;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='purchase_orders_received_quantity_check') THEN
 ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_received_quantity_check CHECK(received_quantity BETWEEN 0 AND quantity);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='movements_unit_cost_check') THEN
 ALTER TABLE movements ADD CONSTRAINT movements_unit_cost_check CHECK(unit_cost IS NULL OR unit_cost>=0);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','staff','viewer')), active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (
 id BIGSERIAL PRIMARY KEY, entity TEXT NOT NULL, record_id INTEGER NOT NULL,
 operation TEXT NOT NULL, actor TEXT NOT NULL, before_data JSONB, after_data JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS audit_log_created ON audit_log(created_at DESC,id DESC);
CREATE OR REPLACE FUNCTION record_inventory_change() RETURNS trigger AS $$
DECLARE old_row JSONB; new_row JSONB;
BEGIN
 IF TG_OP <> 'INSERT' THEN old_row=to_jsonb(OLD); END IF;
 IF TG_OP <> 'DELETE' THEN new_row=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='users' THEN old_row=old_row-'password_hash';new_row=new_row-'password_hash'; END IF;
 IF old_row IS NOT DISTINCT FROM new_row THEN RETURN NULL; END IF;
 INSERT INTO audit_log(entity,record_id,operation,actor,before_data,after_data)
 VALUES(TG_TABLE_NAME,COALESCE((new_row->>'id')::integer,(old_row->>'id')::integer),TG_OP,
 COALESCE(NULLIF(current_setting('app.actor',true),''),'system'),old_row,new_row);
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['products','suppliers','movements','purchase_orders','users'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS inventory_change ON %I',table_name);
 EXECUTE format('CREATE TRIGGER inventory_change AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION record_inventory_change()',table_name);
 END LOOP;
END $$;
