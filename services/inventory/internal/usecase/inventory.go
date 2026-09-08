package usecase

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

// InventoryUsecase はインベントリに関するビジネスユースケースを定義するインターフェース
type InventoryUsecase interface {
	ListInventories(ctx context.Context) ([]*domain.Inventory, error)
	Reserve(ctx context.Context, id int, quantity int) error
	Restock(ctx context.Context, id int, quantity int) error
	GetInventory(ctx context.Context, id int) (*domain.Inventory, error)
	// AdjustStock は在庫数を delta 分変化させる（負の delta も許可）。
	// delta >= 0 は Restock、delta < 0 は Reserve に読み替えて既存の在庫保護に乗せる。
	AdjustStock(ctx context.Context, id int, delta int) error
}

type inventoryUsecase struct {
	repo domain.InventoryRepository
	// reservations counts reservation attempts, split by result=success|failure.
	reservations metric.Int64Counter
}

func NewInventoryUsecase(repo domain.InventoryRepository) InventoryUsecase {
	meter := otel.Meter("enterprise-oss-lab/sample-ec-service/inventry/usecase")
	// A no-op counter is returned on error, so this is always safe to call.
	reservations, _ := meter.Int64Counter(
		"inventory.reservations",
		metric.WithDescription("Number of inventory reservation attempts by result"),
		metric.WithUnit("{reservation}"),
	)
	return &inventoryUsecase{repo: repo, reservations: reservations}
}

func (u *inventoryUsecase) ListInventories(ctx context.Context) ([]*domain.Inventory, error) {
	return u.repo.FindAll(ctx)
}

func (u *inventoryUsecase) GetInventory(ctx context.Context, id int) (*domain.Inventory, error) {
	return u.repo.FindByID(ctx, id)
}

func (u *inventoryUsecase) Reserve(ctx context.Context, id int, quantity int) error {
	err := u.repo.RunInTx(ctx, func(txRepo domain.InventoryRepository) error {
		inv, err := txRepo.FindByID(ctx, id)
		if err != nil {
			return err
		}
		if err := inv.Reserve(quantity); err != nil {
			return err
		}
		return txRepo.Save(ctx, inv)
	})

	result := "success"
	if err != nil {
		result = "failure"
	}
	if u.reservations != nil {
		u.reservations.Add(ctx, 1, metric.WithAttributes(attribute.String("result", result)))
	}

	return err
}

func (u *inventoryUsecase) Restock(ctx context.Context, id int, quantity int) error {
	return u.repo.RunInTx(ctx, func(txRepo domain.InventoryRepository) error {
		inv, err := txRepo.FindByID(ctx, id)
		if err != nil {
			return err
		}
		if err := inv.Restock(quantity); err != nil {
			return err
		}
		return txRepo.Save(ctx, inv)
	})
}

func (u *inventoryUsecase) AdjustStock(ctx context.Context, id int, delta int) error {
	return u.repo.RunInTx(ctx, func(txRepo domain.InventoryRepository) error {
		inv, err := txRepo.FindByID(ctx, id)
		if err != nil {
			return err
		}
		if delta >= 0 {
			if err := inv.Restock(delta); err != nil {
				return err
			}
		} else {
			if err := inv.Reserve(-delta); err != nil {
				return err
			}
		}
		return txRepo.Save(ctx, inv)
	})
}
