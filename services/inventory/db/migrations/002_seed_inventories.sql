INSERT INTO inventories (id, name, count) VALUES
    (1, 'Tシャツ（M）',   100),
    (2, 'Tシャツ（L）',    80),
    (3, 'デニムパンツ',     50),
    (4, 'スニーカー（26cm）', 30),
    (5, 'キャップ',        200)
ON CONFLICT (id) DO NOTHING;
