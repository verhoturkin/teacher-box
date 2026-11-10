package ru.teacherbox.shared.settings;

import java.util.Objects;
import java.util.function.Supplier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.core.env.Environment;

/**
 * A module's {@link ConfigurationProperties} record bound anew on every {@link #get()} (ADR-0056): a setting
 * the administrator changes in the interface is in force at once, while a bean of the record keeps the
 * values of the start. Read it on every use; never keep the result in a field.
 *
 * @param <T> the record, annotated with {@link ConfigurationProperties}
 */
public final class LiveProperties<T> implements Supplier<T> {

    private final Environment environment;
    private final String prefix;
    private final Class<T> type;

    public LiveProperties(Environment environment, Class<T> type) {
        ConfigurationProperties annotation = Objects.requireNonNull(type.getAnnotation(ConfigurationProperties.class),
                () -> type.getName() + " is not @ConfigurationProperties");
        this.environment = environment;
        this.prefix = annotation.prefix().isEmpty() ? annotation.value() : annotation.prefix();
        this.type = type;
    }

    @Override
    public T get() {
        return Binder.get(environment).bindOrCreate(prefix, type);
    }
}
