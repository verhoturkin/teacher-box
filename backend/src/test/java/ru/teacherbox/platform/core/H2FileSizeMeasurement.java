package ru.teacherbox.platform.core;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.io.TempDir;

/**
 * Measurement of plan stage 393.1, not part of the regular build: how the H2 file of the portal grows
 * when a board scene is saved many times, and what a restart and the compaction options win back.
 *
 * <p>It opens the database with the JDBC URL of {@code application.yaml} ({@code jdbc:h2:async:…;
 * DB_CLOSE_ON_EXIT=FALSE}), creates {@code boards.board_scenes} as migration V1 does, and updates one
 * row with a scene of {@code sceneBytes} characters {@code saves} times, one transaction per save as
 * {@code SceneService.save} does. Then it measures {@code db/} while open, after a plain close (the
 * last connection goes away, as on a graceful shutdown of the application), after a reopen, after
 * {@code SHUTDOWN COMPACT}, and after a close with a long {@code MAX_COMPACT_TIME}.
 *
 * <pre>
 * ./mvnw -q test -Dtest=H2FileSizeMeasurement -Djacoco.skip=true -Dteacherbox.measure.h2=true \
 *     -Dteacherbox.measure.saves=10000 -Dteacherbox.measure.scene-bytes=1000000 \
 *     -Dteacherbox.measure.pause-ms=0 -Dteacherbox.measure.idle-s=60 -Dteacherbox.measure.url-prefix=async:
 * </pre>
 *
 * With {@code pause-ms=0} the saves follow each other as fast as the disk allows (the worst case: up to
 * {@code saves × scene} of disk); the editor saves at most once a second ({@code SAVE_DELAY_MS}).
 *
 * The report is printed and written to {@code target/h2-file-size.txt}.
 */
@Tag("measurement")
@EnabledIfSystemProperty(named = "teacherbox.measure.h2", matches = "true")
class H2FileSizeMeasurement {

    private static final long MB = 1024 * 1024;

    private final int saves = Integer.getInteger("teacherbox.measure.saves", 10_000);
    private final int sceneBytes = Integer.getInteger("teacherbox.measure.scene-bytes", 1_000_000);
    private final int pauseMillis = Integer.getInteger("teacherbox.measure.pause-ms", 0);
    private final String prefix = System.getProperty("teacherbox.measure.url-prefix", "async:");
    private final int idleSeconds = Integer.getInteger("teacherbox.measure.idle-s", 60);
    private final List<String> report = new ArrayList<>();

    @TempDir
    Path dataDir;

    @Test
    void measuresFileSizeAfterManySaves() throws Exception {
        Path db = dataDir.resolve("db");
        String url = "jdbc:h2:" + prefix + db.resolve("teacherbox") + ";DB_CLOSE_ON_EXIT=FALSE";
        line("url=%s, saves=%d, scene=%d chars, pause=%d ms, max heap=%d MB, h2=%s", prefix, saves, sceneBytes,
                pauseMillis,
                Runtime.getRuntime().maxMemory() / MB, org.h2.engine.Constants.FULL_VERSION);
        UUID board = UUID.randomUUID();
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            createSchema(connection, board);
            line("after the first save: %s", size(db));
            long started = System.nanoTime();
            save(connection, board, 1, saves, db);
            line("saves took %d s (%d ms per save)", seconds(started), millis(started) / saves);
            line("open, after %d saves: %s", saves, size(db));
            // The background writer frees chunks older than the retention time (45 s) — does the file stop growing?
            Thread.sleep(idleSeconds * 1000L);
            line("open, idle %d s: %s", idleSeconds, size(db));
            save(connection, board, saves + 1, saves + 100, db);
            line("open, 100 more saves: %s", size(db));
        }
        line("closed (default close, MAX_COMPACT_TIME 200 ms): %s", size(db));

