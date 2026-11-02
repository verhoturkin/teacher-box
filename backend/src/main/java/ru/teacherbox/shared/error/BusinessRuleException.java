package ru.teacherbox.shared.error;

import java.util.Map;

/** Request is well-formed but violates a business rule (e.g. invalid state transition). */
public final class BusinessRuleException extends DomainException {

    public BusinessRuleException(String code, String message) {
        super(code, message);
    }

    /** @param properties extra fields of the problem */
    public BusinessRuleException(String code, String message, Map<String, Object> properties) {
        super(code, message, properties);
    }
}
