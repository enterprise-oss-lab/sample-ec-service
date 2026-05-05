package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

type Producer struct {
	producer *kafka.Producer
	topic    string
}

func NewProducer(brokers []string, topic string) (*Producer, error) {
	p, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": strings.Join(brokers, ","),
		"acks":              "all",
	})
	if err != nil {
		return nil, fmt.Errorf("new producer: %w", err)
	}
	return &Producer{producer: p, topic: topic}, nil
}

func (p *Producer) Publish(ctx context.Context, result ReservationResult) error {
	payload, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("marshal result: %w", err)
	}

	deliveryCh := make(chan kafka.Event, 1)
	if err := p.producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &p.topic, Partition: kafka.PartitionAny},
		Key:            []byte(result.CorrelationID),
		Value:          payload,
	}, deliveryCh); err != nil {
		return fmt.Errorf("produce: %w", err)
	}

	select {
	case e := <-deliveryCh:
		m := e.(*kafka.Message)
		if m.TopicPartition.Error != nil {
			return fmt.Errorf("delivery: %w", m.TopicPartition.Error)
		}
	case <-ctx.Done():
		return ctx.Err()
	}
	return nil
}

func (p *Producer) Close() error {
	p.producer.Flush(5000)
	p.producer.Close()
	return nil
}
