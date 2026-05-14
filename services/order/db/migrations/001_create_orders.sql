CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS orders (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id    TEXT        NOT NULL,
    status         TEXT        NOT NULL DEFAULT 'pending',
    correlation_id TEXT        NOT NULL UNIQUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id           SERIAL  PRIMARY KEY,
    order_id     UUID    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    inventory_id INTEGER NOT NULL,
    quantity     INTEGER NOT NULL
);
