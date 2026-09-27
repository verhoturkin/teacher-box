package ru.teacherbox.shared.chat;

import java.util.Objects;
import java.util.UUID;

/**
 * What a notification is about, so that an action can put its buttons under it (e.g. «Принять» under
 * a request to move a lesson).
 *
 * @param type a name agreed between the module that notifies and the one that acts, e.g.
 *             {@code change-request}
 */
public record ChatSubject(String type, UUID id) {

    public ChatSubject {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(id, "id");
    }
}
