package ru.teacherbox.shared.settings;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.bind.BindException;
import org.springframework.boot.context.properties.bind.BindResult;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

/**
 * The old values of the teacher's settings that are still set in {@code .env} or in the administrator's
 * settings file (ADR-0056), read as Spring Boot reads the properties: {@code 24h}, {@code 24h,1h}, {@code RUB}.
 * A value that cannot be read is left out with a warning naming only the variable.
 */
public final class OldSettings {

    private static final Logger log = LoggerFactory.getLogger(OldSettings.class);
    private static final String KEY = "value";

    private final Map<String, String> values;

    /** @param values variable name → value, an empty one included */
    public OldSettings(Map<String, String> values) {
        Map<String, String> set = new TreeMap<>();
        values.forEach((name, value) -> set.put(name, value.strip()));
        this.values = Map.copyOf(set);
    }

    /** The value as it is written; empty for a blank one, which usually means the default. */
    public Optional<String> text(String name) {
        return Optional.ofNullable(values.get(name)).filter(value -> !value.isEmpty());
    }

    /** The variable is set to an empty value, e.g. {@code TEACHERBOX_SCHEDULE_REMINDERS=}: «none». */
    public boolean blank(String name) {
        return "".equals(values.get(name));
    }

    /** The value converted, e.g. to a {@link java.time.Duration} or a {@link java.util.Currency}. */
    public <T> Optional<T> value(String name, Class<T> type) {
        return bind(name, Bindable.of(type));
    }

    /** A comma-separated value converted element by element. */
    public <T> Optional<List<T>> list(String name, Class<T> element) {
        return bind(name, Bindable.listOf(element));
    }

    private <T> Optional<T> bind(String name, Bindable<T> type) {
        String value = text(name).orElse(null);
        if (value == null) {
            return Optional.empty();
        }
        try {
            BindResult<T> result = new Binder(new MapConfigurationPropertySource(Map.of(KEY, value))).bind(KEY, type);
            return result.isBound() ? Optional.of(result.get()) : Optional.empty();
        } catch (BindException e) {
            log.warn("The old value of {} cannot be read and is not imported", name);
            return Optional.empty();
        }
    }
}
