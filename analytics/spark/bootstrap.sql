CREATE NAMESPACE IF NOT EXISTS analytics.smoke;
DROP TABLE IF EXISTS analytics.smoke.orders;
CREATE TABLE analytics.smoke.orders (
  order_id BIGINT,
  amount BIGINT,
  status STRING
) USING iceberg;
INSERT INTO analytics.smoke.orders VALUES
  (1001, 10, 'CONFIRMED'),
  (1002, 20, 'PENDING');
INSERT INTO analytics.smoke.orders VALUES
  (1003, 30, 'CONFIRMED');
