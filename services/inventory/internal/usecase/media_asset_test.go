package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

type stubMediaAssetRepository struct {
	createErr error
	created   []*domain.MediaAsset

	expired    []*domain.MediaAsset
	expiredErr error

	byID    map[int]*domain.MediaAsset
	findErr error

	deleteErr    error
	deletedIDs   []int
	deleteCalled func(id int) error

	runInTxErr func() error
}

func (s *stubMediaAssetRepository) Create(_ context.Context, asset *domain.MediaAsset) error {
	if s.createErr != nil {
		return s.createErr
	}
	s.created = append(s.created, asset)
	return nil
}

func (s *stubMediaAssetRepository) FindExpiredPending(_ context.Context) ([]*domain.MediaAsset, error) {
	if s.expiredErr != nil {
		return nil, s.expiredErr
	}
	return s.expired, nil
}

func (s *stubMediaAssetRepository) FindByID(_ context.Context, id int) (*domain.MediaAsset, error) {
	if s.findErr != nil {
		return nil, s.findErr
	}
	asset, ok := s.byID[id]
	if !ok {
		return nil, domain.ErrMediaAssetNotFound
	}
	return asset, nil
}

func (s *stubMediaAssetRepository) Delete(_ context.Context, id int) error {
	if s.deleteCalled != nil {
		if err := s.deleteCalled(id); err != nil {
			return err
		}
	}
	if s.deleteErr != nil {
		return s.deleteErr
	}
	s.deletedIDs = append(s.deletedIDs, id)
	return nil
}

func (s *stubMediaAssetRepository) RunInTx(ctx context.Context, fn func(txRepo domain.MediaAssetRepository) error) error {
	if s.runInTxErr != nil {
		if err := s.runInTxErr(); err != nil {
			return err
		}
	}
	return fn(s)
}

