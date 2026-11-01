package ru.teacherbox.shared.error;

import java.util.Map;

/**
 * Base type for business errors. Each subtype maps to a fixed HTTP status in the platform layer.
 *
 * <p>{@code code} is a stable machine-readable identifier (e.g. {@code student.not-found}) that the
 * frontend may use to pick a localized message; {@code properties} are extra fields of the problem (e.g. which items
 * are wrong).
 */
public abstract sealed class DomainException extends RuntimeException
        permits NotFoundException, ConflictException, ForbiddenException, BusinessRuleException,
        UnauthorizedException {

    private final String code;
    private final Map<String, Object> properties;

    protected DomainException(String code, String message) {
        this(code, message, Map.of());
    }

    protected DomainException(String code, String message, Map<String, Object> properties) {
        super(message);
        this.code = code;
        this.properties = Map.copyOf(properties);
    }

    public String code() {
        return code;
    }

    public Map<String, Object> properties() {
        return properties;
    }
}
