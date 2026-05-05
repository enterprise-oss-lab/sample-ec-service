package domain

import (
	"context"
	"errors"
)

var ErrNotFound = errors.New("inventory not found")

// InventoryRepository は在庫データの永続化を抽象化するインターフェース
type InventoryRepository interface {
	FindByID(ctx context.Context, id int) (*Inventory, error)
	Save(ctx context.Context, inv *Inventory) error
	// RunInTx はトランザクション内で fn を実行する。fn に渡されるリポジトリは
	// SELECT FOR UPDATE でロックを取得するため、並行更新からの保護に使用する。
	RunInTx(ctx context.Context, fn func(txRepo InventoryRepository) error) error
}
