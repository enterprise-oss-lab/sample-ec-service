-- 商品名などのカタログ属性は products テーブル側 (id で 1:1)。
-- ここには在庫数の管理に要る列だけを置く。
CREATE TABLE IF NOT EXISTS inventories (
    id    INTEGER PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0)
);
