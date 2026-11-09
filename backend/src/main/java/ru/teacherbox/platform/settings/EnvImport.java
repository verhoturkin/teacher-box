package ru.teacherbox.platform.settings;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.function.UnaryOperator;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.ObjectProvider;
import ru.teacherbox.platform.settings.SettingDefinition.Owner;
import ru.teacherbox.shared.settings.OldSettings;
import ru.teacherbox.shared.settings.TeacherSettingsImport;

/**
 * Takes the teacher's old values from {@code .env} and the administrator's settings file once (ADR-0056):
 * each {@link TeacherSettingsImport} of a module gets the values of its variables that are still set, and the
 * variables are written to {@code <data-dir>/config/imported-settings.properties}, so that a later start
 * reads them no more, whatever they are then. It runs while the beans are created (JDBC beans wait for the
 * migrations), before any bean finishes its start, any runner, scheduled job or request. The file is
 * outside the database: neither a full reset nor a restored backup imports the variables again. A variable
 * no module takes yet (no bean) is not marked and is imported by the version that adds its bean.
 */
public class EnvImport implements InitializingBean {

    static final String LOCATION = "config/imported-settings.properties";
    private static final Logger log = LoggerFactory.getLogger(EnvImport.class);

    private final Path file;
    private final SettingsFile settings;
    private final UnaryOperator<@Nullable String> environment;
    private final ObjectProvider<TeacherSettingsImport> imports;
    private final Clock clock;

    /** @param environment the value of an environment variable by its name ({@code System::getenv}) */
    public EnvImport(Path dataDir, SettingsFile settings, UnaryOperator<@Nullable String> environment,
            ObjectProvider<TeacherSettingsImport> imports, Clock clock) {
        this.file = dataDir.resolve(LOCATION);
        this.settings = settings;
        this.environment = environment;
        this.imports = imports;
        this.clock = clock;
    }

    @Override
    public void afterPropertiesSet() {
        run();
    }

    /** Imports what was not imported yet and warns about every teacher's variable still set. */
    public synchronized void run() {
        Map<String, String> done = read();
        Map<String, String> saved = settings.read();
        String now = clock.instant().toString();
        boolean changed = false;
        for (TeacherSettingsImport module : imports.orderedStream().toList()) {
            Set<String> pending = new TreeSet<>(module.names());
            pending.removeAll(done.keySet());
            if (pending.isEmpty()) {
                continue;
            }
            Map<String, String> values = new TreeMap<>();
            for (String name : pending) {
                String value = value(name, saved);
                if (value != null) {
                    values.put(name, value);
                }
            }
            Set<String> stored;
            try {
                stored = module.importFrom(new OldSettings(values));
            } catch (RuntimeException e) {
                // not marked: the next start tries again
                log.warn("Importing the teacher's settings {} failed", pending, e);
                continue;
            }
            stored.forEach(name -> log.info("Imported {} into the teacher's settings", name));
            pending.forEach(name -> done.put(name, now));
            changed = true;
        }
        if (changed) {
            write(done);
        }
        for (String name : stillSet(saved)) {
            log.warn("{} is no longer read: the teacher changes it in the portal; remove it from .env", name);
        }
    }

    private List<String> stillSet(Map<String, String> saved) {
        return SettingsCatalog.all().stream()
                .filter(setting -> setting.owner() == Owner.TEACHER)
                .map(SettingDefinition::name)
                .filter(name -> value(name, saved) != null)
                .toList();
    }

    /**
     * The administrator's settings file wins over {@code .env}, as it did when the setting was read (ADR-0016);
     * an empty value is set too (e.g. no reminders).
     */
    private @Nullable String value(String name, Map<String, String> saved) {
        return saved.containsKey(name) ? saved.get(name) : environment.apply(name);
    }

    /** The imported variables and when. */
    Map<String, String> read() {
        Map<String, String> done = new TreeMap<>();
        if (!Files.isRegularFile(file)) {
            return done;
        }
        Properties properties = new Properties();
        try (InputStream in = Files.newInputStream(file)) {
            properties.load(in);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + file, e);
        }
        properties.stringPropertyNames().forEach(name -> done.put(name, properties.getProperty(name)));
        return done;
    }

    private void write(Map<String, String> done) {
        Properties properties = new Properties();
        properties.putAll(done);
        try {
            Files.createDirectories(file.getParent());
            Path partial = file.resolveSibling(file.getFileName() + ".part");
            try (OutputStream out = Files.newOutputStream(partial)) {
                properties.store(out, "Teacher's settings imported from .env once (ADR-0056): never read again");
            }
            Files.move(partial, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write " + file, e);
        }
    }
}
