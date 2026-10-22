CREATE TABLE IF NOT EXISTS ai_actions (
 id UUID PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('stock_movement','purchase_order')),
 payload JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','cancelled')),
 result JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '15 minutes',
 applied_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ai_actions_expires ON ai_actions(expires_at);
