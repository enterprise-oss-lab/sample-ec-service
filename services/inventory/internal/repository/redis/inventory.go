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

var ErrCacheMiss = errors.New("cache miss")

const allInventoriesKey = "inventories:all"

type InventoryCache struct {
	client *redisclient.Client
	ttl    time.Duration
}

func NewInventoryCache(client *redisclient.Client, ttl time.Duration) *InventoryCache {
	return &InventoryCache{client: client, ttl: ttl}
}

func (c *InventoryCache) GetAll(ctx context.Context) ([]*domain.Inventory, error) {
	value, err := c.client.Get(ctx, allInventoriesKey).Bytes()
	if errors.Is(err, redisclient.Nil) {
		return nil, ErrCacheMiss
	}
	if err != nil {
		return nil, err
	}
	var inventories []*domain.Inventory
	if err := json.Unmarshal(value, &inventories); err != nil {
		return nil, err
	}
	return inventories, nil
}

func (c *InventoryCache) SetAll(ctx context.Context, inventories []*domain.Inventory) error {
	return c.setJSON(ctx, allInventoriesKey, inventories)
}

func (c *InventoryCache) Get(ctx context.Context, id int) (*domain.Inventory, error) {
	value, err := c.client.Get(ctx, inventoryKey(id)).Bytes()
	if errors.Is(err, redisclient.Nil) {
		return nil, ErrCacheMiss
	}
	if err != nil {
		return nil, err
	}
	var inventory domain.Inventory
	if err := json.Unmarshal(value, &inventory); err != nil {
		return nil, err
	}
	return &inventory, nil
}

func (c *InventoryCache) Set(ctx context.Context, inventory *domain.Inventory) error {
	return c.setJSON(ctx, inventoryKey(inventory.ID), inventory)
}

func (c *InventoryCache) Delete(ctx context.Context, ids ...int) error {
	keys := make([]string, 0, len(ids)+1)
	keys = append(keys, allInventoriesKey)
	for _, id := range ids {
		keys = append(keys, inventoryKey(id))
	}
	return c.client.Del(ctx, keys...).Err()
}

func (c *InventoryCache) Close() error {
	return c.client.Close()
}

func (c *InventoryCache) setJSON(ctx context.Context, key string, value any) error {
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, key, encoded, c.ttl).Err()
}

func inventoryKey(id int) string {
	return fmt.Sprintf("inventories:%d", id)
}
