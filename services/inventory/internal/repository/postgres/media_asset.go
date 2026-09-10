package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

const mediaAssetColumns = `id, storage_key, status, product_id, expires_at, confirmed_at, created_at`

type mediaAssetRepository struct {
	pool *pgxpool.Pool
}

func NewMediaAssetRepository(pool *pgxpool.Pool) domain.MediaAssetRepository {
	return &mediaAssetRepository{pool: pool}
}

func (r *mediaAssetRepository) Create(ctx context.Context, asset *domain.MediaAsset) error {
	row := r.pool.QueryRow(ctx, `INSERT INTO media_assets (storage_key, expires_at)
		VALUES ($1, $2) RETURNING id, status, created_at`,
		asset.StorageKey, asset.ExpiresAt)
	return row.Scan(&asset.ID, &asset.Status, &asset.CreatedAt)
}

func (r *mediaAssetRepository) FindExpiredPending(ctx context.Context) ([]*domain.MediaAsset, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+mediaAssetColumns+` FROM media_assets
		WHERE status = $1 AND expires_at < now()`, domain.MediaAssetStatusPending)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMediaAssets(rows)
}

func (r *mediaAssetRepository) FindByID(ctx context.Context, id int) (*domain.MediaAsset, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+mediaAssetColumns+` FROM media_assets WHERE id = $1`, id)
	return scanMediaAsset(row)
}

func (r *mediaAssetRepository) Delete(ctx context.Context, id int) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM media_assets WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrMediaAssetNotFound
	}
	return nil
}

func (r *mediaAssetRepository) RunInTx(ctx context.Context, fn func(txRepo domain.MediaAssetRepository) error) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if err := fn(&txMediaAssetRepository{tx: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// txMediaAssetRepository はトランザクション内で動作するリポジトリ実装。
// FindByID は SELECT FOR UPDATE でロックを取得し、並行更新から保護する。
type txMediaAssetRepository struct {
	tx pgx.Tx
}

func (r *txMediaAssetRepository) Create(ctx context.Context, asset *domain.MediaAsset) error {
	row := r.tx.QueryRow(ctx, `INSERT INTO media_assets (storage_key, expires_at)
		VALUES ($1, $2) RETURNING id, status, created_at`,
		asset.StorageKey, asset.ExpiresAt)
	return row.Scan(&asset.ID, &asset.Status, &asset.CreatedAt)
}

func (r *txMediaAssetRepository) FindExpiredPending(ctx context.Context) ([]*domain.MediaAsset, error) {
	rows, err := r.tx.Query(ctx, `SELECT `+mediaAssetColumns+` FROM media_assets
		WHERE status = $1 AND expires_at < now()`, domain.MediaAssetStatusPending)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMediaAssets(rows)
}

func (r *txMediaAssetRepository) FindByID(ctx context.Context, id int) (*domain.MediaAsset, error) {
	row := r.tx.QueryRow(ctx, `SELECT `+mediaAssetColumns+` FROM media_assets WHERE id = $1 FOR UPDATE`, id)
	return scanMediaAsset(row)
}

func (r *txMediaAssetRepository) Delete(ctx context.Context, id int) error {
	tag, err := r.tx.Exec(ctx, `DELETE FROM media_assets WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrMediaAssetNotFound
	}
	return nil
}

func (r *txMediaAssetRepository) RunInTx(_ context.Context, fn func(txRepo domain.MediaAssetRepository) error) error {
	return fn(r)
}

// Confirm は pending 状態の画像を confirmed に遷移し product_id を紐付ける。
// domain.MediaAssetRepository インターフェースの外側のメソッドで、productRepository の
// Create/Update が商品保存と同一の tx から呼び出すことで、2フェーズコミット問題を回避する。
func (r *txMediaAssetRepository) Confirm(ctx context.Context, storageKey string, productID int) error {
	row := r.tx.QueryRow(ctx, `UPDATE media_assets SET status='confirmed', product_id=$1, confirmed_at=now()
		WHERE storage_key=$2 AND status='pending' RETURNING id`, productID, storageKey)
	var id int
	if err := row.Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrMediaAssetNotConfirmable
		}
		return err
	}
	return nil
}

func scanMediaAssets(rows pgx.Rows) ([]*domain.MediaAsset, error) {
	var assets []*domain.MediaAsset
	for rows.Next() {
		a, err := scanMediaAsset(rows)
		if err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}
	return assets, rows.Err()
}

func scanMediaAsset(row pgx.Row) (*domain.MediaAsset, error) {
	var a domain.MediaAsset
	if err := row.Scan(&a.ID, &a.StorageKey, &a.Status, &a.ProductID, &a.ExpiresAt, &a.ConfirmedAt, &a.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrMediaAssetNotFound
		}
		return nil, err
	}
	return &a, nil
}