        long reopened = System.nanoTime();
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            line("reopen took %d ms, open: %s", millis(reopened), size(db));
            line("rows: %d", count(connection));
        }
        line("closed again: %s", size(db));

        try (Connection connection = DriverManager.getConnection(url + ";MAX_COMPACT_TIME=60000", "sa", "")) {
            System.gc();
            long heapBefore = usedHeap();
            long compacted = System.nanoTime();
            connection.close();
            line("close with MAX_COMPACT_TIME=60000 took %d ms, heap before %d MB, after %d MB: %s",
                    millis(compacted), heapBefore / MB, usedHeap() / MB, size(db));
        }

        try (Connection connection = DriverManager.getConnection(url, "sa", "");
                Statement statement = connection.createStatement()) {
            long compacted = System.nanoTime();
            statement.execute("SHUTDOWN COMPACT");
            line("SHUTDOWN COMPACT took %d ms: %s", millis(compacted), size(db));
        }

        long last = System.nanoTime();
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            line("reopen after compaction took %d ms, rows: %d, open: %s", millis(last), count(connection),
                    size(db));
        }
        Path out = Path.of("target", "h2-file-size.txt");
        Files.createDirectories(out.getParent());
        Files.write(out, report);
    }

    private static void createSchema(Connection connection, UUID board) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("create schema boards");
            statement.execute("""
                    create table boards.board_scenes (
                        board_id      uuid                     primary key,
                        elements      clob                     not null,
                        app_state     clob                     not null,
                        scene_version bigint                   not null,
                        updated_at    timestamp with time zone not null,
                        updated_by    uuid
                    )""");
        }
        try (PreparedStatement insert = connection.prepareStatement("""
                insert into boards.board_scenes (board_id, elements, app_state, scene_version, updated_at)
                values (?, '[]', '{}', 0, current_timestamp)""")) {
            insert.setObject(1, board);
            insert.executeUpdate();
        }
    }

    private void save(Connection connection, UUID board, int from, int to, Path db)
            throws SQLException, InterruptedException {
        String base = scene(sceneBytes);
        int step = Math.max(1, (to - from + 1) / 10);
        try (PreparedStatement update = connection.prepareStatement("""
                update boards.board_scenes set elements = ?, app_state = '{}', scene_version = ?,
                    updated_at = current_timestamp where board_id = ?""")) {
            for (int version = from; version <= to; version++) {
                // Every save changes the scene a little (a new element version), as an editor does.
                String head = "[{\"version\":" + version + "}";
                update.setString(1, head + base.substring(head.length()));
                update.setLong(2, version);
                update.setObject(3, board);
                try {
                    update.executeUpdate();
                } catch (SQLException e) {
                    Throwable root = e;
                    while (root.getCause() != null) {
                        root = root.getCause();
                    }
                    line("save %d failed at %s: %s", version, size(db), root);
                    for (StackTraceElement frame : root.getStackTrace()) {
                        line("    at %s", frame);
                    }
                    throw e;
                }
                if ((version - from + 1) % step == 0) {
                    line("  save %d: %s", version, size(db));
                }
                if (pauseMillis > 0) {
                    Thread.sleep(pauseMillis);
                }
            }
        }
    }

    /** A JSON array of Excalidraw-like elements of about {@code chars} characters. */
    private static String scene(int chars) {
        StringBuilder scene = new StringBuilder("[");
        int i = 0;
        while (scene.length() < chars - 200) {
            scene.append("{\"id\":\"").append(UUID.randomUUID()).append("\",\"type\":\"freedraw\",\"x\":")
                    .append(i * 7 % 1000).append(",\"y\":").append(i * 13 % 1000)
                    .append(",\"points\":[[0,0],[").append(i % 97).append(',').append(i % 89).append("]]},");
            i++;
        }
        scene.setLength(scene.length() - 1);
        while (scene.length() < chars - 1) {
            scene.append(' ');
        }
        return scene.append(']').toString();
    }

    private static int count(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
                var rs = statement.executeQuery("select count(*) from boards.board_scenes")) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private static String size(Path dir) {
        try (Stream<Path> files = Files.walk(dir)) {
            long bytes = files.filter(Files::isRegularFile).mapToLong(file -> {
                try {
                    return Files.size(file);
                } catch (IOException e) {
                    return 0; // a temporary file of H2 went away while counting
                }
            }).sum();
            return String.format("db/ = %.1f MB", bytes / (double) MB);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static long usedHeap() {
        Runtime runtime = Runtime.getRuntime();
        return runtime.totalMemory() - runtime.freeMemory();
    }

    private static long millis(long since) {
        return (System.nanoTime() - since) / 1_000_000;
    }

    private static long seconds(long since) {
        return millis(since) / 1000;
    }

    private void line(String format, Object... args) {
        String text = String.format(format, args);
        report.add(text);
        System.out.println(text);
    }
}
