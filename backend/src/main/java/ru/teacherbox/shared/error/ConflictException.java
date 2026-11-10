package ru.teacherbox.shared.error;

import java.util.Map;

/** Operation conflicts with the current state (duplicates, concurrent modification). */
public final class ConflictException extends DomainException {

    public ConflictException(String code, String message) {
        super(code, message);
    }

    /** @param properties extra fields of the problem */
    public ConflictException(String code, String message, Map<String, Object> properties) {
        super(code, message, properties);
    }
}
