package ru.teacherbox.platform.settings;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.ObjectProvider;
import ru.teacherbox.platform.backup.Restarter;
import ru.teacherbox.platform.settings.SettingDefinition.Access;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.security.PasswordConfirmation;

/**
 * The administrator sees every setting of the portal and changes them (ADR-0016): the values go to
 * {@link SettingsFile}, are more important than {@code .env} and apply after a restart.
 */
public class AdminSettingsService {

    /** Where the value in force comes from. */
    public enum Source {
        /** Not set: the portal's default. */
        DEFAULT,
        /** {@code .env} (the environment of the container). */
        ENVIRONMENT,
        /** Set by the administrator in the interface. */
        ADMIN
    }

    /**
     * @param value the value; always {@code null} for a secret and for a setting that is not set
     * @param set   the setting has a non-empty value (the only thing shown about a secret)
     */
    public record SettingView(String name, String group, String title, String hint, SettingKind kind,
            List<String> choices, boolean secret, Access access, Source source, @Nullable String value,
            boolean set) {
    }

    /**
     * @param restartEnabled the portal restarts by itself after a change
     * @param restartNeeded  saved values wait for a restart
     * @param startedAt      when the running portal started: a new value means it has restarted
     */
    public record SettingsView(List<SettingView> settings, boolean restartEnabled, boolean restartNeeded,
            Instant startedAt) {
    }

    /** @param changed names of the changed settings */
    public record Changed(List<String> changed, boolean restarting) {
    }

    private final SettingsFile file;
    private final Map<String, String> applied;
    private final UnaryOperator<@Nullable String> environment;
    private final ObjectProvider<PasswordConfirmation> passwords;
    private final Restarter restarter;
    private final boolean restartEnabled;
    private final Instant startedAt;

    /**
     * @param environment the value of an environment variable by its name ({@code System::getenv})
     */
    public AdminSettingsService(SettingsFile file, UnaryOperator<@Nullable String> environment,
            ObjectProvider<PasswordConfirmation> passwords, Restarter restarter, boolean restartEnabled,
            Instant startedAt) {
        this.file = file;
        this.applied = file.read();
        this.environment = environment;
        this.passwords = passwords;
        this.restarter = restarter;
        this.restartEnabled = restartEnabled;
        this.startedAt = startedAt;
    }

    public SettingsView view() {
        Map<String, String> saved = file.read();
        List<SettingView> settings = SettingsCatalog.all().stream().map(setting -> view(setting, saved)).toList();
        return new SettingsView(settings, restartEnabled, !saved.equals(applied), startedAt);
    }

    /**
     * Saves the values and restarts the portal to apply them.
     *
     * @param values {@code null} value: back to {@code .env}; an empty one: not set, whatever {@code .env} says
     */
    public synchronized Changed change(UUID adminId, String password, Map<String, @Nullable String> values) {
        PasswordConfirmation confirmation = passwords.getIfAvailable();
        if (confirmation == null || !confirmation.matches(adminId, password)) {
            throw new BusinessRuleException("password.wrong-current", "The password is incorrect");
        }
        Map<String, String> saved = file.read();
        Map<String, String> next = new TreeMap<>(saved);
        for (Map.Entry<String, @Nullable String> entry : values.entrySet()) {
            String name = entry.getKey();
            SettingDefinition setting = SettingsCatalog.find(name).orElseThrow(() -> new BusinessRuleException(
                    "settings.unknown", "Unknown setting " + name));
            if (!setting.editable()) {
                throw new BusinessRuleException("settings.read-only", name + " is changed only in .env");
            }
            String value = entry.getValue();
            if (value == null) {
                next.remove(name);
                continue;
            }
            String clean = value.strip();
            String problem = setting.kind().problem(clean, setting.choices());
            if (problem != null) {
                throw new BusinessRuleException("settings.invalid", setting.title() + " (" + name + "): " + problem);
            }
            next.put(name, clean);
        }
        List<String> changed = new ArrayList<>();
        for (SettingDefinition setting : SettingsCatalog.all()) {
            if (!Objects.equals(saved.get(setting.name()), next.get(setting.name()))) {
                changed.add(setting.name());
            }
        }
        if (changed.isEmpty()) {
            return new Changed(List.of(), false);
        }
        file.write(next);
        AuditLog.record(adminId, "settings-change", String.join(", ", changed));
        if (restartEnabled) {
            restarter.restartSoon();
        }
        return new Changed(List.copyOf(changed), restartEnabled);
    }

    private SettingView view(SettingDefinition setting, Map<String, String> saved) {
        String fromFile = saved.get(setting.name());
        String fromEnvironment = environment.apply(setting.name());
        Source source = fromFile != null ? Source.ADMIN : fromEnvironment != null ? Source.ENVIRONMENT : Source.DEFAULT;
        String value = fromFile != null ? fromFile : fromEnvironment;
        boolean set = value != null && !value.isEmpty();
        return new SettingView(setting.name(), setting.group(), setting.title(), setting.hint(), setting.kind(),
                setting.choices(), setting.secret(), setting.access(), source, setting.secret() ? null : value, set);
    }
}
