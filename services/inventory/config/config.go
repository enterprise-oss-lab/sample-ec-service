package config

import (
	"os"
	"strings"
)

type KafkaConfig struct {
	Brokers       []string
	RequestTopic  string
	ResultTopic   string
	ConsumerGroup string
}

type Config struct {
	DatabaseURL string
	Port        string
	Kafka       KafkaConfig
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://inventory:password@localhost:5432/inventory?sslmode=disable" // pragma: allowlist secret
	}

	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}

	requestTopic := os.Getenv("KAFKA_REQUEST_TOPIC")
	if requestTopic == "" {
		requestTopic = "inventory.reservation.requests"
	}

	resultTopic := os.Getenv("KAFKA_RESULT_TOPIC")
	if resultTopic == "" {
		resultTopic = "inventory.reservation.results"
	}

	consumerGroup := os.Getenv("KAFKA_CONSUMER_GROUP")
	if consumerGroup == "" {
		consumerGroup = "inventory-service"
	}

	return Config{
		DatabaseURL: dsn,
		Port:        port,
		Kafka: KafkaConfig{
			Brokers:       strings.Split(brokers, ","),
			RequestTopic:  requestTopic,
			ResultTopic:   resultTopic,
			ConsumerGroup: consumerGroup,
		},
	}
}
