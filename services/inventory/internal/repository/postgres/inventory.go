package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

type inventoryRepository struct {
	pool *pgxpool.Pool
}

func NewInventoryRepository(pool *pgxpool.Pool) domain.InventoryRepository {
	return &inventoryRepository{pool: pool}
}

func (r *inventoryRepository) FindByID(ctx context.Context, id int) (*domain.Inventory, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, name, count FROM inventories WHERE id = $1`,
		id,
	)

	var inv domain.Inventory
	if err := row.Scan(&inv.ID, &inv.Name, &inv.Count); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &inv, nil
}

func (r *inventoryRepository) Save(ctx context.Context, inv *domain.Inventory) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO inventories (id, name, count)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (id) DO UPDATE
		     SET name  = EXCLUDED.name,
		         count = EXCLUDED.count`,
		inv.ID, inv.Name, inv.Count,
	)
	return err
}
