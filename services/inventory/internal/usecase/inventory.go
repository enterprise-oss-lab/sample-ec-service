package usecase

import (
	"context"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

// InventoryUsecase はインベントリに関するビジネスユースケースを定義するインターフェース
type InventoryUsecase interface {
	Reserve(ctx context.Context, id int, quantity int) error
	Restock(ctx context.Context, id int, quantity int) error
	GetInventory(ctx context.Context, id int) (*domain.Inventory, error)
}

type inventoryUsecase struct {
	repo domain.InventoryRepository
}

func NewInventoryUsecase(repo domain.InventoryRepository) InventoryUsecase {
	return &inventoryUsecase{repo: repo}
}

func (u *inventoryUsecase) GetInventory(ctx context.Context, id int) (*domain.Inventory, error) {
	return u.repo.FindByID(ctx, id)
}

func (u *inventoryUsecase) Reserve(ctx context.Context, id int, quantity int) error {
	inv, err := u.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if err := inv.Reserve(quantity); err != nil {
		return err
	}
	return u.repo.Save(ctx, inv)
}

func (u *inventoryUsecase) Restock(ctx context.Context, id int, quantity int) error {
	inv, err := u.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if err := inv.Restock(quantity); err != nil {
		return err
	}
	return u.repo.Save(ctx, inv)
}
