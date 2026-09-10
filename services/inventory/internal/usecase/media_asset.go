package usecase

import (
	"context"
	"errors"
	"time"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

// MediaAssetUsecase は media_assets の生存管理（pending登録・期限切れ削除）に関するユースケース。
// pending→confirmed への遷移は product 保存トランザクション内で直接処理するためここには含めない。
type MediaAssetUsecase interface {
	RegisterPending(ctx context.Context, storageKey string) error
	CleanupExpired(ctx context.Context) (deleted, failed int, err error)
}

type mediaAssetUsecase struct {
	repo    domain.MediaAssetRepository
	storage domain.ImageStorage
	ttl     time.Duration
}

func NewMediaAssetUsecase(repo domain.MediaAssetRepository, storage domain.ImageStorage, ttl time.Duration) MediaAssetUsecase {
	return &mediaAssetUsecase{repo: repo, storage: storage, ttl: ttl}
}

func (u *mediaAssetUsecase) RegisterPending(ctx context.Context, storageKey string) error {
	return u.repo.Create(ctx, &domain.MediaAsset{
		StorageKey: storageKey,
		Status:     domain.MediaAssetStatusPending,
		ExpiresAt:  time.Now().Add(u.ttl),
	})
}

func (u *mediaAssetUsecase) CleanupExpired(ctx context.Context) (deleted, failed int, err error) {
	expired, err := u.repo.FindExpiredPending(ctx)
	if err != nil {
		return 0, 0, err
	}

	for _, asset := range expired {
		skipped := false
		txErr := u.repo.RunInTx(ctx, func(txRepo domain.MediaAssetRepository) error {
			locked, err := txRepo.FindByID(ctx, asset.ID)
			if err != nil {
				if errors.Is(err, domain.ErrMediaAssetNotFound) {
					skipped = true // 他プロセスが既に削除済み
					return nil
				}
				return err
			}
			if locked.Status != domain.MediaAssetStatusPending || !locked.ExpiresAt.Before(time.Now()) {
				skipped = true // 確認中にconfirmされた等、対象外
				return nil
			}
			if err := u.storage.Delete(ctx, locked.StorageKey); err != nil {
				return err // rollback。行はpendingのまま残り次回再試行
			}
			return txRepo.Delete(ctx, locked.ID)
		})
		switch {
		case skipped:
			// 対象外の行はdeleted/failedいずれにも計上しない
		case txErr != nil:
			failed++ // 1行の失敗は握って次行を継続
		default:
			deleted++
		}
	}
	return deleted, failed, nil
}
