package ru.teacherbox.shared.error;

/** Request is well-formed but violates a business rule (e.g. invalid state transition). */
public final class BusinessRuleException extends DomainException {

    public BusinessRuleException(String code, String message) {
        super(code, message);
    }
}
