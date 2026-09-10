package cache

import (
	"context"
	"errors"
	"testing"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

type fakeRepository struct {
	inventory *domain.Inventory
	finds     int
	saves     int
	txErr     error
}

func (r *fakeRepository) FindAll(context.Context) ([]*domain.Inventory, error) {
	r.finds++
	return []*domain.Inventory{r.inventory}, nil
}
func (r *fakeRepository) FindByID(context.Context, int) (*domain.Inventory, error) {
	r.finds++
	return r.inventory, nil
}
func (r *fakeRepository) Save(_ context.Context, inventory *domain.Inventory) error {
	r.saves++
	r.inventory = inventory
	return nil
}
func (r *fakeRepository) RunInTx(ctx context.Context, fn func(domain.InventoryRepository) error) error {
	if err := fn(r); err != nil {
		return err
	}
	return r.txErr
}

type fakeCache struct {
	inventory *domain.Inventory
	getErr    error
	sets      int
	deleted   []int
}

func (c *fakeCache) GetAll(context.Context) ([]*domain.Inventory, error) {
	if c.getErr != nil {
		return nil, c.getErr
	}
	return []*domain.Inventory{c.inventory}, nil
}
func (c *fakeCache) SetAll(context.Context, []*domain.Inventory) error { c.sets++; return nil }
func (c *fakeCache) Get(context.Context, int) (*domain.Inventory, error) {
	return c.inventory, c.getErr
}
func (c *fakeCache) Set(_ context.Context, inventory *domain.Inventory) error {
	c.inventory = inventory
	c.sets++
	return nil
}
func (c *fakeCache) Delete(_ context.Context, ids ...int) error {
	c.deleted = append(c.deleted, ids...)
	return nil
}

func TestFindByIDReturnsCachedInventory(t *testing.T) {
	db := &fakeRepository{inventory: &domain.Inventory{ID: 1, Count: 3}}
	c := &fakeCache{inventory: &domain.Inventory{ID: 1, Count: 10}}
	repo := NewInventoryRepository(db, c)

	got, err := repo.FindByID(context.Background(), 1)
	if err != nil || got.Count != 10 {
		t.Fatalf("FindByID() = (%v, %v), want cached count 10", got, err)
	}
	if db.finds != 0 {
		t.Fatalf("database reads = %d, want 0", db.finds)
	}
}

func TestFindByIDFallsBackAndWarmsCache(t *testing.T) {
	db := &fakeRepository{inventory: &domain.Inventory{ID: 1, Count: 3}}
	c := &fakeCache{getErr: errors.New("redis unavailable")}
	repo := NewInventoryRepository(db, c)

	got, err := repo.FindByID(context.Background(), 1)
	if err != nil || got.Count != 3 {
		t.Fatalf("FindByID() = (%v, %v), want database count 3", got, err)
	}
	if db.finds != 1 || c.sets != 1 {
		t.Fatalf("database reads/cache sets = %d/%d, want 1/1", db.finds, c.sets)
	}
}

func TestRunInTxInvalidatesOnlyAfterCommit(t *testing.T) {
	ctx := context.Background()
	db := &fakeRepository{inventory: &domain.Inventory{ID: 1, Count: 10}}
	c := &fakeCache{}
	repo := NewInventoryRepository(db, c)

	err := repo.RunInTx(ctx, func(tx domain.InventoryRepository) error {
		return tx.Save(ctx, &domain.Inventory{ID: 1, Count: 9})
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(c.deleted) != 1 || c.deleted[0] != 1 {
		t.Fatalf("deleted ids = %v, want [1]", c.deleted)
	}

	c.deleted = nil
	db.txErr = errors.New("commit failed")
	err = repo.RunInTx(ctx, func(tx domain.InventoryRepository) error {
		return tx.Save(ctx, &domain.Inventory{ID: 1, Count: 8})
	})
	if err == nil {
		t.Fatal("RunInTx() error = nil, want commit error")
	}
	if len(c.deleted) != 0 {
		t.Fatalf("deleted ids after rollback = %v, want none", c.deleted)
	}
}
