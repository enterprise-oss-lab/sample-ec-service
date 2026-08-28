package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/usecase"
)

type Consumer struct {
	consumer *kafka.Consumer
	usecase  usecase.InventoryUsecase
	producer *Producer
	tracer   trace.Tracer
	logger   *slog.Logger
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
	return &Consumer{
		consumer: c,
		usecase:  uc,
		producer: p,
		tracer:   otel.Tracer(instrumentationName),
		logger:   otelslog.NewLogger(instrumentationName),
	}, nil
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
			c.handleMessage(ctx, e)
		case kafka.Error:
			c.logger.ErrorContext(ctx, "kafka error", "error", e)
		}
	}
}

// handleMessage extracts the propagated trace context from the message headers,
// starts a consumer span parented to it, and threads that context through the
// reservation work and the result publish so the whole saga stays on one trace.
func (c *Consumer) handleMessage(ctx context.Context, msg *kafka.Message) {
	topic := topicName(msg)

	// Extract the parent context injected by the upstream producer (traceparent).
	parentCtx := otel.GetTextMapPropagator().Extract(ctx, NewKafkaHeaderCarrier(&msg.Headers))
	msgCtx, span := c.tracer.Start(parentCtx, "consume "+topic,
		trace.WithSpanKind(trace.SpanKindConsumer),
		trace.WithAttributes(
			attribute.String("messaging.system", "kafka"),
			attribute.String("messaging.operation", "receive"),
			attribute.String("messaging.destination.name", topic),
		),
	)
	defer span.End()

	result := c.process(msgCtx, msg)
	if err := c.producer.Publish(msgCtx, result); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		c.logger.ErrorContext(msgCtx, "kafka publish error (will not commit)", "error", err)
		return
	}
	if _, err := c.consumer.CommitMessage(msg); err != nil {
		c.logger.ErrorContext(msgCtx, "kafka commit error", "error", err)
	}
}

func (c *Consumer) process(ctx context.Context, msg *kafka.Message) ReservationResult {
	var req ReservationRequest
	if err := json.Unmarshal(msg.Value, &req); err != nil {
		c.logger.ErrorContext(ctx, "malformed kafka message", "key", string(msg.Key), "error", err)
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

// topicName returns the message's topic, or "unknown" if unset.
func topicName(msg *kafka.Message) string {
	if msg.TopicPartition.Topic != nil {
		return *msg.TopicPartition.Topic
	}
	return "unknown"
}
