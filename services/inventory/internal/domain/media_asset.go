package domain

import (
	"context"
	"errors"
	"time"
)

const (
	MediaAssetStatusPending   = "pending"
	MediaAssetStatusConfirmed = "confirmed"
)

var (
	ErrMediaAssetNotFound       = errors.New("media asset not found")
	ErrMediaAssetNotConfirmable = errors.New("media asset is not a confirmable pending upload")
)

// MediaAsset は RustFS にアップロードされた画像の生存管理レコード。
// status が pending のまま expires_at を過ぎたものは孤立アップロードとして削除対象になる。
type MediaAsset struct {
	ID          int
	StorageKey  string
	Status      string
	ProductID   *int
	ExpiresAt   time.Time
	ConfirmedAt *time.Time
	CreatedAt   time.Time
}

// MediaAssetRepository は media_assets テーブルへの永続化を抽象化するインターフェース。
type MediaAssetRepository interface {
	Create(ctx context.Context, asset *MediaAsset) error
	FindExpiredPending(ctx context.Context) ([]*MediaAsset, error)
	// FindByID はトランザクション内では SELECT FOR UPDATE でロックを取得する。
	FindByID(ctx context.Context, id int) (*MediaAsset, error)
	Delete(ctx context.Context, id int) error
	// RunInTx はトランザクション内で fn を実行する。fn に渡されるリポジトリは
	// SELECT FOR UPDATE でロックを取得するため、並行更新からの保護に使用する。
	RunInTx(ctx context.Context, fn func(txRepo MediaAssetRepository) error) error
}
