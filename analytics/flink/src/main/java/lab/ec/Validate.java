package lab.ec;

import java.util.HashMap;
import java.util.Map;
import org.apache.flink.api.common.functions.RichFlatMapFunction;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.metrics.Counter;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Validate extends RichFlatMapFunction<String, String> {
    private static final Logger LOG = LoggerFactory.getLogger(Validate.class);
    private transient Counter ignoredEvents;
    private transient Map<String, Counter> invalidEvents;

    @Override
    public void open(Configuration parameters) {
        ignoredEvents = getRuntimeContext().getMetricGroup().counter("ignored_events");
        invalidEvents = new HashMap<>();
    }

    @Override
    public void flatMap(String raw, Collector<String> output) {
        final com.fasterxml.jackson.databind.JsonNode event;
        try {
            event = Events.validate(raw);
        } catch (IllegalArgumentException e) {
            String reason = e.getMessage();
            invalidEvents.computeIfAbsent(reason, key -> getRuntimeContext().getMetricGroup()
                    .addGroup("invalid_reason", key).counter("invalid_events")).inc();
            // Do not log the raw payload or unbounded user-supplied values.
            LOG.warn("Rejected order event: reason={}", reason);
            return;
        }
        if (event == null) {
            ignoredEvents.inc();
        } else {
            output.collect(raw);
        }
    }
}
