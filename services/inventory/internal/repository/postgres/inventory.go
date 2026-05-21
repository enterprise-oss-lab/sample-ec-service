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
	rows, err := r.pool.Query(ctx, `SELECT id, name, count FROM inventories ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var inventories []*domain.Inventory
	for rows.Next() {
		var inv domain.Inventory
		if err := rows.Scan(&inv.ID, &inv.Name, &inv.Count); err != nil {
			return nil, err
		}
		inventories = append(inventories, &inv)
	}
	return inventories, rows.Err()
}

func (r *inventoryRepository) FindByID(ctx context.Context, id int) (*domain.Inventory, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, name, count FROM inventories WHERE id = $1`,
		id,
	)
	return scanInventory(row)
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
	rows, err := r.tx.Query(ctx, `SELECT id, name, count FROM inventories ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var inventories []*domain.Inventory
	for rows.Next() {
		var inv domain.Inventory
		if err := rows.Scan(&inv.ID, &inv.Name, &inv.Count); err != nil {
			return nil, err
		}
		inventories = append(inventories, &inv)
	}
	return inventories, rows.Err()
}

func (r *txInventoryRepository) FindByID(ctx context.Context, id int) (*domain.Inventory, error) {
	row := r.tx.QueryRow(ctx,
		`SELECT id, name, count FROM inventories WHERE id = $1 FOR UPDATE`,
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

func (r *txInventoryRepository) RunInTx(_ context.Context, fn func(domain.InventoryRepository) error) error {
	return fn(r)
}

func scanInventory(row pgx.Row) (*domain.Inventory, error) {
	var inv domain.Inventory
	if err := row.Scan(&inv.ID, &inv.Name, &inv.Count); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &inv, nil
}
