package ru.teacherbox.platform.admin;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.zip.GZIPOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import ru.teacherbox.platform.admin.LogSearch.Entry;
import ru.teacherbox.platform.admin.LogSearch.Level;
import ru.teacherbox.platform.admin.LogSearch.Query;
import ru.teacherbox.platform.admin.LogSearch.Result;
import tools.jackson.databind.json.JsonMapper;

class LogSearchTest {

    @TempDir
    Path dir;

    /** Nested ECS lines (Spring Boot 3.5+) and the flat form of older versions. */
    private static final String ROTATED = """
            {"@timestamp":"2026-09-25T10:00:00Z","log":{"level":"INFO","logger":"ru.teacherbox.billing.Payments"},"message":"Old payment","requestId":"old1"}
            not a json line
            """;
    private static final String CURRENT = """
            {"@timestamp":"2026-09-26T09:00:00Z","log.level":"DEBUG","log.logger":"ru.teacherbox.notifications.Telegram","message":"Polling","process.thread.name":"main"}
            {"@timestamp":"2026-09-26T10:00:00Z","log":{"level":"ERROR","logger":"ru.teacherbox.platform.web.ProblemDetailsAdvice"},"message":"Unhandled exception","requestId":"abc123","error":{"type":"java.lang.IllegalStateException","message":"boom","stack_trace":"java.lang.IllegalStateException: boom\\n\\tat Foo"}}
            {"@timestamp":"2026-09-26T11:00:00Z","log":{"level":"WARN","logger":"ru.teacherbox.client"},"message":"Browser error","requestId":"xyz789"}
            {"@timestamp":"not a time","message":"skipped"}
            {"message":"no timestamp"}
            """;

    @Test
    void readsCurrentAndRotatedFilesNewestFirst() throws IOException {
        Result result = search(new Query(null, null, null, null, null, null, 100));

        assertThat(result.available()).isTrue();
        assertThat(result.truncated()).isFalse();
        assertThat(result.entries()).extracting(Entry::message)
                .containsExactly("Browser error", "Unhandled exception", "Polling", "Old payment");
        Entry error = result.entries().get(1);
        assertThat(error.level()).isEqualTo("ERROR");
        assertThat(error.logger()).isEqualTo("ru.teacherbox.platform.web.ProblemDetailsAdvice");
        assertThat(error.requestId()).isEqualTo("abc123");
        assertThat(error.error()).startsWith("java.lang.IllegalStateException: boom");
        assertThat(result.entries().get(2).thread()).isEqualTo("main");
    }

    @Test
    void filtersByLevelLoggerTextRequestAndPeriod() throws IOException {
        assertThat(search(new Query(null, null, Level.WARN, null, null, null, 100)).entries())
                .extracting(Entry::message).containsExactly("Browser error", "Unhandled exception");
        assertThat(search(new Query(null, null, null, "notifications", null, null, 100)).entries())
                .extracting(Entry::message).containsExactly("Polling");
        assertThat(search(new Query(null, null, null, null, "BOOM", null, 100)).entries())
                .extracting(Entry::message).containsExactly("Unhandled exception");
        assertThat(search(new Query(null, null, null, null, "payment", null, 100)).entries())
                .extracting(Entry::message).containsExactly("Old payment");
        assertThat(search(new Query(null, null, null, null, null, " xyz789 ", 100)).entries())
                .extracting(Entry::message).containsExactly("Browser error");
        assertThat(search(new Query(Instant.parse("2026-09-26T09:30:00Z"), Instant.parse("2026-09-26T11:00:00Z"),
                null, null, null, null, 100)).entries())
                .extracting(Entry::message).containsExactly("Unhandled exception");
    }

    @Test
    void keepsTheNewestLinesWithinTheLimit() throws IOException {
        Result result = search(new Query(null, null, null, null, null, null, 2));

        assertThat(result.truncated()).isTrue();
        assertThat(result.entries()).extracting(Entry::message).containsExactly("Browser error", "Unhandled exception");
    }

    @Test
    void skipsRotatedFilesOlderThanThePeriod() throws IOException {
        Result result = search(new Query(Instant.parse("2026-09-26T00:00:00Z"), null, Level.INFO, null, null, null,
                100));

        assertThat(result.entries()).extracting(Entry::message).containsExactly("Browser error", "Unhandled exception");
    }

    @Test
    void worksWithoutLogFiles() {
        LogSearch off = new LogSearch(new LogFiles(null), JsonMapper.builder().build());
        LogSearch missing = new LogSearch(new LogFiles(dir.resolve("none/teacher-box.log")),
                JsonMapper.builder().build());

        assertThat(off.search(new Query(null, null, null, null, null, null, 10)).available()).isFalse();
        assertThat(missing.search(new Query(null, null, null, null, null, null, 10)).entries()).isEmpty();
        assertThat(new LogFiles(null).totalSize()).isZero();
    }

    private Result search(Query query) throws IOException {
        Path current = dir.resolve("teacher-box.log");
        Files.writeString(current, CURRENT);
        Path rotated = dir.resolve("teacher-box.log.2026-09-25.0.gz");
        try (OutputStream out = new GZIPOutputStream(Files.newOutputStream(rotated))) {
            out.write(ROTATED.getBytes(StandardCharsets.UTF_8));
        }
        Files.setLastModifiedTime(rotated, FileTime.from(Instant.parse("2026-09-25T10:00:00Z")));
        Files.writeString(dir.resolve("other.log"), "{}");
        LogFiles files = new LogFiles(current);
        assertThat(files.all()).containsExactly(rotated, current);
        assertThat(files.totalSize()).isPositive();
        return new LogSearch(files, JsonMapper.builder().build()).search(query);
    }
}
