-- 002_seed_inventories.sql の在庫と 1:1 で対応するカタログ。
-- price / description / image_key はこれまでフロント (features/product/api.ts) で
-- ハードコードされていた値の置き場所。
INSERT INTO products (id, name, description, price, image_key) VALUES
    (1, 'Tシャツ（M）',        '6.2oz ヘビーウェイト天竺。洗濯を繰り返しても首元が伸びにくい。', 2980, NULL),
    (2, 'Tシャツ（L）',        '6.2oz ヘビーウェイト天竺。M より身幅+2cm、着丈+2cm。',        2980, NULL),
    (3, 'デニムパンツ',        '13oz セルビッジデニム。ストレートシルエットで裾上げ無料。',    8900, NULL),
    (4, 'スニーカー（26cm）',  'キャンバスアッパー + ラバーソール。幅は標準ワイズ。',          6400, NULL),
    (5, 'キャップ',            'コットンツイル6パネル。アジャスターで54〜60cmに対応。',        3200, NULL)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(id) FROM products), 0) + 1, false);
