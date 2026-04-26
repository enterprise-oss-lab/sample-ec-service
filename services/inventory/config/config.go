package config

import "os"

type Config struct {
	DatabaseURL string
}

func Load() Config {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://inventory:password@localhost:5432/inventory?sslmode=disable" // pragma: allowlist secret
	}
	return Config{DatabaseURL: dsn}
}
