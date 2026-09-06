package storage

import (
	"bytes"
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

// Config は RustFS など S3 互換ストレージへの接続設定。
type Config struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
}

type s3ImageStorage struct {
	client *s3.Client
	bucket string
}

func NewS3ImageStorage(cfg Config) domain.ImageStorage {
	client := s3.New(s3.Options{
		Region:       cfg.Region,
		BaseEndpoint: aws.String(cfg.Endpoint),
		// RustFS はバケット名をパスに含める形式（path-style）で待ち受けるため、
		// virtual-hosted-style（<bucket>.<endpoint>）ではなくこちらを使う。
		UsePathStyle: true,
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
	})
	return &s3ImageStorage{client: client, bucket: cfg.Bucket}
}

func (s *s3ImageStorage) Put(ctx context.Context, key string, contentType string, data []byte) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	return err
}
