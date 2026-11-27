-- confirmed_at is UTC; amounts are integer JPY, before discounts/tax handling.
SELECT
    CAST(confirmed_at AS DATE) AS sales_date,
    inventory_id,
    SUM(quantity) AS quantity,
    SUM(net_amount) AS net_amount
FROM iceberg.gold.fact_order_line
GROUP BY 1, 2
ORDER BY 1, 2;
