package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	redisclient "github.com/redis/go-redis/v9"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
)

const allProductsKey = "products:all"

type ProductCache struct {
	client *redisclient.Client
	ttl    time.Duration
}

func NewProductCache(client *redisclient.Client, ttl time.Duration) *ProductCache {
	return &ProductCache{client: client, ttl: ttl}
}

func (c *ProductCache) GetAll(ctx context.Context) ([]*domain.Product, error) {
	value, err := c.client.Get(ctx, allProductsKey).Bytes()
	if errors.Is(err, redisclient.Nil) {
		return nil, ErrCacheMiss
	}
	if err != nil {
		return nil, err
	}
	var products []*domain.Product
	if err := json.Unmarshal(value, &products); err != nil {
		return nil, err
	}
	return products, nil
}

func (c *ProductCache) SetAll(ctx context.Context, products []*domain.Product) error {
	return c.setJSON(ctx, allProductsKey, products)
}

func (c *ProductCache) Get(ctx context.Context, id int) (*domain.Product, error) {
	value, err := c.client.Get(ctx, productKey(id)).Bytes()
	if errors.Is(err, redisclient.Nil) {
		return nil, ErrCacheMiss
	}
	if err != nil {
		return nil, err
	}
	var product domain.Product
	if err := json.Unmarshal(value, &product); err != nil {
		return nil, err
	}
	return &product, nil
}

func (c *ProductCache) Set(ctx context.Context, product *domain.Product) error {
	return c.setJSON(ctx, productKey(product.ID), product)
}

func (c *ProductCache) Delete(ctx context.Context, ids ...int) error {
	keys := make([]string, 0, len(ids)+1)
	keys = append(keys, allProductsKey)
	for _, id := range ids {
		keys = append(keys, productKey(id))
	}
	return c.client.Del(ctx, keys...).Err()
}

func (c *ProductCache) setJSON(ctx context.Context, key string, value any) error {
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, key, encoded, c.ttl).Err()
}

func productKey(id int) string {
	return fmt.Sprintf("products:%d", id)
}
