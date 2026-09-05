package usecase

import (
	"context"
	"errors"
	"testing"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

type stubInventoryRepository struct {
	inventory    *domain.Inventory
	findErr      error
	saveErr      error
	saveCalled   bool
	savedInv     *domain.Inventory
	createErr    error
	createdInv   *domain.Inventory
	updateErr    error
	updatedInv   *domain.Inventory
	deleteErr    error
	deletedID    int
	deleteCalled bool
}

func (s *stubInventoryRepository) FindAll(_ context.Context) ([]*domain.Inventory, error) {
	if s.inventory == nil {
		return []*domain.Inventory{}, s.findErr
	}
	return []*domain.Inventory{s.inventory}, s.findErr
}

func (s *stubInventoryRepository) FindByID(_ context.Context, _ int) (*domain.Inventory, error) {
	return s.inventory, s.findErr
}

func (s *stubInventoryRepository) Save(_ context.Context, inv *domain.Inventory) error {
	s.saveCalled = true
	s.savedInv = inv
	return s.saveErr
}

func (s *stubInventoryRepository) Create(_ context.Context, inv *domain.Inventory) error {
	if s.createErr != nil {
		return s.createErr
	}
	inv.ID = 1
	s.createdInv = inv
	return nil
}

func (s *stubInventoryRepository) Update(_ context.Context, inv *domain.Inventory) error {
	if s.updateErr != nil {
		return s.updateErr
	}
	s.updatedInv = inv
	return nil
}

func (s *stubInventoryRepository) Delete(_ context.Context, id int) error {
	s.deleteCalled = true
	s.deletedID = id
	return s.deleteErr
}

func (s *stubInventoryRepository) RunInTx(_ context.Context, fn func(domain.InventoryRepository) error) error {
	return fn(s)
}

func TestGetInventory(t *testing.T) {
	tests := []struct {
		name      string
		stub      stubInventoryRepository
		wantErr   string
		wantCount int
	}{
		{
			name:      "正常に在庫を取得できる",
			stub:      stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Name: "item", Count: 10}},
			wantCount: 10,
		},
		{
			name:    "存在しない ID はエラーを返す",
			stub:    stubInventoryRepository{findErr: domain.ErrNotFound},
			wantErr: "inventory not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := NewInventoryUsecase(&tt.stub)
			inv, err := uc.GetInventory(context.Background(), 1)
			if tt.wantErr != "" {
				if err == nil || err.Error() != tt.wantErr {
					t.Errorf("got err %v, want %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if inv.Count != tt.wantCount {
				t.Errorf("got Count %d, want %d", inv.Count, tt.wantCount)
			}
		})
	}
}

func TestReserve(t *testing.T) {
	tests := []struct {
		name           string
		stub           stubInventoryRepository
		quantity       int
		wantErr        string
		wantSaveCount  int
		wantSaveCalled bool
	}{
		{
			name:           "正常に引当できる",
			stub:           stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Count: 10}},
			quantity:       5,
			wantSaveCalled: true,
			wantSaveCount:  5,
		},
		{
			name:     "在庫不足で引当できない",
			stub:     stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Count: 5}},
			quantity: 10,
			wantErr:  "insufficient stock",
		},
		{
			name:     "quantity が 0 以下はエラー",
			stub:     stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Count: 10}},
			quantity: 0,
			wantErr:  "quantity must be greater than 0",
		},
		{
			name:     "FindByID でエラー",
			stub:     stubInventoryRepository{findErr: domain.ErrNotFound},
			quantity: 5,
			wantErr:  "inventory not found",
		},
		{
			name:           "Save でエラー",
			stub:           stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Count: 10}, saveErr: errors.New("db error")},
			quantity:       5,
			wantErr:        "db error",
			wantSaveCalled: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := NewInventoryUsecase(&tt.stub)
			err := uc.Reserve(context.Background(), 1, tt.quantity)
			if tt.wantErr != "" {
				if err == nil || err.Error() != tt.wantErr {
					t.Errorf("got err %v, want %q", err, tt.wantErr)
				}
				if !tt.wantSaveCalled && tt.stub.saveCalled {
					t.Error("Save should not have been called")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !tt.stub.saveCalled {
				t.Error("Save was not called")
			}
			if tt.stub.savedInv.Count != tt.wantSaveCount {
				t.Errorf("saved Count = %d, want %d", tt.stub.savedInv.Count, tt.wantSaveCount)
			}
		})
	}
}

