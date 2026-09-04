-- カタログ属性 (products) を在庫数 (inventories.count) から分離する。
-- 分離の理由は更新頻度: products は日〜月単位でしか変わらないため長い TTL の
-- キャッシュを被せられる。一方 inventories.count は毎秒減るのでキャッシュできない。
-- 同じレスポンスに混ぜていると、可変な1列のせいで全体をキャッシュできなくなる。
CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    price       INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),  -- 円 (最小通貨単位)
    image_url   TEXT    NOT NULL DEFAULT ''
);
