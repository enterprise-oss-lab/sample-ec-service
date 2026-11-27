package lab.ec;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;
import org.apache.flink.api.common.JobID;
import org.apache.flink.api.common.typeinfo.Types;
import org.apache.flink.metrics.Counter;
import org.apache.flink.runtime.clusterframework.types.ResourceID;
import org.apache.flink.runtime.executiongraph.ExecutionAttemptID;
import org.apache.flink.runtime.metrics.groups.TaskManagerMetricGroup;
import org.apache.flink.runtime.metrics.util.TestingMetricRegistry;
import org.apache.flink.runtime.operators.testutils.MockEnvironment;
import org.apache.flink.runtime.operators.testutils.MockEnvironmentBuilder;
import org.apache.flink.streaming.api.operators.KeyedProcessOperator;
import org.apache.flink.streaming.api.operators.StreamFlatMap;
import org.apache.flink.streaming.util.KeyedOneInputStreamOperatorTestHarness;
import org.apache.flink.streaming.util.OneInputStreamOperatorTestHarness;
import org.junit.jupiter.api.Test;

class EventMetricsTest {
    private MockEnvironment environment(Map<String, Counter> counters) {
        var registry = TestingMetricRegistry.builder().setRegisterConsumer((metric, name, group) -> {
            if (metric instanceof Counter counter) {
                String reason = group.getAllVariables().get("<invalid_reason>");
                counters.put(reason == null ? name : name + ":" + reason, counter);
            }
        }).build();
        var task = TaskManagerMetricGroup.createTaskManagerMetricGroup(registry, "localhost", ResourceID.generate())
                .addJob(new JobID(), "metrics-test")
                .addTask(ExecutionAttemptID.randomId(), "events");
        return new MockEnvironmentBuilder().setMetricGroup(task).build();
    }

    @Test void validationCountsEveryRejectedAndIgnoredEvent() throws Exception {
        var counters = new HashMap<String, Counter>();
        try (var env = environment(counters);
             var harness = new OneInputStreamOperatorTestHarness<String, String>(
                     new StreamFlatMap<>(new Validate()), env)) {
            harness.open();
            for (int i = 0; i < 3; i++) harness.processElement("broken", i);
            for (int i = 0; i < 2; i++) {
                harness.processElement(ConfirmedSalesTest.EVENT.replace("\"net_amount\":200", "\"net_amount\":201"), i);
                harness.processElement("{\"event_type\":\"order_cancelled\"}", i);
            }
            harness.processElement(ConfirmedSalesTest.EVENT, 4);
            assertAll(
                    () -> assertEquals(3, counters.get("invalid_events:json").getCount()),
                    () -> assertEquals(2, counters.get("invalid_events:net_amount_mismatch").getCount()),
                    () -> assertEquals(2, counters.get("ignored_events").getCount()));
            assertEquals(java.util.List.of(ConfirmedSalesTest.EVENT), harness.extractOutputValues());
        }
    }

    @Test void duplicateCounterCountsEveryDuplicate() throws Exception {
        var counters = new HashMap<String, Counter>();
        try (var env = environment(counters);
             var harness = new KeyedOneInputStreamOperatorTestHarness<String, String, String>(
                     new KeyedProcessOperator<>(new Deduplicate()),
                     raw -> Events.text(Events.parse(raw), "event_id"), Types.STRING, env)) {
            harness.open();
            for (int i = 0; i < 4; i++) harness.processElement(ConfirmedSalesTest.EVENT, i);
            assertEquals(3, counters.get("duplicate_events").getCount());
            assertEquals(java.util.List.of(ConfirmedSalesTest.EVENT), harness.extractOutputValues());
        }
    }
}
