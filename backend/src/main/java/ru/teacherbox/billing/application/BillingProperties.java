package ru.teacherbox.billing.application;

import java.util.Currency;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the billing module ({@code TEACHERBOX_BILLING_*}).
 *
 * @param currency               currency of all amounts (ISO 4217 code)
 * @param defaultLessonDuration  default lesson duration in minutes
 */
@ConfigurationProperties("teacherbox.billing")
public record BillingProperties(
        @DefaultValue("RUB") Currency currency,
        @DefaultValue("60") int defaultLessonDuration) {
}
