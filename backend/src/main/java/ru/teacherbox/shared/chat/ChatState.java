package ru.teacherbox.shared.chat;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * What an action remembers between the steps of a dialog: a few short strings (ids, the step). It is
 * kept on the server, also with the buttons of every message, so an old button continues the dialog
 * from the moment it was shown.
 */
public record ChatState(Map<String, String> values) {

    public static final ChatState EMPTY = new ChatState(Map.of());
    /** The conventional key of the current step. */
    public static final String STEP = "step";

    public ChatState {
        values = Map.copyOf(values);
    }

    public static ChatState of(String key, String value) {
        return EMPTY.with(key, value);
    }

    public Optional<String> get(String key) {
        return Optional.ofNullable(values.get(key));
    }

    public Optional<UUID> id(String key) {
        try {
            return get(key).map(UUID::fromString);
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public @Nullable String step() {
        return values.get(STEP);
    }

    public boolean at(String step) {
        return step.equals(values.get(STEP));
    }

    public ChatState with(String key, String value) {
        Map<String, String> changed = new LinkedHashMap<>(values);
        changed.put(Objects.requireNonNull(key, "key"), Objects.requireNonNull(value, "value"));
        return new ChatState(changed);
    }

    public ChatState withStep(String step) {
        return with(STEP, step);
    }

    public ChatState without(String key) {
        Map<String, String> changed = new LinkedHashMap<>(values);
        changed.remove(key);
        return new ChatState(changed);
    }
}
