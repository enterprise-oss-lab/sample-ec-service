package domain

import (
	"context"
	"errors"
)

var (
	ErrUnsupportedImageType = errors.New("unsupported image type")
	ErrImageTooLarge        = errors.New("image too large")
)

// MaxImageSize は許可する画像アップロードの最大サイズ（5MB）。
const MaxImageSize = 5 * 1024 * 1024

// ImageStorage は画像バイナリの永続化を抽象化するインターフェース。
type ImageStorage interface {
	// Put は key の位置に data を contentType 付きで保存する。
	Put(ctx context.Context, key string, contentType string, data []byte) error
	// Delete は key の位置の画像を削除する。
	Delete(ctx context.Context, key string) error
}
