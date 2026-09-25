package ru.teacherbox.shared.error;

/**
 * Base type for business errors. Each subtype maps to a fixed HTTP status in the platform layer.
 *
 * <p>{@code code} is a stable machine-readable identifier (e.g. {@code student.not-found}) that the
 * frontend may use to pick a localized message.
 */
public abstract sealed class DomainException extends RuntimeException
        permits NotFoundException, ConflictException, ForbiddenException, BusinessRuleException,
        UnauthorizedException {

    private final String code;

    protected DomainException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