func TestRegisterPending(t *testing.T) {
	t.Run("正常系: ExpiresAt が ttl 分先になっている", func(t *testing.T) {
		repo := &stubMediaAssetRepository{}
		ttl := 30 * time.Second
		uc := NewMediaAssetUsecase(repo, &stubImageStorage{}, ttl)

		before := time.Now()
		if err := uc.RegisterPending(context.Background(), "products/foo.jpg"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		after := time.Now()

		if len(repo.created) != 1 {
			t.Fatalf("got %d created assets, want 1", len(repo.created))
		}
		asset := repo.created[0]
		if asset.StorageKey != "products/foo.jpg" {
			t.Errorf("got storage key %q, want %q", asset.StorageKey, "products/foo.jpg")
		}
		if asset.Status != domain.MediaAssetStatusPending {
			t.Errorf("got status %q, want %q", asset.Status, domain.MediaAssetStatusPending)
		}
		if asset.ExpiresAt.Before(before.Add(ttl)) || asset.ExpiresAt.After(after.Add(ttl)) {
			t.Errorf("got ExpiresAt %v, want between %v and %v", asset.ExpiresAt, before.Add(ttl), after.Add(ttl))
		}
	})

	t.Run("repoエラーは伝播する", func(t *testing.T) {
		wantErr := errors.New("db error")
		repo := &stubMediaAssetRepository{createErr: wantErr}
		uc := NewMediaAssetUsecase(repo, &stubImageStorage{}, time.Minute)

		if err := uc.RegisterPending(context.Background(), "products/foo.jpg"); !errors.Is(err, wantErr) {
			t.Errorf("got err %v, want %v", err, wantErr)
		}
	})
}

func TestCleanupExpired(t *testing.T) {
	t.Run("0件", func(t *testing.T) {
		repo := &stubMediaAssetRepository{}
		uc := NewMediaAssetUsecase(repo, &stubImageStorage{}, time.Minute)

		deleted, failed, err := uc.CleanupExpired(context.Background())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if deleted != 0 || failed != 0 {
			t.Errorf("got deleted=%d failed=%d, want 0, 0", deleted, failed)
		}
	})

	t.Run("1件成功", func(t *testing.T) {
		asset := &domain.MediaAsset{ID: 1, StorageKey: "products/foo.jpg", Status: domain.MediaAssetStatusPending, ExpiresAt: time.Now().Add(-time.Minute)}
		repo := &stubMediaAssetRepository{
			expired: []*domain.MediaAsset{asset},
			byID:    map[int]*domain.MediaAsset{1: asset},
		}
		storage := &stubImageStorage{}
		uc := NewMediaAssetUsecase(repo, storage, time.Minute)

		deleted, failed, err := uc.CleanupExpired(context.Background())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if deleted != 1 || failed != 0 {
			t.Errorf("got deleted=%d failed=%d, want 1, 0", deleted, failed)
		}
		if !storage.deleteCalled || storage.deleteKey != "products/foo.jpg" {
			t.Errorf("storage.Delete not called with expected key: called=%v key=%q", storage.deleteCalled, storage.deleteKey)
		}
		if len(repo.deletedIDs) != 1 || repo.deletedIDs[0] != 1 {
			t.Errorf("got deletedIDs %v, want [1]", repo.deletedIDs)
		}
	})

	t.Run("storage.Delete失敗時はfailedカウントされrepo.Deleteは呼ばれない", func(t *testing.T) {
		asset := &domain.MediaAsset{ID: 1, StorageKey: "products/foo.jpg", Status: domain.MediaAssetStatusPending, ExpiresAt: time.Now().Add(-time.Minute)}
		repo := &stubMediaAssetRepository{
			expired: []*domain.MediaAsset{asset},
			byID:    map[int]*domain.MediaAsset{1: asset},
		}
		storage := &stubImageStorage{deleteErr: errors.New("s3 error")}
		uc := NewMediaAssetUsecase(repo, storage, time.Minute)

		deleted, failed, err := uc.CleanupExpired(context.Background())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if deleted != 0 || failed != 1 {
			t.Errorf("got deleted=%d failed=%d, want 0, 1", deleted, failed)
		}
		if len(repo.deletedIDs) != 0 {
			t.Errorf("repo.Delete should not have been called, got deletedIDs %v", repo.deletedIDs)
		}
	})

	t.Run("複数件で一部失敗しても残りは処理される", func(t *testing.T) {
		assetOK := &domain.MediaAsset{ID: 1, StorageKey: "products/ok.jpg", Status: domain.MediaAssetStatusPending, ExpiresAt: time.Now().Add(-time.Minute)}
		assetNG := &domain.MediaAsset{ID: 2, StorageKey: "products/ng.jpg", Status: domain.MediaAssetStatusPending, ExpiresAt: time.Now().Add(-time.Minute)}
		repo := &stubMediaAssetRepository{
			expired: []*domain.MediaAsset{assetOK, assetNG},
			byID:    map[int]*domain.MediaAsset{1: assetOK, 2: assetNG},
		}
		uc := NewMediaAssetUsecase(repo, &deleteFailingStorage{failKey: "products/ng.jpg"}, time.Minute)

		deleted, failed, err := uc.CleanupExpired(context.Background())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if deleted != 1 || failed != 1 {
			t.Errorf("got deleted=%d failed=%d, want 1, 1", deleted, failed)
		}
		if len(repo.deletedIDs) != 1 || repo.deletedIDs[0] != 1 {
			t.Errorf("got deletedIDs %v, want [1]", repo.deletedIDs)
		}
	})

	t.Run("ロック後にconfirmedになっていた場合はスキップされdeleted/failedどちらにも計上されない", func(t *testing.T) {
		staleView := &domain.MediaAsset{ID: 1, StorageKey: "products/foo.jpg", Status: domain.MediaAssetStatusPending, ExpiresAt: time.Now().Add(-time.Minute)}
		confirmedNow := &domain.MediaAsset{ID: 1, StorageKey: "products/foo.jpg", Status: domain.MediaAssetStatusConfirmed, ExpiresAt: staleView.ExpiresAt}
		repo := &stubMediaAssetRepository{
			expired: []*domain.MediaAsset{staleView},
			byID:    map[int]*domain.MediaAsset{1: confirmedNow},
		}
		storage := &stubImageStorage{}
		uc := NewMediaAssetUsecase(repo, storage, time.Minute)

		deleted, failed, err := uc.CleanupExpired(context.Background())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if deleted != 0 || failed != 0 {
			t.Errorf("got deleted=%d failed=%d, want 0, 0", deleted, failed)
		}
		if storage.deleteCalled {
			t.Error("storage.Delete should not have been called")
		}
		if len(repo.deletedIDs) != 0 {
			t.Error("repo.Delete should not have been called")
		}
	})

	t.Run("FindExpiredPendingのエラーは伝播する", func(t *testing.T) {
		wantErr := errors.New("db error")
		repo := &stubMediaAssetRepository{expiredErr: wantErr}
		uc := NewMediaAssetUsecase(repo, &stubImageStorage{}, time.Minute)

		_, _, err := uc.CleanupExpired(context.Background())
		if !errors.Is(err, wantErr) {
			t.Errorf("got err %v, want %v", err, wantErr)
		}
	})
}

// deleteFailingStorage は指定した key のみ Delete が失敗する stub。
type deleteFailingStorage struct {
	failKey string
}

func (s *deleteFailingStorage) Put(_ context.Context, _ string, _ string, _ []byte) error {
	return nil
}

func (s *deleteFailingStorage) Delete(_ context.Context, key string) error {
	if key == s.failKey {
		return errors.New("s3 error")
	}
	return nil
}
