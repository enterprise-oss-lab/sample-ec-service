package lab.ec;

import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.metrics.Counter;
import org.apache.flink.streaming.api.functions.KeyedProcessFunction;
import org.apache.flink.util.Collector;

/** No TTL: event IDs and Kafka offsets are restored together from the checkpoint. */
public class Deduplicate extends KeyedProcessFunction<String, String, String> {
    private transient ValueState<Boolean> seen;
    private transient Counter duplicateEvents;

    @Override
    public void open(Configuration parameters) throws Exception {
        seen = getRuntimeContext().getState(new ValueStateDescriptor<>("seen-event-id", Boolean.class));
        duplicateEvents = getRuntimeContext().getMetricGroup().counter("duplicate_events");
    }

    @Override
    public void processElement(String value, Context context, Collector<String> output) throws Exception {
        if (Boolean.TRUE.equals(seen.value())) {
            duplicateEvents.inc();
            return;
        }
        seen.update(true);
        output.collect(value);
    }
}
