package cache

import (
	"context"
	"errors"
	"testing"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

type fakeProductRepository struct {
	product  *domain.Product
	finds    int
	writeErr error
}

func (r *fakeProductRepository) FindAll(context.Context) ([]*domain.Product, error) {
	r.finds++
	return []*domain.Product{r.product}, nil
}
func (r *fakeProductRepository) FindByID(context.Context, int) (*domain.Product, error) {
	r.finds++
	return r.product, nil
}
func (r *fakeProductRepository) Create(_ context.Context, product *domain.Product, _ int) error {
	if r.writeErr == nil {
		product.ID = 7
	}
	return r.writeErr
}
func (r *fakeProductRepository) Update(context.Context, *domain.Product) error { return r.writeErr }
func (r *fakeProductRepository) Delete(context.Context, int) error             { return r.writeErr }

type fakeProductCache struct {
	product *domain.Product
	getErr  error
	sets    int
	deleted []int
}

func (c *fakeProductCache) GetAll(context.Context) ([]*domain.Product, error) {
	if c.getErr != nil {
		return nil, c.getErr
	}
	return []*domain.Product{c.product}, nil
}
func (c *fakeProductCache) SetAll(context.Context, []*domain.Product) error {
	c.sets++
	return nil
}
func (c *fakeProductCache) Get(context.Context, int) (*domain.Product, error) {
	return c.product, c.getErr
}
func (c *fakeProductCache) Set(_ context.Context, product *domain.Product) error {
	c.product = product
	c.sets++
	return nil
}
func (c *fakeProductCache) Delete(_ context.Context, ids ...int) error {
	c.deleted = append(c.deleted, ids...)
	return nil
}

type fakeInventoryInvalidator struct{ deleted []int }

func (c *fakeInventoryInvalidator) Delete(_ context.Context, ids ...int) error {
	c.deleted = append(c.deleted, ids...)
	return nil
}

func TestProductFindByIDUsesCache(t *testing.T) {
	db := &fakeProductRepository{product: &domain.Product{ID: 1, Name: "database"}}
	productCache := &fakeProductCache{product: &domain.Product{ID: 1, Name: "cached"}}
	repo := NewProductRepository(db, productCache, &fakeInventoryInvalidator{})

	got, err := repo.FindByID(context.Background(), 1)
	if err != nil || got.Name != "cached" {
		t.Fatalf("FindByID() = (%v, %v), want cached product", got, err)
	}
	if db.finds != 0 {
		t.Fatalf("database reads = %d, want 0", db.finds)
	}
}

func TestProductFindByIDFallsBackAndWarmsCache(t *testing.T) {
	db := &fakeProductRepository{product: &domain.Product{ID: 1, Name: "database"}}
	productCache := &fakeProductCache{getErr: errors.New("redis unavailable")}
	repo := NewProductRepository(db, productCache, &fakeInventoryInvalidator{})

	got, err := repo.FindByID(context.Background(), 1)
	if err != nil || got.Name != "database" {
		t.Fatalf("FindByID() = (%v, %v), want database product", got, err)
	}
	if db.finds != 1 || productCache.sets != 1 {
		t.Fatalf("database reads/cache sets = %d/%d, want 1/1", db.finds, productCache.sets)
	}
}

func TestProductWritesInvalidateCachesOnlyAfterSuccess(t *testing.T) {
	ctx := context.Background()
	db := &fakeProductRepository{}
	productCache := &fakeProductCache{}
	inventoryCache := &fakeInventoryInvalidator{}
	repo := NewProductRepository(db, productCache, inventoryCache)

	product := &domain.Product{Name: "new product"}
	if err := repo.Create(ctx, product, 10); err != nil {
		t.Fatal(err)
	}
	if len(productCache.deleted) != 1 || productCache.deleted[0] != 7 {
		t.Fatalf("product cache deleted ids = %v, want [7]", productCache.deleted)
	}
	if len(inventoryCache.deleted) != 1 || inventoryCache.deleted[0] != 7 {
		t.Fatalf("inventory cache deleted ids = %v, want [7]", inventoryCache.deleted)
	}

	productCache.deleted = nil
	inventoryCache.deleted = nil
	db.writeErr = errors.New("database error")
	if err := repo.Delete(ctx, 7); err == nil {
		t.Fatal("Delete() error = nil, want database error")
	}
	if len(productCache.deleted) != 0 || len(inventoryCache.deleted) != 0 {
		t.Fatal("failed write must not invalidate caches")
	}
}
