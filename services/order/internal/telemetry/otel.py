from typing import Callable

from opentelemetry import metrics, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.propagate import set_global_textmap
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator


def setup_telemetry() -> Callable[[], None]:
    """トレース/メトリクス/ログの3シグナルを OTLP gRPC で otel-lgtm へ送る。

    エンドポイント・サービス名・リソース属性はすべて標準の OTEL_* 環境変数から
    SDK が読み取る (コードにハードコードしない)。shutdown 用の callable を返す。
    """
    # OTEL_SERVICE_NAME / OTEL_RESOURCE_ATTRIBUTES を env から自動検出
    resource = Resource.create()

    # トレース
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(tracer_provider)

    # メトリクス
    metric_reader = PeriodicExportingMetricReader(OTLPMetricExporter())
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)

    # ログ (trace_id 相関のため trace/metric と同じ resource を共有)
    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter()))
    set_logger_provider(logger_provider)

    # 伝播は W3C TraceContext を明示設定 (Kafka 手動伝播も同一フォーマット)
    set_global_textmap(TraceContextTextMapPropagator())

    def shutdown() -> None:
        tracer_provider.shutdown()
        meter_provider.shutdown()
        logger_provider.shutdown()

    return shutdown
