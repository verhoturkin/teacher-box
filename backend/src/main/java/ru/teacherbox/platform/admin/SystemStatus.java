package ru.teacherbox.platform.admin;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.health.actuate.endpoint.CompositeHealthDescriptor;
import org.springframework.boot.health.actuate.endpoint.HealthDescriptor;
import org.springframework.boot.health.actuate.endpoint.HealthEndpoint;
import org.springframework.boot.info.BuildProperties;

/** Technical state of the instance for the administrator: no data of users. */
public class SystemStatus {

    /**
     * @param version    application version ({@code null} when built without build info)
     * @param uptime     seconds since start
     * @param heapUsed   bytes
     * @param diskFree   bytes free on the data volume
     * @param dataSize   bytes of the database files
     * @param logsSize   bytes of the log files
     * @param health     overall status, e.g. {@code UP}
     * @param components status of health components, e.g. {@code db → UP}
     */
    public record Status(
            @Nullable String version,
            @Nullable Instant builtAt,
            Instant startedAt,
            long uptime,
            String javaVersion,
            String timeZone,
            String dataDir,
            long heapUsed,
            long heapMax,
            long diskFree,
            long diskTotal,
            long dataSize,
            long logsSize,
            String health,
            Map<String, String> components) {
    }

    private final Path dataDir;
    private final LogFiles logs;
    private final String timeZone;
    private final ObjectProvider<BuildProperties> build;
    private final ObjectProvider<HealthEndpoint> health;
    private final Clock clock;

    public SystemStatus(Path dataDir, LogFiles logs, String timeZone, ObjectProvider<BuildProperties> build,
            ObjectProvider<HealthEndpoint> health, Clock clock) {
        this.dataDir = dataDir;
        this.logs = logs;
        this.timeZone = timeZone;
        this.build = build;
        this.health = health;
        this.clock = clock;
    }

    public Status status() {
        BuildProperties info = build.getIfAvailable();
        Runtime runtime = Runtime.getRuntime();
        long uptime = ManagementFactory.getRuntimeMXBean().getUptime();
        Instant now = clock.instant();
        long[] disk = disk();
        Map<String, String> components = new LinkedHashMap<>();
        String overall = "UNKNOWN";
        HealthEndpoint endpoint = health.getIfAvailable();
        if (endpoint != null) {
            HealthDescriptor descriptor = endpoint.health();
            overall = descriptor.getStatus().getCode();
            if (descriptor instanceof CompositeHealthDescriptor composite) {
                composite.getComponents().forEach((name, component) ->
                        components.put(name, component.getStatus().getCode()));
            }
        }
        return new Status(
                info == null ? null : info.getVersion(),
                info == null ? null : info.getTime(),
                now.minus(Duration.ofMillis(uptime)),
                uptime / 1_000,
                Runtime.version().toString(),
                timeZone,
                dataDir.toAbsolutePath().normalize().toString(),
                runtime.totalMemory() - runtime.freeMemory(),
                runtime.maxMemory(),
                disk[0],
                disk[1],
                size(dataDir.resolve("db")),
                logs.totalSize(),
                overall,
                components);
    }

    private long[] disk() {
        Path existing = Files.exists(dataDir) ? dataDir : dataDir.toAbsolutePath().getRoot();
        if (existing == null) {
            return new long[] {0, 0};
        }
        try {
            FileStore store = Files.getFileStore(existing);
            return new long[] {store.getUsableSpace(), store.getTotalSpace()};
        } catch (IOException e) {
            return new long[] {0, 0};
        }
    }

    private static long size(Path directory) {
        if (!Files.isDirectory(directory)) {
            return 0;
        }
        try (Stream<Path> files = Files.walk(directory)) {
            return files.filter(Files::isRegularFile).mapToLong(file -> {
                try {
                    return Files.size(file);
                } catch (IOException e) {
                    return 0;
                }
            }).sum();
        } catch (IOException e) {
            return 0;
        }
    }
}
