package lab.ec;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.UUID;
import org.apache.flink.types.Row;

/** The Kafka value is the expanded Outbox JSON, without a Debezium envelope. */
public final class Events {
    static final ObjectMapper JSON = new ObjectMapper()
            .enable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);

    static JsonNode parse(String value) {
        try {
            JsonNode event = JSON.readTree(value);
            if (event == null || !event.isObject()) throw new IllegalArgumentException("json");
            return event;
        } catch (Exception e) {
            throw new IllegalArgumentException("json");
        }
    }

    static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isTextual() || value.textValue().isBlank())
            throw new IllegalArgumentException(field);
        return value.textValue();
    }

    static long number(JsonNode node, String field, long minimum) {
        JsonNode value = node.get(field);
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong()
                || value.longValue() < minimum) throw new IllegalArgumentException(field);
        return value.longValue();
    }

    static void uuid(JsonNode event, String field) {
        String value = text(event, field);
        try {
            if (!UUID.fromString(value).toString().equals(value)) throw new Exception();
        } catch (Exception e) {
            throw new IllegalArgumentException(field);
        }
    }

    static java.time.LocalDateTime timestamp(JsonNode event) {
        try {
            return OffsetDateTime.parse(text(event, "occurred_at"))
                    .withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
        } catch (Exception e) {
            throw new IllegalArgumentException("occurred_at");
        }
    }

    /** Returns null for other event types. Validates the entire event before emitting any row. */
    static JsonNode validate(String raw) {
        JsonNode event = parse(raw);
        if (!text(event, "event_type").equals("order_confirmed")) return null;
        uuid(event, "event_id");
        uuid(event, "order_id");
        timestamp(event);
        JsonNode items = event.get("items");
        if (items == null || !items.isArray() || items.isEmpty())
            throw new IllegalArgumentException("items");
        var ids = new HashSet<Long>();
        for (JsonNode item : items) {
            if (!item.isObject()) throw new IllegalArgumentException("items");
            if (!ids.add(number(item, "order_item_id", 1)))
                throw new IllegalArgumentException("duplicate_order_item_id");
            number(item, "inventory_id", 1);
            long quantity = number(item, "quantity", 1);
            long price = number(item, "unit_price_at_order", 0);
            long amount = number(item, "net_amount", 0);
            try {
                if (Math.multiplyExact(quantity, price) != amount)
                    throw new IllegalArgumentException("net_amount_mismatch");
            } catch (ArithmeticException e) {
                throw new IllegalArgumentException("net_amount_overflow");
            }
        }
        return event;
    }

    static Row bronze(String raw) {
        JsonNode event = parse(raw);
        return Row.of(text(event, "event_id"), text(event, "event_type"), timestamp(event),
                text(event, "order_id"), raw, java.time.LocalDateTime.now(ZoneOffset.UTC));
    }

    static Row gold(JsonNode event, JsonNode item) {
        return Row.of(text(event, "event_id"), text(event, "order_id"),
                item.get("order_item_id").longValue(), item.get("inventory_id").longValue(),
                item.get("quantity").longValue(), item.get("unit_price_at_order").longValue(),
                Math.multiplyExact(item.get("quantity").longValue(), item.get("unit_price_at_order").longValue()),
                timestamp(event));
    }
}
