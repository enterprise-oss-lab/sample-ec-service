package domain

import (
	"context"
	"errors"
)

var ErrNotFound = errors.New("inventory not found")

// InventoryRepository は在庫データの永続化を抽象化するインターフェース
type InventoryRepository interface {
	FindAll(ctx context.Context) ([]*Inventory, error)
	FindByID(ctx context.Context, id int) (*Inventory, error)
	Save(ctx context.Context, inv *Inventory) error
	// Create は新規商品を1件作成する。成功時 inv.ID に生成された id を設定する。
	Create(ctx context.Context, inv *Inventory) error
	// Update は名前・価格・説明・画像キーのみを更新する（count には触れない）。
	Update(ctx context.Context, inv *Inventory) error
	Delete(ctx context.Context, id int) error
	// RunInTx はトランザクション内で fn を実行する。fn に渡されるリポジトリは
	// SELECT FOR UPDATE でロックを取得するため、並行更新からの保護に使用する。
	RunInTx(ctx context.Context, fn func(txRepo InventoryRepository) error) error
}
