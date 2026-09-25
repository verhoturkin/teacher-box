package ru.teacherbox.billing.application;

import java.math.BigDecimal;
import java.util.Currency;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the billing module ({@code TEACHERBOX_BILLING_*}).
 *
 * @param currency               currency of all amounts (ISO 4217 code)
 * @param defaultLessonPrice     lesson price of a new student, in currency units (e.g. {@code 1500})
 * @param defaultLessonDuration  default lesson duration in minutes
 */
@ConfigurationProperties("teacherbox.billing")
public record BillingProperties(
        @DefaultValue("RUB") Currency currency,
        @DefaultValue("0") BigDecimal defaultLessonPrice,
        @DefaultValue("60") int defaultLessonDuration) {
}
