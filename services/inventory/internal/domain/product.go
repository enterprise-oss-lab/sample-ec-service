package domain

import (
	"context"
	"errors"
)

var ErrProductNotFound = errors.New("product not found")

// Product はカタログ属性を表す。Inventory.Count と違い日〜月単位でしか変わらないため、
// 在庫とは別テーブルに置いてある。この境界がそのままキャッシュの境界になる。
type Product struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Price       int    `json:"price"` // 円 (最小通貨単位)
	ImageURL    string `json:"image_url"`
}

// ProductRepository はカタログの参照を抽象化する。
// 商品登録・更新は管理側の関心なので、ここには読み取りしか置かない。
type ProductRepository interface {
	FindAll(ctx context.Context) ([]*Product, error)
	FindByID(ctx context.Context, id int) (*Product, error)
}