func TestRestock(t *testing.T) {
	tests := []struct {
		name           string
		stub           stubInventoryRepository
		quantity       int
		wantErr        string
		wantSaveCount  int
		wantSaveCalled bool
	}{
		{
			name:           "正常に補充できる",
			stub:           stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Count: 10}},
			quantity:       5,
			wantSaveCalled: true,
			wantSaveCount:  15,
		},
		{
			name:     "quantity が 0 以下はエラー",
			stub:     stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Count: 10}},
			quantity: 0,
			wantErr:  "quantity must be greater than 0",
		},
		{
			name:     "FindByID でエラー",
			stub:     stubInventoryRepository{findErr: domain.ErrNotFound},
			quantity: 5,
			wantErr:  "inventory not found",
		},
		{
			name:           "Save でエラー",
			stub:           stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Count: 10}, saveErr: errors.New("db error")},
			quantity:       5,
			wantErr:        "db error",
			wantSaveCalled: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := NewInventoryUsecase(&tt.stub)
			err := uc.Restock(context.Background(), 1, tt.quantity)
			if tt.wantErr != "" {
				if err == nil || err.Error() != tt.wantErr {
					t.Errorf("got err %v, want %q", err, tt.wantErr)
				}
				if !tt.wantSaveCalled && tt.stub.saveCalled {
					t.Error("Save should not have been called")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !tt.stub.saveCalled {
				t.Error("Save was not called")
			}
			if tt.stub.savedInv.Count != tt.wantSaveCount {
				t.Errorf("saved Count = %d, want %d", tt.stub.savedInv.Count, tt.wantSaveCount)
			}
		})
	}
}

func TestCreateProduct(t *testing.T) {
	stub := stubInventoryRepository{}
	uc := NewInventoryUsecase(&stub)

	inv := &domain.Inventory{Name: "新商品", Price: 1000, Description: "説明", Count: 10}
	if err := uc.CreateProduct(context.Background(), inv); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stub.createdInv != inv {
		t.Error("Create was not called with the given inventory")
	}
	if inv.ID != 1 {
		t.Errorf("got ID %d, want 1 (set by repository)", inv.ID)
	}
}

func TestCreateProduct_RepositoryError(t *testing.T) {
	stub := stubInventoryRepository{createErr: errors.New("db error")}
	uc := NewInventoryUsecase(&stub)

	err := uc.CreateProduct(context.Background(), &domain.Inventory{Name: "新商品"})
	if err == nil || err.Error() != "db error" {
		t.Errorf("got err %v, want %q", err, "db error")
	}
}

func TestUpdateProduct(t *testing.T) {
	stub := stubInventoryRepository{}
	uc := NewInventoryUsecase(&stub)

	inv := &domain.Inventory{ID: 1, Name: "更新後", Price: 2000}
	if err := uc.UpdateProduct(context.Background(), inv); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stub.updatedInv != inv {
		t.Error("Update was not called with the given inventory")
	}
}

func TestUpdateProduct_NotFound(t *testing.T) {
	stub := stubInventoryRepository{updateErr: domain.ErrNotFound}
	uc := NewInventoryUsecase(&stub)

	err := uc.UpdateProduct(context.Background(), &domain.Inventory{ID: 999})
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("got err %v, want %v", err, domain.ErrNotFound)
	}
}

func TestDeleteProduct(t *testing.T) {
	stub := stubInventoryRepository{}
	uc := NewInventoryUsecase(&stub)

	if err := uc.DeleteProduct(context.Background(), 1); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !stub.deleteCalled || stub.deletedID != 1 {
		t.Error("Delete was not called with the given id")
	}
}

func TestDeleteProduct_NotFound(t *testing.T) {
	stub := stubInventoryRepository{deleteErr: domain.ErrNotFound}
	uc := NewInventoryUsecase(&stub)

	err := uc.DeleteProduct(context.Background(), 999)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("got err %v, want %v", err, domain.ErrNotFound)
	}
}

func TestAdjustStock(t *testing.T) {
	tests := []struct {
		name          string
		stub          stubInventoryRepository
		delta         int
		wantErr       string
		wantSaveCount int
	}{
		{
			name:          "正の delta は補充になる",
			stub:          stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Count: 10}},
			delta:         5,
			wantSaveCount: 15,
		},
		{
			name:          "負の delta は引当になる",
			stub:          stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Count: 10}},
			delta:         -5,
			wantSaveCount: 5,
		},
		{
			name:    "負の delta で在庫を割り込む場合はエラー",
			stub:    stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Count: 5}},
			delta:   -10,
			wantErr: "insufficient stock",
		},
		{
			name:    "delta が 0 はエラー",
			stub:    stubInventoryRepository{inventory: &domain.Inventory{ID: 1, Count: 10}},
			delta:   0,
			wantErr: "quantity must be greater than 0",
		},
		{
			name:    "FindByID でエラー",
			stub:    stubInventoryRepository{findErr: domain.ErrNotFound},
			delta:   5,
			wantErr: "inventory not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := NewInventoryUsecase(&tt.stub)
			err := uc.AdjustStock(context.Background(), 1, tt.delta)
			if tt.wantErr != "" {
				if err == nil || err.Error() != tt.wantErr {
					t.Errorf("got err %v, want %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.stub.savedInv.Count != tt.wantSaveCount {
				t.Errorf("saved Count = %d, want %d", tt.stub.savedInv.Count, tt.wantSaveCount)
			}
		})
	}
}
