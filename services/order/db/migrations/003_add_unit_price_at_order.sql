ALTER TABLE order_items
    ADD COLUMN unit_price_at_order INTEGER;

-- Existing demo orders predate price snapshots, so their historical price is unknown.
UPDATE order_items SET unit_price_at_order = 0;

ALTER TABLE order_items
    ALTER COLUMN unit_price_at_order SET NOT NULL,
    ADD CONSTRAINT order_items_unit_price_at_order_nonnegative
        CHECK (unit_price_at_order >= 0);
