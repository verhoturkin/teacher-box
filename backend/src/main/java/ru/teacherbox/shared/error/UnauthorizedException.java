package ru.teacherbox.shared.error;

/** Authentication failed: wrong credentials, locked account, invalid or expired token. */
public final class UnauthorizedException extends DomainException {

    public UnauthorizedException(String code, String message) {
        super(code, message);
    }
}
