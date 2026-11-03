package lab.ec;

import org.apache.flink.api.common.functions.RichFlatMapFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Validate extends RichFlatMapFunction<String, String> {
    private static final Logger LOG = LoggerFactory.getLogger(Validate.class);

    @Override
    public void flatMap(String raw, Collector<String> output) {
        final com.fasterxml.jackson.databind.JsonNode event;
        try {
            event = Events.validate(raw);
        } catch (IllegalArgumentException e) {
            String reason = e.getMessage();
            getRuntimeContext().getMetricGroup().addGroup("invalid_reason", reason)
                    .counter("invalid_events").inc();
            // Do not log the raw payload or unbounded user-supplied values.
            LOG.warn("Rejected order event: reason={}", reason);
            return;
        }
        if (event == null) {
            getRuntimeContext().getMetricGroup().counter("ignored_events").inc();
        } else {
            output.collect(raw);
        }
    }
}
