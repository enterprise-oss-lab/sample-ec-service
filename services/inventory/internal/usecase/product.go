package usecase

import (
	"context"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

// ProductUsecase はカタログ参照のユースケース。
// Inventory と違い引当のようなビジネスルールが無く、リポジトリへの委譲だけになる。
// 層を残しているのは、キャッシュを被せる際にここが差し替え地点になるため。
type ProductUsecase interface {
	ListProducts(ctx context.Context) ([]*domain.Product, error)
	GetProduct(ctx context.Context, id int) (*domain.Product, error)
	CreateProduct(ctx context.Context, product *domain.Product, initialCount int) error
	UpdateProduct(ctx context.Context, product *domain.Product) error
	DeleteProduct(ctx context.Context, id int) error
}

type productUsecase struct {
	repo domain.ProductRepository
}

func NewProductUsecase(repo domain.ProductRepository) ProductUsecase {
	return &productUsecase{repo: repo}
}

func (u *productUsecase) ListProducts(ctx context.Context) ([]*domain.Product, error) {
	return u.repo.FindAll(ctx)
}

func (u *productUsecase) GetProduct(ctx context.Context, id int) (*domain.Product, error) {
	return u.repo.FindByID(ctx, id)
}

func (u *productUsecase) CreateProduct(ctx context.Context, product *domain.Product, initialCount int) error {
	return u.repo.Create(ctx, product, initialCount)
}

func (u *productUsecase) UpdateProduct(ctx context.Context, product *domain.Product) error {
	return u.repo.Update(ctx, product)
}

func (u *productUsecase) DeleteProduct(ctx context.Context, id int) error {
	return u.repo.Delete(ctx, id)
}
