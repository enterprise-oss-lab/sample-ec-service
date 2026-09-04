INSERT INTO inventories (id, count) VALUES
    (1, 100),
    (2,  80),
    (3,  50),
    (4,  30),
    (5, 200)
ON CONFLICT (id) DO NOTHING;
