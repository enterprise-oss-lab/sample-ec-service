package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"enterprise-oss-lab/sample-ec-service/inventry/config"
	httphandler "enterprise-oss-lab/sample-ec-service/inventry/internal/adapter/http"
	kafkaadapter "enterprise-oss-lab/sample-ec-service/inventry/internal/adapter/kafka"
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

	producer, err := kafkaadapter.NewProducer(cfg.Kafka.Brokers, cfg.Kafka.ResultTopic)
	if err != nil {
		log.Fatalf("failed to create kafka producer: %v", err)
	}
	defer producer.Close()

	consumer, err := kafkaadapter.NewConsumer(cfg.Kafka.Brokers, cfg.Kafka.RequestTopic, cfg.Kafka.ConsumerGroup, uc, producer)
	if err != nil {
		log.Fatalf("failed to create kafka consumer: %v", err)
	}
	defer consumer.Close()

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := consumer.Run(ctx); err != nil {
			log.Printf("consumer exited: %v", err)
		}
	}()

	h := httphandler.NewInventoryHandler(uc)
	r := gin.Default()
	h.RegisterRoutes(r)

	addr := ":" + cfg.Port
	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		<-ctx.Done()
		shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutCancel()
		if err := srv.Shutdown(shutCtx); err != nil {
			log.Printf("server shutdown error: %v", err)
		}
	}()

	log.Printf("starting inventory service on %s", addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server error: %v", err)
	}

	wg.Wait()
	log.Println("shutdown complete")
}
