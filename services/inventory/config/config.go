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

type RustFSConfig struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type Config struct {
	DatabaseURL string
	Port        string
	CORSOrigins []string
	Kafka       KafkaConfig
	RustFS      RustFSConfig
	Redis       RedisConfig
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

	corsOrigins := os.Getenv("CORS_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost:5173"
	}

	rustfsEndpoint := os.Getenv("RUSTFS_ENDPOINT")
	if rustfsEndpoint == "" {
		rustfsEndpoint = "http://localhost:9000"
	}

	rustfsRegion := os.Getenv("RUSTFS_REGION")
	if rustfsRegion == "" {
		rustfsRegion = "us-east-1"
	}

	rustfsBucket := os.Getenv("RUSTFS_BUCKET")
	if rustfsBucket == "" {
		rustfsBucket = "products"
	}

	rustfsAccessKeyID := os.Getenv("RUSTFS_ACCESS_KEY_ID")
	if rustfsAccessKeyID == "" {
		rustfsAccessKeyID = "rustfsadmin"
	}

	rustfsSecretAccessKey := os.Getenv("RUSTFS_SECRET_ACCESS_KEY") // pragma: allowlist secret
	if rustfsSecretAccessKey == "" {
		rustfsSecretAccessKey = "rustfsadmin" // pragma: allowlist secret
	}

	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	return Config{
		DatabaseURL: dsn,
		Port:        port,
		CORSOrigins: splitAndTrim(corsOrigins, ","),
		Kafka: KafkaConfig{
			Brokers:       strings.Split(brokers, ","),
			RequestTopic:  requestTopic,
			ResultTopic:   resultTopic,
			ConsumerGroup: consumerGroup,
		},
		RustFS: RustFSConfig{
			Endpoint:        rustfsEndpoint,
			Region:          rustfsRegion,
			Bucket:          rustfsBucket,
			AccessKeyID:     rustfsAccessKeyID,
			SecretAccessKey: rustfsSecretAccessKey,
		},
		Redis: RedisConfig{
			Addr:     redisAddr,
			Password: os.Getenv("REDIS_PASSWORD"),
			DB:       0,
		},
	}
}

func splitAndTrim(s, sep string) []string {
	var out []string
	for _, part := range strings.Split(s, sep) {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
