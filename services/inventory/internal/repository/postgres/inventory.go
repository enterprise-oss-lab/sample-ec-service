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

func (r *inventoryRepository) FindAll(ctx context.Context) ([]*domain.Inventory, error) {
	rows, err := r.pool.Query(ctx, `SELECT id, name, count, price, description, image_key, created_at, updated_at FROM inventories ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var inventories []*domain.Inventory
	for rows.Next() {
		var inv domain.Inventory
		if err := rows.Scan(&inv.ID, &inv.Name, &inv.Count, &inv.Price, &inv.Description, &inv.ImageKey, &inv.CreatedAt, &inv.UpdatedAt); err != nil {
			return nil, err
		}
		inventories = append(inventories, &inv)
	}
	return inventories, rows.Err()
}

func (r *inventoryRepository) FindByID(ctx context.Context, id int) (*domain.Inventory, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, name, count, price, description, image_key, created_at, updated_at FROM inventories WHERE id = $1`,
		id,
	)
	return scanInventory(row)
}

func (r *inventoryRepository) Save(ctx context.Context, inv *domain.Inventory) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO inventories (id, name, count, price, description, image_key)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (id) DO UPDATE
		     SET name        = EXCLUDED.name,
		         count       = EXCLUDED.count,
		         price       = EXCLUDED.price,
		         description = EXCLUDED.description,
		         image_key   = EXCLUDED.image_key,
		         updated_at  = now()`,
		inv.ID, inv.Name, inv.Count, inv.Price, inv.Description, inv.ImageKey,
	)
	return err
}

func (r *inventoryRepository) Create(ctx context.Context, inv *domain.Inventory) error {
	row := r.pool.QueryRow(ctx,
		`INSERT INTO inventories (name, count, price, description, image_key)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, created_at, updated_at`,
		inv.Name, inv.Count, inv.Price, inv.Description, inv.ImageKey,
	)
	return row.Scan(&inv.ID, &inv.CreatedAt, &inv.UpdatedAt)
}

func (r *inventoryRepository) Update(ctx context.Context, inv *domain.Inventory) error {
	row := r.pool.QueryRow(ctx,
		`UPDATE inventories
		 SET name = $1, price = $2, description = $3, image_key = $4, updated_at = now()
		 WHERE id = $5
		 RETURNING count, created_at, updated_at`,
		inv.Name, inv.Price, inv.Description, inv.ImageKey, inv.ID,
	)
	if err := row.Scan(&inv.Count, &inv.CreatedAt, &inv.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *inventoryRepository) Delete(ctx context.Context, id int) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM inventories WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *inventoryRepository) RunInTx(ctx context.Context, fn func(domain.InventoryRepository) error) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if err := fn(&txInventoryRepository{tx: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// txInventoryRepository はトランザクション内で動作するリポジトリ実装。
// FindByID は SELECT FOR UPDATE でロックを取得し、Save は count のみを更新する。
type txInventoryRepository struct {
	tx pgx.Tx
}

func (r *txInventoryRepository) FindAll(ctx context.Context) ([]*domain.Inventory, error) {
	rows, err := r.tx.Query(ctx, `SELECT id, name, count, price, description, image_key, created_at, updated_at FROM inventories ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var inventories []*domain.Inventory
	for rows.Next() {
		var inv domain.Inventory
		if err := rows.Scan(&inv.ID, &inv.Name, &inv.Count, &inv.Price, &inv.Description, &inv.ImageKey, &inv.CreatedAt, &inv.UpdatedAt); err != nil {
			return nil, err
		}
		inventories = append(inventories, &inv)
	}
	return inventories, rows.Err()
}

func (r *txInventoryRepository) FindByID(ctx context.Context, id int) (*domain.Inventory, error) {
	row := r.tx.QueryRow(ctx,
		`SELECT id, name, count, price, description, image_key, created_at, updated_at FROM inventories WHERE id = $1 FOR UPDATE`,
		id,
	)
	return scanInventory(row)
}

func (r *txInventoryRepository) Save(ctx context.Context, inv *domain.Inventory) error {
	_, err := r.tx.Exec(ctx,
		`UPDATE inventories SET count = $1 WHERE id = $2`,
		inv.Count, inv.ID,
	)
	return err
}

func (r *txInventoryRepository) Create(ctx context.Context, inv *domain.Inventory) error {
	row := r.tx.QueryRow(ctx,
		`INSERT INTO inventories (name, count, price, description, image_key)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, created_at, updated_at`,
		inv.Name, inv.Count, inv.Price, inv.Description, inv.ImageKey,
	)
	return row.Scan(&inv.ID, &inv.CreatedAt, &inv.UpdatedAt)
}

func (r *txInventoryRepository) Update(ctx context.Context, inv *domain.Inventory) error {
	row := r.tx.QueryRow(ctx,
		`UPDATE inventories
		 SET name = $1, price = $2, description = $3, image_key = $4, updated_at = now()
		 WHERE id = $5
		 RETURNING count, created_at, updated_at`,
		inv.Name, inv.Price, inv.Description, inv.ImageKey, inv.ID,
	)
	if err := row.Scan(&inv.Count, &inv.CreatedAt, &inv.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *txInventoryRepository) Delete(ctx context.Context, id int) error {
	tag, err := r.tx.Exec(ctx, `DELETE FROM inventories WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *txInventoryRepository) RunInTx(_ context.Context, fn func(domain.InventoryRepository) error) error {
	return fn(r)
}

func scanInventory(row pgx.Row) (*domain.Inventory, error) {
	var inv domain.Inventory
	if err := row.Scan(&inv.ID, &inv.Name, &inv.Count, &inv.Price, &inv.Description, &inv.ImageKey, &inv.CreatedAt, &inv.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &inv, nil
}
