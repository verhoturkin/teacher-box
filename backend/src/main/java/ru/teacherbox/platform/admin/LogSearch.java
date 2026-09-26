package ru.teacherbox.platform.admin;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Path;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Searches the JSON log (Elastic Common Schema lines written by Spring Boot structured logging). Both the
 * flat ({@code "log.level"}) and the nested ({@code "log": {"level"}}) forms of ECS fields are read.
 */
public class LogSearch {

    public static final int MAX_LIMIT = 1_000;

    /** Log levels from the least to the most severe. */
    public enum Level {
        TRACE,
        DEBUG,
        INFO,
        WARN,
        ERROR;

        static @Nullable Level parse(String value) {
            try {
                return Level.valueOf(value.toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
    }

    /**
     * @param minLevel  the least severe level to show
     * @param logger    part of the logger name
     * @param text      part of the message or the error, case-insensitive
     * @param requestId exact request code
     */
    public record Query(@Nullable Instant from, @Nullable Instant to, @Nullable Level minLevel,
            @Nullable String logger, @Nullable String text, @Nullable String requestId, int limit) {
    }

    /** One log line; {@code error} is the stack trace of the logged exception. */
    public record Entry(Instant timestamp, String level, String logger, String message, @Nullable String requestId,
            @Nullable String thread, @Nullable String error) {
    }

    /**
     * @param entries   newest first
     * @param truncated more lines matched than the limit
     * @param available the log is written to files (file logging is on)
     */
    public record Result(List<Entry> entries, boolean truncated, boolean available) {
    }

    private final LogFiles files;
    private final JsonMapper json;

    public LogSearch(LogFiles files, JsonMapper json) {
        this.files = files;
        this.json = json;
    }

    public Result search(Query query) {
        int limit = Math.clamp(query.limit(), 1, MAX_LIMIT);
        Deque<Entry> found = new ArrayDeque<>(limit + 1);
        boolean truncated = false;
        for (Path file : files.all()) {
            if (query.from() != null && LogFiles.modified(file) < query.from().toEpochMilli()) {
                continue;
            }
            try (BufferedReader reader = LogFiles.open(file)) {
                for (String line = reader.readLine(); line != null; line = reader.readLine()) {
                    Entry entry = parse(line);
                    if (entry != null && matches(entry, query)) {
                        found.addLast(entry);
                        if (found.size() > limit) {
                            found.removeFirst();
                            truncated = true;
                        }
                    }
                }
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        List<Entry> newestFirst = new ArrayList<>(found);
        Collections.reverse(newestFirst);
        return new Result(newestFirst, truncated, files.current() != null);
    }

    @Nullable Entry parse(String line) {
        if (line.isBlank() || line.charAt(0) != '{') {
            return null;
        }
        JsonNode node;
        try {
            node = json.readTree(line);
        } catch (JacksonException e) {
            return null;
        }
        String timestamp = text(node, "@timestamp");
        if (timestamp == null) {
            return null;
        }
        Instant at;
        try {
            at = Instant.parse(timestamp);
        } catch (DateTimeParseException e) {
            return null;
        }
        String error = text(node, "error.stack_trace");
        if (error == null) {
            error = text(node, "error.message");
        }
        return new Entry(at, orEmpty(text(node, "log.level")), orEmpty(text(node, "log.logger")),
                orEmpty(text(node, "message")), text(node, "requestId"), text(node, "process.thread.name"), error);
    }

    private static boolean matches(Entry entry, Query query) {
        if (query.from() != null && entry.timestamp().isBefore(query.from())) {
            return false;
        }
        if (query.to() != null && !entry.timestamp().isBefore(query.to())) {
            return false;
        }
        if (query.minLevel() != null) {
            Level level = Level.parse(entry.level());
            if (level == null || level.compareTo(query.minLevel()) < 0) {
                return false;
            }
        }
        if (hasText(query.logger()) && !entry.logger().contains(query.logger().strip())) {
            return false;
        }
        if (hasText(query.requestId()) && !query.requestId().strip().equals(entry.requestId())) {
            return false;
        }
        if (hasText(query.text())) {
            String needle = query.text().strip().toLowerCase(Locale.ROOT);
            return entry.message().toLowerCase(Locale.ROOT).contains(needle)
                    || (entry.error() != null && entry.error().toLowerCase(Locale.ROOT).contains(needle));
        }
        return true;
    }

    /** A field in the flat ({@code "a.b"}) or the nested ({@code {"a": {"b"}}}) form. */
    private static @Nullable String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            value = node;
            for (String part : field.split("\\.")) {
                value = value.get(part);
                if (value == null || value.isNull()) {
                    return null;
                }
            }
        }
        return value.isValueNode() ? value.asString() : value.toString();
    }

    private static boolean hasText(@Nullable String value) {
        return value != null && !value.isBlank();
    }

    private static String orEmpty(@Nullable String value) {
        return value == null ? "" : value;
    }
}
