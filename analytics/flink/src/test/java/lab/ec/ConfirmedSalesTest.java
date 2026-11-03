package lab.ec;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import org.apache.flink.api.common.typeinfo.Types;
import org.apache.flink.streaming.api.operators.KeyedProcessOperator;
import org.apache.flink.streaming.util.KeyedOneInputStreamOperatorTestHarness;
import org.junit.jupiter.api.Test;

class ConfirmedSalesTest {
    @Test void catalogAssignedFieldIdsAreCompatibleOnRestart() {
        var expected = org.apache.iceberg.flink.FlinkSchemaUtil.convert(ConfirmedSales.BRONZE);
        var ids = new java.util.concurrent.atomic.AtomicInteger(100);
        var assigned = org.apache.iceberg.types.TypeUtil.assignFreshIds(expected, ids::incrementAndGet);
        assertDoesNotThrow(() -> ConfirmedSales.verifySchema(assigned, expected));
        var wrong = org.apache.iceberg.flink.FlinkSchemaUtil.convert(ConfirmedSales.GOLD);
        assertThrows(IllegalStateException.class, () -> ConfirmedSales.verifySchema(wrong, expected));
    }
    static final String EVENT = """
        {"event_id":"11111111-1111-4111-8111-111111111111","event_type":"order_confirmed",
         "occurred_at":"2026-10-31T10:00:00+09:00","order_id":"22222222-2222-4222-8222-222222222222",
         "items":[{"order_item_id":1,"inventory_id":10,"quantity":2,"unit_price_at_order":100,"net_amount":200},
                  {"order_item_id":2,"inventory_id":11,"quantity":1,"unit_price_at_order":0,"net_amount":0}]}
        """;

    @Test void allLinesAndUtcTimestamp() {
        var event = Events.validate(EVENT);
        assertEquals(6, Events.bronze(EVENT).getArity());
        assertEquals(EVENT, Events.bronze(EVENT).getField(4));
        var rows = new ArrayList<org.apache.flink.types.Row>();
        for (var item : event.get("items")) rows.add(Events.gold(event, item));
        assertEquals(2, rows.size());
        assertEquals(200L, rows.get(0).getField(6));
        assertEquals(0L, rows.get(1).getField(6));
        assertEquals(java.time.LocalDateTime.parse("2026-10-31T01:00:00"), rows.get(0).getField(7));
    }

    @Test void invalidEventsNeverPassValidation() throws Exception {
        for (String field : new String[]{"event_id", "event_type", "occurred_at", "order_id", "items"}) {
            var event = Events.parse(EVENT).deepCopy();
            ((com.fasterxml.jackson.databind.node.ObjectNode) event).remove(field);
            assertThrows(IllegalArgumentException.class, () -> Events.validate(event.toString()), field);
        }
        for (String field : new String[]{"order_item_id", "inventory_id", "quantity", "unit_price_at_order", "net_amount"}) {
            for (String invalid : new String[]{"null", "\"1\"", "1.5", "true", "-1", "9223372036854775808"}) {
                var event = Events.parse(EVENT);
                ((com.fasterxml.jackson.databind.node.ObjectNode) event.get("items").get(1))
                        .set(field, Events.JSON.readTree(invalid));
                assertThrows(IllegalArgumentException.class, () -> Events.validate(event.toString()), field + ": " + invalid);
            }
        }
        for (String invalid : new String[]{
                EVENT.replace("\"quantity\":2", "\"quantity\":0"),
                EVENT.replace("\"net_amount\":200", "\"net_amount\":201"),
                EVENT.replace("\"unit_price_at_order\":100", "\"unit_price_at_order\":9223372036854775807"),
                EVENT.replace("\"order_item_id\":2", "\"order_item_id\":1"),
                EVENT.replace("2026-10-31T10:00:00+09:00", "2026-10-31T10:00:00"),
                EVENT.replace("11111111-1111-4111-8111-111111111111", "invalid"),
                "{}", "null", "[]", "broken", EVENT + " {}",
                "{\"event_type\":\"other\",\"event_type\":\"order_confirmed\"}"}) {
            assertThrows(IllegalArgumentException.class, () -> Events.validate(invalid));
        }
        assertNull(Events.validate("{\"event_type\":\"order_cancelled\"}"));
    }

    @Test void rejectedEventDoesNotStopFollowingEvents() throws Exception {
        try (var validation = new org.apache.flink.streaming.util.OneInputStreamOperatorTestHarness<String, String>(
                new org.apache.flink.streaming.api.operators.StreamFlatMap<>(new Validate()))) {
            validation.open();
            validation.processElement("broken", 0);
            validation.processElement(EVENT.replace("\"net_amount\":200", "\"net_amount\":201"), 1);
            validation.processElement(EVENT, 2);
            assertEquals(java.util.List.of(EVENT), validation.extractOutputValues());
        }
    }

    private KeyedOneInputStreamOperatorTestHarness<String, String, String> harness() throws Exception {
        return new KeyedOneInputStreamOperatorTestHarness<>(
                new KeyedProcessOperator<>(new Deduplicate()),
                raw -> Events.text(Events.parse(raw), "event_id"), Types.STRING);
    }

    @Test void duplicateIdsSurviveCheckpointRestore() throws Exception {
        org.apache.flink.runtime.checkpoint.OperatorSubtaskState checkpoint;
        try (var first = harness()) {
            first.open();
            first.processElement(EVENT, 0);
            first.processElement(EVENT, 1);
            assertEquals(1, first.extractOutputValues().size());
            checkpoint = first.snapshot(1, 2);
        }
        try (var restored = harness()) {
            restored.initializeState(checkpoint);
            restored.open();
            restored.processElement(EVENT, 3);
            assertTrue(restored.extractOutputValues().isEmpty());
            restored.processElement(EVENT.replace("11111111-1111-4111-8111-111111111111",
                    "33333333-3333-4333-8333-333333333333"), 4);
            assertEquals(1, restored.extractOutputValues().size());
        }
    }
}
