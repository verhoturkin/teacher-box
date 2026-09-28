package ru.teacherbox.platform.settings;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Properties;
import java.util.TreeMap;

/**
 * The values the administrator set: {@code <data-dir>/config/settings.properties}, variable names as
 * keys (ADR-0016). Outside the database, because some of them are needed before it is opened; outside
 * the backups, so that restoring a backup does not change the server's settings.
 */
public final class SettingsFile {

    static final String LOCATION = "config/settings.properties";

    private final Path file;

    public SettingsFile(Path dataDir) {
        this.file = dataDir.resolve(LOCATION);
    }

    /** The saved values of the settings the administrator may change; nothing if there is no file. */
    public Map<String, String> read() {
        Map<String, String> values = new TreeMap<>();
        if (!Files.isRegularFile(file)) {
            return values;
        }
        Properties properties = new Properties();
        try (InputStream in = Files.newInputStream(file)) {
            properties.load(in);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + file, e);
        }
        for (String name : properties.stringPropertyNames()) {
            if (SettingsCatalog.find(name).filter(SettingDefinition::editable).isPresent()) {
                values.put(name, properties.getProperty(name));
            }
        }
        return values;
    }

    /** Replaces the file at once (a half-written file would be read on the next start). */
    public void write(Map<String, String> values) {
        Properties properties = new Properties();
        properties.putAll(values);
        try {
            Files.createDirectories(file.getParent());
            Path partial = file.resolveSibling(file.getFileName() + ".part");
            try (OutputStream out = Files.newOutputStream(partial)) {
                properties.store(out, "Settings of the portal changed by the administrator (ADR-0016)");
            }
            Files.move(partial, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write " + file, e);
        }
    }
}
