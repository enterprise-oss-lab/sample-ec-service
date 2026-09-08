package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

const productColumns = `id, name, description, price, image_key, created_at, updated_at`

type productRepository struct {
	pool *pgxpool.Pool
}

func NewProductRepository(pool *pgxpool.Pool) domain.ProductRepository {
	return &productRepository{pool: pool}
}

func (r *productRepository) FindAll(ctx context.Context) ([]*domain.Product, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+productColumns+` FROM products ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []*domain.Product
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	return products, rows.Err()
}

func (r *productRepository) FindByID(ctx context.Context, id int) (*domain.Product, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+productColumns+` FROM products WHERE id = $1`, id)
	return scanProduct(row)
}

func (r *productRepository) Create(ctx context.Context, product *domain.Product, initialCount int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	row := tx.QueryRow(ctx, `INSERT INTO products (name, description, price, image_key)
		VALUES ($1, $2, $3, $4) RETURNING id, created_at, updated_at`,
		product.Name, product.Description, product.Price, product.ImageKey)
	if err := row.Scan(&product.ID, &product.CreatedAt, &product.UpdatedAt); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO inventories (id, count) VALUES ($1, $2)`, product.ID, initialCount); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *productRepository) Update(ctx context.Context, product *domain.Product) error {
	row := r.pool.QueryRow(ctx, `UPDATE products SET name=$1, description=$2, price=$3, image_key=$4, updated_at=now()
		WHERE id=$5 RETURNING created_at, updated_at`, product.Name, product.Description, product.Price, product.ImageKey, product.ID)
	if err := row.Scan(&product.CreatedAt, &product.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrProductNotFound
		}
		return err
	}
	return nil
}

func (r *productRepository) Delete(ctx context.Context, id int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM inventories WHERE id=$1`, id); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM products WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrProductNotFound
	}
	return tx.Commit(ctx)
}

func scanProduct(row pgx.Row) (*domain.Product, error) {
	var p domain.Product
	if err := row.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageKey, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrProductNotFound
		}
		return nil, err
	}
	return &p, nil
}
