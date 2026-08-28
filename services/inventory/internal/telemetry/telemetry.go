// Package telemetry wires up the OpenTelemetry SDK (traces, metrics, logs) for
// the inventory service. All connection details (endpoint, service name,
// resource attributes) are read from the standard OTEL_* environment variables;
// nothing is hardcoded here.
package telemetry

import (
	"context"
	"errors"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	otellogglobal "go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// Setup initialises the global OpenTelemetry providers for traces, metrics and
// logs and installs the W3C TraceContext propagator. The returned shutdown
// function flushes and closes all three providers and should be deferred by the
// caller. On error, any providers already created are shut down before
// returning so the caller does not have to.
func Setup(ctx context.Context) (func(context.Context) error, error) {
	var shutdownFuncs []func(context.Context) error

	// shutdown chains every registered cleanup, joining their errors.
	shutdown := func(ctx context.Context) error {
		var err error
		for _, fn := range shutdownFuncs {
			err = errors.Join(err, fn(ctx))
		}
		shutdownFuncs = nil
		return err
	}

	// On any failure during setup, tear down whatever succeeded so far.
	handleErr := func(inErr error) (func(context.Context) error, error) {
		return nil, errors.Join(inErr, shutdown(ctx))
	}

	// W3C TraceContext propagator (used for the manual Kafka header propagation).
	otel.SetTextMapPropagator(propagation.TraceContext{})

	// Resource: service.name / service.namespace / deployment.environment are
	// all sourced from OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES.
	res, err := resource.New(ctx,
		resource.WithFromEnv(),
		resource.WithTelemetrySDK(),
		resource.WithHost(),
	)
	if err != nil {
		return handleErr(err)
	}

	// Traces.
	traceExp, err := otlptracegrpc.New(ctx)
	if err != nil {
		return handleErr(err)
	}
	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExp),
		sdktrace.WithResource(res),
	)
	shutdownFuncs = append(shutdownFuncs, tracerProvider.Shutdown)
	otel.SetTracerProvider(tracerProvider)

	// Metrics.
	metricExp, err := otlpmetricgrpc.New(ctx)
	if err != nil {
		return handleErr(err)
	}
	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExp)),
		sdkmetric.WithResource(res),
	)
	shutdownFuncs = append(shutdownFuncs, meterProvider.Shutdown)
	otel.SetMeterProvider(meterProvider)

	// Logs.
	logExp, err := otlploggrpc.New(ctx)
	if err != nil {
		return handleErr(err)
	}
	loggerProvider := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExp)),
		sdklog.WithResource(res),
	)
	shutdownFuncs = append(shutdownFuncs, loggerProvider.Shutdown)
	otellogglobal.SetLoggerProvider(loggerProvider)

	return shutdown, nil
}
