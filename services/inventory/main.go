package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/exaring/otelpgx"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/contrib/instrumentation/runtime"

	"enterprise-oss-lab/sample-ec-service/inventry/config"
	httphandler "enterprise-oss-lab/sample-ec-service/inventry/internal/adapter/http"
	kafkaadapter "enterprise-oss-lab/sample-ec-service/inventry/internal/adapter/kafka"
	"enterprise-oss-lab/sample-ec-service/inventry/internal/repository/postgres"
	"enterprise-oss-lab/sample-ec-service/inventry/internal/telemetry"
	"enterprise-oss-lab/sample-ec-service/inventry/internal/usecase"
)

const serviceName = "inventory"

func main() {
	cfg := config.Load()

	ctx := context.Background()

	// Initialise OpenTelemetry (traces + metrics + logs) before anything else so
	// downstream components pick up the global providers and propagator.
	shutdown, err := telemetry.Setup(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "failed to set up telemetry", "error", err)
		os.Exit(1)
	}
	defer func() {
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := shutdown(shutCtx); err != nil {
			slog.ErrorContext(shutCtx, "telemetry shutdown error", "error", err)
		}
	}()

	// All application logs flow through the OTel slog bridge (trace-correlated).
	logger := otelslog.NewLogger(serviceName)

	// Start Go runtime metrics collection.
	if err := runtime.Start(); err != nil {
		logger.ErrorContext(ctx, "failed to start runtime metrics", "error", err)
	}

	// pgx with OTel tracing: parse the DSN, attach the otelpgx tracer, then build the pool.
	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		logger.ErrorContext(ctx, "failed to parse database config", "error", err)
		os.Exit(1)
	}
	poolCfg.ConnConfig.Tracer = otelpgx.NewTracer()
	// 接続プールの上限/下限を明示する。デフォルト (max(4, NumCPU)) は小さく、
	// 負荷スパイクで goroutine が急増すると接続取得 (acquire) が待たされて
	// レイテンシが跳ねるため、余裕を持たせる。
	poolCfg.MaxConns = 25
	poolCfg.MinConns = 5

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		logger.ErrorContext(ctx, "failed to create connection pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		logger.ErrorContext(ctx, "database unreachable", "error", err)
		os.Exit(1)
	}

	repo := postgres.NewInventoryRepository(pool)
	uc := usecase.NewInventoryUsecase(repo)

	producer, err := kafkaadapter.NewProducer(cfg.Kafka.Brokers, cfg.Kafka.ResultTopic)
	if err != nil {
		logger.ErrorContext(ctx, "failed to create kafka producer", "error", err)
		os.Exit(1)
	}
	defer producer.Close()

	consumer, err := kafkaadapter.NewConsumer(cfg.Kafka.Brokers, cfg.Kafka.RequestTopic, cfg.Kafka.ConsumerGroup, uc, producer)
	if err != nil {
		logger.ErrorContext(ctx, "failed to create kafka consumer", "error", err)
		os.Exit(1)
	}
	defer consumer.Close()

	runCtx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := consumer.Run(runCtx); err != nil {
			logger.ErrorContext(runCtx, "consumer exited", "error", err)
		}
	}()

	h := httphandler.NewInventoryHandler(uc)
	r := gin.Default()
	// OTel HTTP server instrumentation must run before CORS so every request is traced.
	r.Use(otelgin.Middleware(serviceName))
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{cfg.CORSOrigin},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Content-Type", "Authorization"},
	}))
	h.RegisterRoutes(r)

	addr := ":" + cfg.Port
	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		<-runCtx.Done()
		shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutCancel()
		if err := srv.Shutdown(shutCtx); err != nil {
			logger.ErrorContext(shutCtx, "server shutdown error", "error", err)
		}
	}()

	logger.InfoContext(ctx, "starting inventory service", "addr", addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.ErrorContext(ctx, "server error", "error", err)
		os.Exit(1)
	}

	wg.Wait()
	logger.InfoContext(ctx, "shutdown complete")
}
