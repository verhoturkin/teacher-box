package ru.teacherbox.shared.error;

/** Requested resource does not exist (or is not visible to the current user). */
public final class NotFoundException extends DomainException {

    public NotFoundException(String code, String message) {
        super(code, message);
    }
}
