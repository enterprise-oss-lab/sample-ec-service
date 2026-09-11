package cache

import (
	"context"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

type InventoryCache interface {
	GetAll(ctx context.Context) ([]*domain.Inventory, error)
	SetAll(ctx context.Context, inventories []*domain.Inventory) error
	Get(ctx context.Context, id int) (*domain.Inventory, error)
	Set(ctx context.Context, inventory *domain.Inventory) error
	Delete(ctx context.Context, ids ...int) error
}

// InventoryRepository adds best-effort cache-aside behavior to a persistent
// inventory repository. Cache failures never make the inventory API fail.
type InventoryRepository struct {
	next  domain.InventoryRepository
	cache InventoryCache
}

func NewInventoryRepository(next domain.InventoryRepository, cache InventoryCache) domain.InventoryRepository {
	return &InventoryRepository{next: next, cache: cache}
}

func (r *InventoryRepository) FindAll(ctx context.Context) ([]*domain.Inventory, error) {
	if inventories, err := r.cache.GetAll(ctx); err == nil {
		return inventories, nil
	}

	inventories, err := r.next.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	_ = r.cache.SetAll(ctx, inventories)
	return inventories, nil
}

func (r *InventoryRepository) FindByID(ctx context.Context, id int) (*domain.Inventory, error) {
	if inventory, err := r.cache.Get(ctx, id); err == nil {
		return inventory, nil
	}

	inventory, err := r.next.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	_ = r.cache.Set(ctx, inventory)
	return inventory, nil
}

func (r *InventoryRepository) Save(ctx context.Context, inventory *domain.Inventory) error {
	if err := r.next.Save(ctx, inventory); err != nil {
		return err
	}
	_ = r.cache.Delete(ctx, inventory.ID)
	return nil
}

func (r *InventoryRepository) RunInTx(ctx context.Context, fn func(domain.InventoryRepository) error) error {
	changed := make(map[int]struct{})
	err := r.next.RunInTx(ctx, func(txRepo domain.InventoryRepository) error {
		// Never serve cached values while holding a database transaction. Stock
		// updates must read the row locked by the persistent repository.
		return fn(&transactionRepository{next: txRepo, changed: changed})
	})
	if err != nil {
		return err
	}

	ids := make([]int, 0, len(changed))
	for id := range changed {
		ids = append(ids, id)
	}
	if len(ids) > 0 {
		_ = r.cache.Delete(ctx, ids...)
	}
	return nil
}

type transactionRepository struct {
	next    domain.InventoryRepository
	changed map[int]struct{}
}

func (r *transactionRepository) FindAll(ctx context.Context) ([]*domain.Inventory, error) {
	return r.next.FindAll(ctx)
}

func (r *transactionRepository) FindByID(ctx context.Context, id int) (*domain.Inventory, error) {
	return r.next.FindByID(ctx, id)
}

func (r *transactionRepository) Save(ctx context.Context, inventory *domain.Inventory) error {
	if err := r.next.Save(ctx, inventory); err != nil {
		return err
	}
	r.changed[inventory.ID] = struct{}{}
	return nil
}

func (r *transactionRepository) RunInTx(ctx context.Context, fn func(domain.InventoryRepository) error) error {
	return fn(r)
}
