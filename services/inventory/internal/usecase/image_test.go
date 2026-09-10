package usecase

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

type stubImageStorage struct {
	putErr         error
	putCalled      bool
	putKey         string
	putContentType string
	putData        []byte

	deleteErr    error
	deleteCalled bool
	deleteKey    string
}

func (s *stubImageStorage) Put(_ context.Context, key string, contentType string, data []byte) error {
	s.putCalled = true
	s.putKey = key
	s.putContentType = contentType
	s.putData = data
	return s.putErr
}

func (s *stubImageStorage) Delete(_ context.Context, key string) error {
	s.deleteCalled = true
	s.deleteKey = key
	return s.deleteErr
}

type stubMediaAssetUsecase struct {
	registerErr        error
	registerCalled     bool
	registerStorageKey string
}

func (s *stubMediaAssetUsecase) RegisterPending(_ context.Context, storageKey string) error {
	s.registerCalled = true
	s.registerStorageKey = storageKey
	return s.registerErr
}

func (s *stubMediaAssetUsecase) CleanupExpired(_ context.Context) (int, int, error) {
	return 0, 0, nil
}

func jpegBytes() []byte {
	return append([]byte{0xFF, 0xD8, 0xFF}, []byte("fake jpeg body")...)
}

func pngBytes() []byte {
	return append([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, []byte("fake png body")...)
}

func webpBytes() []byte {
	body := []byte("RIFF")
	body = append(body, 0, 0, 0, 0) // file size (unused by detector)
	body = append(body, []byte("WEBP")...)
	body = append(body, []byte("fake webp body")...)
	return body
}

func TestUploadImage(t *testing.T) {
	tests := []struct {
		name            string
		data            []byte
		wantErr         error
		wantExt         string
		wantContentType string
	}{
		{name: "jpeg は保存できる", data: jpegBytes(), wantExt: ".jpg", wantContentType: "image/jpeg"},
		{name: "png は保存できる", data: pngBytes(), wantExt: ".png", wantContentType: "image/png"},
		{name: "webp は保存できる", data: webpBytes(), wantExt: ".webp", wantContentType: "image/webp"},
		{name: "未知の形式はエラー", data: []byte("not an image"), wantErr: domain.ErrUnsupportedImageType},
		{name: "5MB を超える場合はエラー", data: append(jpegBytes(), bytes.Repeat([]byte{0}, domain.MaxImageSize)...), wantErr: domain.ErrImageTooLarge},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stub := &stubImageStorage{}
			mediaAssetUC := &stubMediaAssetUsecase{}
			uc := NewImageUsecase(stub, mediaAssetUC)

			key, err := uc.UploadImage(context.Background(), tt.data)
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Errorf("got err %v, want %v", err, tt.wantErr)
				}
				if stub.putCalled {
					t.Error("Put should not have been called")
				}
				if mediaAssetUC.registerCalled {
					t.Error("RegisterPending should not have been called")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !stub.putCalled {
				t.Fatal("Put was not called")
			}
			if !strings.HasPrefix(key, "products/") || !strings.HasSuffix(key, tt.wantExt) {
				t.Errorf("got key %q, want prefix %q and suffix %q", key, "products/", tt.wantExt)
			}
			if stub.putKey != key {
				t.Errorf("Put called with key %q, want %q", stub.putKey, key)
			}
			if stub.putContentType != tt.wantContentType {
				t.Errorf("got content type %q, want %q", stub.putContentType, tt.wantContentType)
			}
			if !mediaAssetUC.registerCalled {
				t.Fatal("RegisterPending was not called")
			}
			if mediaAssetUC.registerStorageKey != key {
				t.Errorf("RegisterPending called with key %q, want %q", mediaAssetUC.registerStorageKey, key)
			}
		})
	}
}

func TestUploadImage_StorageError(t *testing.T) {
	stub := &stubImageStorage{putErr: errors.New("s3 error")}
	mediaAssetUC := &stubMediaAssetUsecase{}
	uc := NewImageUsecase(stub, mediaAssetUC)

	_, err := uc.UploadImage(context.Background(), jpegBytes())
	if err == nil || err.Error() != "s3 error" {
		t.Errorf("got err %v, want %q", err, "s3 error")
	}
	if mediaAssetUC.registerCalled {
		t.Error("RegisterPending should not have been called when Put fails")
	}
}

func TestUploadImage_RegisterPendingError(t *testing.T) {
	stub := &stubImageStorage{}
	mediaAssetUC := &stubMediaAssetUsecase{registerErr: errors.New("db error")}
	uc := NewImageUsecase(stub, mediaAssetUC)

	_, err := uc.UploadImage(context.Background(), jpegBytes())
	if err == nil || err.Error() != "db error" {
		t.Errorf("got err %v, want %q", err, "db error")
	}
}
