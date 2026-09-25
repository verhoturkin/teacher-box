package ru.teacherbox.shared.error;

/** Operation conflicts with the current state (duplicates, concurrent modification). */
public final class ConflictException extends DomainException {

    public ConflictException(String code, String message) {
        super(code, message);
    }
}
