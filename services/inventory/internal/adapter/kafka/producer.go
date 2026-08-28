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
)

const instrumentationName = "enterprise-oss-lab/sample-ec-service/inventry/internal/adapter/kafka"

// KafkaHeaderCarrier adapts a slice of confluent-kafka Headers to the
// propagation.TextMapCarrier interface so trace context can be injected into
// (producer) and extracted from (consumer) Kafka message headers manually.
// It holds a pointer to the header slice so Set can grow it in place.
type KafkaHeaderCarrier struct {
	headers *[]kafka.Header
}

// NewKafkaHeaderCarrier wraps the given header slice.
func NewKafkaHeaderCarrier(headers *[]kafka.Header) KafkaHeaderCarrier {
	return KafkaHeaderCarrier{headers: headers}
}

// Get returns the value for the given header key, or "" if absent.
func (c KafkaHeaderCarrier) Get(key string) string {
	for _, h := range *c.headers {
		if h.Key == key {
			return string(h.Value)
		}
	}
	return ""
}

// Set upserts a header key/value pair.
func (c KafkaHeaderCarrier) Set(key, value string) {
	for i := range *c.headers {
		if (*c.headers)[i].Key == key {
			(*c.headers)[i].Value = []byte(value)
			return
		}
	}
	*c.headers = append(*c.headers, kafka.Header{Key: key, Value: []byte(value)})
}

// Keys lists all header keys.
func (c KafkaHeaderCarrier) Keys() []string {
	keys := make([]string, 0, len(*c.headers))
	for _, h := range *c.headers {
		keys = append(keys, h.Key)
	}
	return keys
}

type Producer struct {
	producer *kafka.Producer
	topic    string
	tracer   trace.Tracer
	logger   *slog.Logger
}

func NewProducer(brokers []string, topic string) (*Producer, error) {
	p, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": strings.Join(brokers, ","),
		"acks":              "all",
	})
	if err != nil {
		return nil, fmt.Errorf("new producer: %w", err)
	}
	return &Producer{
		producer: p,
		topic:    topic,
		tracer:   otel.Tracer(instrumentationName),
		logger:   otelslog.NewLogger(instrumentationName),
	}, nil
}

func (p *Producer) Publish(ctx context.Context, result ReservationResult) error {
	ctx, span := p.tracer.Start(ctx, "produce "+p.topic, trace.WithSpanKind(trace.SpanKindProducer))
	defer span.End()

	span.SetAttributes(
		attribute.String("messaging.system", "kafka"),
		attribute.String("messaging.destination.name", p.topic),
		attribute.String("messaging.operation", "publish"),
		attribute.String("messaging.kafka.message.key", result.CorrelationID),
	)

	payload, err := json.Marshal(result)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("marshal result: %w", err)
	}

	msg := &kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &p.topic, Partition: kafka.PartitionAny},
		Key:            []byte(result.CorrelationID),
		Value:          payload,
	}

	// Inject the current trace context as W3C traceparent into the message headers.
	otel.GetTextMapPropagator().Inject(ctx, NewKafkaHeaderCarrier(&msg.Headers))

	deliveryCh := make(chan kafka.Event, 1)
	if err := p.producer.Produce(msg, deliveryCh); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("produce: %w", err)
	}

	select {
	case e := <-deliveryCh:
		m := e.(*kafka.Message)
		if m.TopicPartition.Error != nil {
			span.RecordError(m.TopicPartition.Error)
			span.SetStatus(codes.Error, m.TopicPartition.Error.Error())
			return fmt.Errorf("delivery: %w", m.TopicPartition.Error)
		}
	case <-ctx.Done():
		span.RecordError(ctx.Err())
		span.SetStatus(codes.Error, ctx.Err().Error())
		return ctx.Err()
	}

	p.logger.InfoContext(ctx, "published reservation result",
		"topic", p.topic,
		"correlation_id", result.CorrelationID,
		"success", result.Success,
	)
	return nil
}

func (p *Producer) Close() error {
	p.producer.Flush(5000)
	p.producer.Close()
	return nil
}
