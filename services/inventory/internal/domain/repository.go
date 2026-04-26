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
}
