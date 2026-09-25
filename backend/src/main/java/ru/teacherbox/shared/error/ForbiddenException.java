package ru.teacherbox.shared.error;

/** The current user is authenticated but not allowed to perform the operation. */
public final class ForbiddenException extends DomainException {

    public ForbiddenException(String code, String message) {
        super(code, message);
    }
}
