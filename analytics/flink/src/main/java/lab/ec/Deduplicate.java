package lab.ec;

import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.streaming.api.functions.KeyedProcessFunction;
import org.apache.flink.util.Collector;

/** No TTL: event IDs and Kafka offsets are restored together from the checkpoint. */
public class Deduplicate extends KeyedProcessFunction<String, String, String> {
    private transient ValueState<Boolean> seen;

    @Override
    public void open(Configuration parameters) throws Exception {
        seen = getRuntimeContext().getState(new ValueStateDescriptor<>("seen-event-id", Boolean.class));
    }

    @Override
    public void processElement(String value, Context context, Collector<String> output) throws Exception {
        if (Boolean.TRUE.equals(seen.value())) {
            getRuntimeContext().getMetricGroup().counter("duplicate_events").inc();
            return;
        }
        seen.update(true);
        output.collect(value);
    }
}
