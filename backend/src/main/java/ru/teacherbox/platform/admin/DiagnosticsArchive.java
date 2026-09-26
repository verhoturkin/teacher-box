package ru.teacherbox.platform.admin;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.EnumerablePropertySource;
import tools.jackson.databind.json.JsonMapper;

/**
 * An archive for the developer (ADR-0010): the latest log files, the settings of the instance with secrets
 * hidden and the technical state. Users' data is not included.
 */
public class DiagnosticsArchive {

    /** Log files are added newest first until this size. */
    static final long MAX_LOGS_BYTES = 20L * 1024 * 1024;
    static final String HIDDEN = "***";

    private static final List<String> PREFIXES = List.of("teacherbox.", "TEACHERBOX_", "logging.", "LOGGING_",
            "server.", "spring.datasource.url", "management.");
    private static final Pattern SECRET = Pattern.compile("password|secret|token|credential|api[-_.]?key|private",
            Pattern.CASE_INSENSITIVE);

    private final ConfigurableEnvironment environment;
    private final SystemStatus status;
    private final EventPublications events;
    private final LogFiles logs;
    private final JsonMapper json;

    public DiagnosticsArchive(ConfigurableEnvironment environment, SystemStatus status, EventPublications events,
            LogFiles logs, JsonMapper json) {
        this.environment = environment;
        this.status = status;
        this.events = events;
        this.logs = logs;
        this.json = json;
    }

    public void write(OutputStream out) throws IOException {
        ZipOutputStream zip = new ZipOutputStream(out);
        add(zip, "status.json", json.writer().withDefaultPrettyPrinter().writeValueAsBytes(Map.of(
                "system", status.status(),
                "os", System.getProperty("os.name") + " " + System.getProperty("os.version") + " "
                        + System.getProperty("os.arch"),
                "incompleteEvents", events.incomplete())));
        add(zip, "settings.txt", settings().getBytes(StandardCharsets.UTF_8));
        long budget = MAX_LOGS_BYTES;
        List<Path> files = new ArrayList<>(logs.all());
        Collections.reverse(files);
        for (Path file : files) {
            long size = Files.size(file);
            if (size > budget) {
                break;
            }
            zip.putNextEntry(new ZipEntry("logs/" + file.getFileName()));
            Files.copy(file, zip);
            zip.closeEntry();
            budget -= size;
        }
        zip.finish();
    }

    /** {@code key=value} lines of the instance settings; secrets are replaced with {@value #HIDDEN}. */
    String settings() {
        Map<String, String> values = new TreeMap<>();
        for (var source : environment.getPropertySources()) {
            if (source instanceof EnumerablePropertySource<?> enumerable) {
                for (String name : enumerable.getPropertyNames()) {
                    if (PREFIXES.stream().anyMatch(name::startsWith) && !values.containsKey(name)) {
                        values.put(name, value(name));
                    }
                }
            }
        }
        StringBuilder text = new StringBuilder();
        values.forEach((name, value) -> text.append(name).append('=').append(value).append('\n'));
        return text.toString();
    }

    private String value(String name) {
        String value;
        try {
            value = environment.getProperty(name);
        } catch (IllegalArgumentException e) {
            return "<unresolved>";
        }
        if (value == null) {
            return "";
        }
        return SECRET.matcher(name.toLowerCase(Locale.ROOT)).find() && !value.isEmpty() ? HIDDEN : value;
    }

    private static void add(ZipOutputStream zip, String name, byte[] content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content);
        zip.closeEntry();
    }
}
