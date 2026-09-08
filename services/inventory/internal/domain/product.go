package domain

import (
	"context"
	"errors"
	"time"
)

var ErrProductNotFound = errors.New("product not found")

// Product はカタログ属性を表す。Inventory.Count と違い日〜月単位でしか変わらないため、
// 在庫とは別テーブルに置いてある。この境界がそのままキャッシュの境界になる。
type Product struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       int       `json:"price"` // 円 (最小通貨単位)
	ImageKey    *string   `json:"image_key"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ProductRepository はカタログの参照と管理操作を抽象化する。
// 在庫との分離を保ちつつ、作成・削除時だけ両テーブルを同一トランザクションで扱う。
type ProductRepository interface {
	FindAll(ctx context.Context) ([]*Product, error)
	FindByID(ctx context.Context, id int) (*Product, error)
	// Create は商品と初期在庫を同じトランザクションで作成する。
	Create(ctx context.Context, product *Product, initialCount int) error
	Update(ctx context.Context, product *Product) error
	// Delete は在庫を先に削除してから商品を削除する。
	Delete(ctx context.Context, id int) error
}
