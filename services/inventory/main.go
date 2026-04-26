package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"enterprise-oss-lab/sample-ec-service/inventry/config"
	"enterprise-oss-lab/sample-ec-service/inventry/internal/handler"
	"enterprise-oss-lab/sample-ec-service/inventry/internal/repository/postgres"
	"enterprise-oss-lab/sample-ec-service/inventry/internal/usecase"
)

func main() {
	cfg := config.Load()

	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to create connection pool: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		log.Printf("database unreachable: %v", err)
		os.Exit(1)
	}

	repo := postgres.NewInventoryRepository(pool)
	uc := usecase.NewInventoryUsecase(repo)
	h := handler.NewInventoryHandler(uc)

	r := gin.Default()
	h.RegisterRoutes(r)

	log.Println("starting inventory service on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
