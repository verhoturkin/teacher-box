package ru.teacherbox.notifications.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Buttons of a notification as they are kept in the delivery queue. */
@Component
public class KeyboardCodec {

    private static final TypeReference<List<List<OutgoingButton>>> ROWS = new TypeReference<>() {
    };

    private final JsonMapper json;

    public KeyboardCodec(JsonMapper json) {
        this.json = json;
    }

    public @Nullable String write(List<List<OutgoingButton>> rows) {
        return rows.isEmpty() ? null : json.writeValueAsString(rows);
    }

    /** The rows of buttons; none if the stored value is missing or unreadable. */
    public List<List<OutgoingButton>> read(@Nullable String keyboard) {
        if (keyboard == null) {
            return List.of();
        }
        try {
            return json.readValue(keyboard, ROWS);
        } catch (JacksonException | IllegalArgumentException e) {
            return List.of();
        }
    }
}
