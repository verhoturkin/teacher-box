package ru.teacherbox.platform.settings;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.ObjectProvider;
import ru.teacherbox.platform.backup.Restarter;
import ru.teacherbox.platform.settings.SettingDefinition.Access;
import ru.teacherbox.platform.settings.SettingDefinition.Owner;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.security.PasswordConfirmation;
import ru.teacherbox.shared.settings.SettingsChanged;

/**
 * The administrator sees the settings of the portal and changes their own (ADR-0016, ADR-0056): the values
 * go to {@link SettingsFile} and are more important than {@code .env}. A {@link SettingDefinition#live()}
 * value is in force at once and announced by {@link SettingsChanged}; the rest apply after a restart. The
 * teacher's settings are not here: the administrator only sees which of their variables are still set.
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
     * @param value    the value; always {@code null} for a secret and for a setting that is not set
     * @param set      the setting has a non-empty value (the only thing shown about a secret)
     * @param schedule a {@link SettingKind#CRON} in force as «вкл/выкл + время»; {@code null} for other kinds
     *                 and for a cron that is not a daily one at a fixed time (the interface shows the cron)
     */
    public record SettingView(String name, String section, String group, String title, String hint, SettingKind kind,
            List<String> choices, boolean secret, Access access, Owner owner, boolean live, Source source,
            @Nullable String value, boolean set, @Nullable DailySchedule schedule) {
    }

    /**
     * A teacher's setting whose variable is still set (ADR-0056): «Перенесено в настройки учителя». No
     * value: it is the teacher's data.
     *
     * @param source {@link Source#ENVIRONMENT} or {@link Source#ADMIN} (saved here before ADR-0056)
     */
    public record MovedView(String name, String group, String title, Source source) {
    }

    /**
     * @param moved          the teacher's settings whose variables are still set
     * @param restartEnabled the portal restarts by itself after a change
     * @param restartNeeded  saved values wait for a restart
     * @param startedAt      when the running portal started: a new value means it has restarted
     */
    public record SettingsView(List<SettingView> settings, List<MovedView> moved, boolean restartEnabled,
            boolean restartNeeded, Instant startedAt) {
    }

    /**
     * @param changed    names of the changed settings
     * @param applied    those of them already in force (live)
     * @param restarting the portal restarts for the others
     */
    public record Changed(List<String> changed, List<String> applied, boolean restarting) {
    }

    private final SettingsFile file;
    /** The saved values in force: those of the start and the live ones changed since. */
    private final Map<String, String> applied;
    private final UnaryOperator<@Nullable String> environment;
    private final Consumer<Map<String, String>> inForce;
    private final Consumer<SettingsChanged> events;
    private final ObjectProvider<PasswordConfirmation> passwords;
    private final Restarter restarter;
    private final boolean restartEnabled;
    private final Instant startedAt;

    /**
     * @param environment the value of an environment variable by its name ({@code System::getenv})
     * @param inForce     puts the saved values in force in the running portal
     * @param events      publishes {@link SettingsChanged}
     */
    public AdminSettingsService(SettingsFile file, UnaryOperator<@Nullable String> environment,
            Consumer<Map<String, String>> inForce, Consumer<SettingsChanged> events,
            ObjectProvider<PasswordConfirmation> passwords, Restarter restarter, boolean restartEnabled,
            Instant startedAt) {
        this.file = file;
        this.applied = new TreeMap<>(file.read());
        this.environment = environment;
        this.inForce = inForce;
        this.events = events;
        this.passwords = passwords;
        this.restarter = restarter;
        this.restartEnabled = restartEnabled;
        this.startedAt = startedAt;
    }

    public synchronized SettingsView view() {
        Map<String, String> saved = file.read();
        List<SettingView> settings = SettingsCatalog.all().stream()
                .filter(setting -> setting.owner() != Owner.TEACHER)
                .map(setting -> view(setting, saved))
                .toList();
        Language language = Language.current();
        List<MovedView> moved = SettingsCatalog.all().stream()
                .filter(setting -> setting.owner() == Owner.TEACHER)
                .filter(setting -> saved.containsKey(setting.name()) || environment.apply(setting.name()) != null)
                .map(setting -> new MovedView(setting.name(), setting.group().in(language),
                        setting.title().in(language),
                        saved.containsKey(setting.name()) ? Source.ADMIN : Source.ENVIRONMENT))
                .toList();
        return new SettingsView(settings, moved, restartEnabled, !saved.equals(applied), startedAt);
    }

    /**
     * Saves the values: the live ones are in force at once, the portal restarts for the others.
     *
     * @param values {@code null} value: back to {@code .env} (also for a read-only setting saved here before);
     *               an empty one: not set, whatever {@code .env} says
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
            if (setting.owner() == Owner.TEACHER) {
                throw new BusinessRuleException("settings.teacher", name + " is the teacher's setting");
            }
            String value = entry.getValue();
            // a read-only one saved here before ADR-0056 may only be removed: then .env applies
            if (!setting.editable() && !(value == null && setting.stored())) {
                throw new BusinessRuleException("settings.read-only", name + " is changed only in .env");
            }
            if (value == null) {
                next.remove(name);
                continue;
            }
            String clean = value.strip();
            Language language = Language.current();
            String problem = setting.kind().problem(clean, setting.choices(), language);
            if (problem != null) {
                throw new BusinessRuleException("settings.invalid",
                        setting.title().in(language) + " (" + name + "): " + problem);
            }
            next.put(name, clean);
        }
        List<String> changed = new ArrayList<>();
        List<String> live = new ArrayList<>();
        for (SettingDefinition setting : SettingsCatalog.all()) {
            if (!Objects.equals(saved.get(setting.name()), next.get(setting.name()))) {
                changed.add(setting.name());
                if (setting.live()) {
                    live.add(setting.name());
                }
            }
        }
        if (changed.isEmpty()) {
            return new Changed(List.of(), List.of(), false);
        }
        file.write(next);
        AuditLog.record(adminId, "settings-change", String.join(", ", changed));
        if (!live.isEmpty()) {
            for (String name : live) {
                String value = next.get(name);
                if (value == null) {
                    applied.remove(name);
                } else {
                    applied.put(name, value);
                }
            }
            inForce.accept(Map.copyOf(applied));
            events.accept(new SettingsChanged(Set.copyOf(live)));
        }
        boolean restarting = restartEnabled && live.size() < changed.size();
        if (restarting) {
            restarter.restartSoon();
        }
        return new Changed(List.copyOf(changed), List.copyOf(live), restarting);
    }

    private SettingView view(SettingDefinition setting, Map<String, String> saved) {
        String fromFile = saved.get(setting.name());
        String fromEnvironment = environment.apply(setting.name());
        Source source = fromFile != null ? Source.ADMIN : fromEnvironment != null ? Source.ENVIRONMENT : Source.DEFAULT;
        String value = fromFile != null ? fromFile : fromEnvironment;
        boolean set = value != null && !value.isEmpty();
        Language language = Language.current();
        return new SettingView(setting.name(), setting.section(), setting.group().in(language),
                setting.title().in(language), setting.hint().in(language), setting.kind(),
                setting.choices(), setting.secret(), setting.access(), setting.owner(), setting.live(), source,
                setting.secret() ? null : value, set, schedule(setting, set ? value : null));
    }

    private static @Nullable DailySchedule schedule(SettingDefinition setting, @Nullable String value) {
        if (setting.kind() != SettingKind.CRON) {
            return null;
        }
        String cron = value != null ? value : SettingsCatalog.defaultCron(setting.name()).orElse(null);
        return cron == null ? null : DailySchedule.of(cron).orElse(null);
    }
}
