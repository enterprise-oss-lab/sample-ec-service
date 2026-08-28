package usecase

import (
	"context"
	"errors"
	"testing"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

type stubProductRepository struct {
	product *domain.Product
	findErr error
}

func (s *stubProductRepository) FindAll(_ context.Context) ([]*domain.Product, error) {
	if s.product == nil {
		return nil, s.findErr
	}
	return []*domain.Product{s.product}, s.findErr
}

func (s *stubProductRepository) FindByID(_ context.Context, _ int) (*domain.Product, error) {
	return s.product, s.findErr
}

func TestGetProduct(t *testing.T) {
	tests := []struct {
		name      string
		stub      stubProductRepository
		wantErr   string
		wantPrice int
	}{
		{
			name:      "正常にカタログを取得できる",
			stub:      stubProductRepository{product: &domain.Product{ID: 1, Name: "item", Price: 2980}},
			wantPrice: 2980,
		},
		{
			name:    "存在しない ID は product not found を返す",
			stub:    stubProductRepository{findErr: domain.ErrProductNotFound},
			wantErr: "product not found",
		},
		{
			name:    "リポジトリのエラーはそのまま伝播する",
			stub:    stubProductRepository{findErr: errors.New("db error")},
			wantErr: "db error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := NewProductUsecase(&tt.stub)
			p, err := uc.GetProduct(context.Background(), 1)
			if tt.wantErr != "" {
				if err == nil || err.Error() != tt.wantErr {
					t.Errorf("got err %v, want %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if p.Price != tt.wantPrice {
				t.Errorf("got Price %d, want %d", p.Price, tt.wantPrice)
			}
		})
	}
}

func TestListProducts(t *testing.T) {
	stub := stubProductRepository{product: &domain.Product{ID: 1, Name: "item", Price: 2980}}
	uc := NewProductUsecase(&stub)

	products, err := uc.ListProducts(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(products) != 1 || products[0].ID != 1 {
		t.Errorf("got %+v, want 1 product with ID 1", products)
	}
}
