package cache

import (
	"context"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

type ProductCache interface {
	GetAll(ctx context.Context) ([]*domain.Product, error)
	SetAll(ctx context.Context, products []*domain.Product) error
	Get(ctx context.Context, id int) (*domain.Product, error)
	Set(ctx context.Context, product *domain.Product) error
	Delete(ctx context.Context, ids ...int) error
}

type InventoryInvalidator interface {
	Delete(ctx context.Context, ids ...int) error
}

type ProductRepository struct {
	next                 domain.ProductRepository
	cache                ProductCache
	inventoryInvalidator InventoryInvalidator
}

func NewProductRepository(next domain.ProductRepository, cache ProductCache, inventoryInvalidator InventoryInvalidator) domain.ProductRepository {
	return &ProductRepository{next: next, cache: cache, inventoryInvalidator: inventoryInvalidator}
}

func (r *ProductRepository) FindAll(ctx context.Context) ([]*domain.Product, error) {
	if products, err := r.cache.GetAll(ctx); err == nil {
		return products, nil
	}
	products, err := r.next.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	_ = r.cache.SetAll(ctx, products)
	return products, nil
}

func (r *ProductRepository) FindByID(ctx context.Context, id int) (*domain.Product, error) {
	if product, err := r.cache.Get(ctx, id); err == nil {
		return product, nil
	}
	product, err := r.next.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	_ = r.cache.Set(ctx, product)
	return product, nil
}

func (r *ProductRepository) Create(ctx context.Context, product *domain.Product, initialCount int) error {
	if err := r.next.Create(ctx, product, initialCount); err != nil {
		return err
	}
	r.invalidate(ctx, product.ID)
	return nil
}

func (r *ProductRepository) Update(ctx context.Context, product *domain.Product) error {
	if err := r.next.Update(ctx, product); err != nil {
		return err
	}
	_ = r.cache.Delete(ctx, product.ID)
	return nil
}

func (r *ProductRepository) Delete(ctx context.Context, id int) error {
	if err := r.next.Delete(ctx, id); err != nil {
		return err
	}
	r.invalidate(ctx, id)
	return nil
}

func (r *ProductRepository) invalidate(ctx context.Context, id int) {
	_ = r.cache.Delete(ctx, id)
	// Product create/delete also changes the inventories table in the same DB
	// transaction, so invalidate the related inventory caches as well.
	_ = r.inventoryInvalidator.Delete(ctx, id)
}
