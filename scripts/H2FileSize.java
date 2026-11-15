import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Locale;
import java.util.Random;
import java.util.UUID;

/** Standalone JDBC experiment; see docs/measurements/h2-file-size.md. */
public class H2FileSize {
    private static final int SCENE_BYTES = 1024 * 1024;
    private static final UUID BOARD = UUID.fromString("00000000-0000-0000-0000-000000000001");

    public static void main(String[] args) throws Exception {
        if (args.length < 2 || args.length > 4) {
            throw new IllegalArgumentException("Usage: H2FileSize write|reopen DIRECTORY [default|compact-ms] [saves]");
        }
        Path directory = Path.of(args[1]).toAbsolutePath().normalize();
        if (directory.toString().contains(";")) {
            throw new IllegalArgumentException("Directory must not contain JDBC option separators");
        }
        String compact = args.length > 2 ? args[2] : "default";
        if (!compact.equals("default") && Integer.parseInt(compact) < 0) {
            throw new IllegalArgumentException("compact-ms must be non-negative");
        }
        int saves = args.length > 3 ? Integer.parseInt(args[3]) : 10_000;
        if (saves < 1) {
            throw new IllegalArgumentException("saves must be positive");
        }
        boolean write = args[0].equals("write");
        if (!write && !args[0].equals("reopen")) {
            throw new IllegalArgumentException("Unknown phase");
        }
        if (write) {
            // Refuse existing directories: never open a portal's database for this experiment.
            Files.createDirectory(directory);
            Files.writeString(directory.resolve("experiment"), compact + "\n" + saves);
        }
        if (!Files.readString(directory.resolve("experiment")).equals(compact + "\n" + saves)) {
            throw new IllegalArgumentException("Experiment parameters do not match");
        }
        String url = Files.readAllLines(Path.of("backend/src/main/resources/application.yaml")).stream()
                .map(String::strip).filter(line -> line.startsWith("url: jdbc:h2:"))
                .findFirst().orElseThrow().substring("url: ".length())
                .replace("${teacherbox.data-dir}", directory.toString());
        if (!compact.equals("default")) {
            url = url.replaceAll(";MAX_COMPACT_TIME=[0-9]+", "") + ";MAX_COMPACT_TIME=" + compact;
        }
        System.out.printf("phase=%s java=%s compact_ms=%s saves=%d scene_bytes=%d%n",
                args[0], System.getProperty("java.version"), compact, saves, SCENE_BYTES);
        long opened = System.nanoTime();
        Connection connection = DriverManager.getConnection(url + (write ? "" : ";IFEXISTS=TRUE"), "sa", "");
        System.out.printf(Locale.ROOT, "open_ms=%.3f h2=%s%n", millis(opened),
                connection.getMetaData().getDatabaseProductVersion());
        try (connection) {
            if (write) {
                initialise(connection);
                System.out.println("before_saves_db_bytes=" + size(directory.resolve("db")));
                save(connection, directory, saves);
            }
            verify(connection, saves);
            System.out.println((write ? "before_close" : "after_restart")
                    + "_db_bytes=" + size(directory.resolve("db")));
            opened = System.nanoTime();
        }
        System.out.printf(Locale.ROOT, "close_ms=%.3f closed_db_bytes=%d%n",
                millis(opened), size(directory.resolve("db")));
        System.out.println("max_heap_bytes=" + Runtime.getRuntime().maxMemory());
        Path status = Path.of("/proc/self/status");
        if (Files.exists(status)) {
            Files.readAllLines(status).stream().filter(line -> line.startsWith("VmHWM:"))
                    .forEach(System.out::println);
        }
        for (String name : new String[] {"memory.max", "memory.peak"}) {
            Path metric = Path.of("/sys/fs/cgroup", name);
            if (Files.exists(metric)) {
                System.out.println(name + "=" + Files.readString(metric).strip());
            }
        }

    }

    private static void initialise(Connection connection) throws Exception {
        try (var statement = connection.createStatement()) {
            statement.execute("create schema boards");
            statement.execute("set schema boards");
            // Use the real CLOB definition and indexes, not a surrogate VARCHAR table.
            String migration = Files.readString(Path.of(
                    "backend/src/main/resources/db/migration/boards/V1__create_boards_schema.sql"));
            for (String sql : migration.split(";")) {
                if (!sql.isBlank()) {
                    statement.execute(sql);
                }
            }
            statement.execute("""
                    insert into boards.boards (id, kind, title, created_at, updated_at, version)
                    values ('%s', 'EXCALIDRAW', 'Measurement', current_timestamp, current_timestamp, 0)
                    """.formatted(BOARD));
            statement.execute("""
                    insert into boards.board_scenes
                        (board_id, elements, app_state, scene_version, updated_at)
                    values ('%s', '[]', '{}', 0, current_timestamp)
                    """.formatted(BOARD));
            statement.execute("checkpoint sync");
        }
    }

    private static String scene(int version) {
        String prefix = "[{\"id\":\"measurement\",\"type\":\"text\",\"version\":%10d,\"text\":\""
                .formatted(version);
        String suffix = "\"}]";
        char[] text = new char[SCENE_BYTES - prefix.length() - suffix.length()];
        Random random = new Random(393);
        String alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
        for (int i = 0; i < text.length; i++) {
            text[i] = alphabet.charAt(random.nextInt(alphabet.length()));
        }
        return prefix + new String(text) + suffix;
    }

    private static void save(Connection connection, Path directory, int saves) throws Exception {
        String initial = scene(0);
        int versionOffset = initial.indexOf("         0");
        long started = System.nanoTime();
        connection.setAutoCommit(false);
        try (var update = connection.prepareStatement("""
                update boards.board_scenes set elements = ?, app_state = '{}', scene_version = ?,
                    updated_at = current_timestamp, updated_by = null where board_id = ?
                """)) {
            for (int i = 1; i <= saves; i++) {
                String payload = initial.substring(0, versionOffset) + "%10d".formatted(i)
                        + initial.substring(versionOffset + 10);
                update.setString(1, payload);
                update.setLong(2, i);
                update.setObject(3, BOARD);
                if (update.executeUpdate() != 1) {
                    throw new IllegalStateException("Scene was not updated");
                }
                connection.commit();
                if (i % 1000 == 0 || i == saves) {
                    System.out.printf("saved=%d db_bytes=%d%n", i, size(directory.resolve("db")));
                }
            }
        }
        // Include the final committed writes in the pre-close size (default WRITE_DELAY is retained).
        try (var statement = connection.createStatement()) {
            statement.execute("checkpoint sync");
        }
        System.out.printf(Locale.ROOT, "save_ms=%.3f%n", millis(started));
    }

    private static void verify(Connection connection, int saves) throws Exception {
        try (var statement = connection.createStatement();
                var result = statement.executeQuery("select elements, scene_version from boards.board_scenes")) {
            if (!result.next() || result.getLong(2) != saves || !scene(saves).equals(result.getString(1))
                    || result.next()) {
                throw new IllegalStateException("Final scene did not survive");
            }
        }
        System.out.println("final_scene_verified=true");
    }

    private static long size(Path directory) throws Exception {
        try (var files = Files.walk(directory)) {
            long total = 0;
            for (Path file : files.filter(Files::isRegularFile).toList()) {
                total += Files.size(file);
            }
            return total;
        }
    }

    private static double millis(long started) {
        return (System.nanoTime() - started) / 1_000_000.0;
    }
}
