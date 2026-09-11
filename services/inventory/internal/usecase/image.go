package usecase

import (
	"bytes"
	"context"

	"github.com/google/uuid"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

// ImageUsecase は商品画像のアップロードに関するユースケースを定義するインターフェース
type ImageUsecase interface {
	// UploadImage は data を検証（マジックバイト・サイズ）した上で保存し、
	// 保存先の object key を返す。
	UploadImage(ctx context.Context, data []byte) (string, error)
}

type imageUsecase struct {
	storage      domain.ImageStorage
	mediaAssetUC MediaAssetUsecase
}

func NewImageUsecase(storage domain.ImageStorage, mediaAssetUC MediaAssetUsecase) ImageUsecase {
	return &imageUsecase{storage: storage, mediaAssetUC: mediaAssetUC}
}

func (u *imageUsecase) UploadImage(ctx context.Context, data []byte) (string, error) {
	if len(data) > domain.MaxImageSize {
		return "", domain.ErrImageTooLarge
	}

	ext, contentType, ok := detectImageType(data)
	if !ok {
		return "", domain.ErrUnsupportedImageType
	}

	key := "products/" + uuid.NewString() + "." + ext
	if err := u.storage.Put(ctx, key, contentType, data); err != nil {
		return "", err
	}

	if err := u.mediaAssetUC.RegisterPending(ctx, key); err != nil {
		return "", err
	}

	return key, nil
}

// detectImageType はマジックバイトから jpeg / png / webp を判定する。
func detectImageType(data []byte) (ext string, contentType string, ok bool) {
	switch {
	case bytes.HasPrefix(data, []byte{0xFF, 0xD8, 0xFF}):
		return "jpg", "image/jpeg", true
	case bytes.HasPrefix(data, []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}):
		return "png", "image/png", true
	case len(data) >= 12 && bytes.Equal(data[0:4], []byte("RIFF")) && bytes.Equal(data[8:12], []byte("WEBP")):
		return "webp", "image/webp", true
	default:
		return "", "", false
	}
}
