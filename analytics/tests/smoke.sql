DROP TABLE IF EXISTS iceberg.bronze.catalog_smoke;
CREATE TABLE iceberg.bronze.catalog_smoke (
  event_id VARCHAR,
  amount BIGINT
);
INSERT INTO iceberg.bronze.catalog_smoke VALUES
  ('event-1', 10),
  ('event-2', 20),
  ('event-3', 30);
