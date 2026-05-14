package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/usecase"
)

type Consumer struct {
	consumer *kafka.Consumer
	usecase  usecase.InventoryUsecase
	producer *Producer
}

func NewConsumer(brokers []string, topic, groupID string, uc usecase.InventoryUsecase, p *Producer) (*Consumer, error) {
	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers":  strings.Join(brokers, ","),
		"group.id":           groupID,
		"auto.offset.reset":  "latest",
		"enable.auto.commit": false,
	})
	if err != nil {
		return nil, fmt.Errorf("new consumer: %w", err)
	}
	if err := c.SubscribeTopics([]string{topic}, nil); err != nil {
		c.Close()
		return nil, fmt.Errorf("subscribe: %w", err)
	}
	return &Consumer{consumer: c, usecase: uc, producer: p}, nil
}

func (c *Consumer) Run(ctx context.Context) error {
	for {
		if ctx.Err() != nil {
			return nil
		}
		ev := c.consumer.Poll(100)
		if ev == nil {
			continue
		}
		switch e := ev.(type) {
		case *kafka.Message:
			result := c.process(ctx, e)
			if err := c.producer.Publish(ctx, result); err != nil {
				log.Printf("kafka publish error (will not commit): %v", err)
				continue
			}
			if _, err := c.consumer.CommitMessage(e); err != nil {
				log.Printf("kafka commit error: %v", err)
			}
		case kafka.Error:
			log.Printf("kafka error: %v", e)
		}
	}
}

func (c *Consumer) process(ctx context.Context, msg *kafka.Message) ReservationResult {
	var req ReservationRequest
	if err := json.Unmarshal(msg.Value, &req); err != nil {
		log.Printf("malformed kafka message key=%s: %v", msg.Key, err)
		return ReservationResult{
			CorrelationID: string(msg.Key),
			Success:       false,
			Error:         "malformed request",
		}
	}

	err := c.usecase.Reserve(ctx, req.InventoryID, req.Quantity)
	if err != nil {
		return ReservationResult{
			CorrelationID: req.CorrelationID,
			InventoryID:   req.InventoryID,
			Quantity:      req.Quantity,
			Success:       false,
			Error:         err.Error(),
		}
	}

	return ReservationResult{
		CorrelationID: req.CorrelationID,
		InventoryID:   req.InventoryID,
		Quantity:      req.Quantity,
		Success:       true,
	}
}

func (c *Consumer) Close() error {
	return c.consumer.Close()
}
