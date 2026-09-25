package ru.teacherbox.notifications.application;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Formatting of amounts and dates in Russian notification texts. */
@Component
public class NotificationTexts {

    private static final Locale RUSSIAN = Locale.of("ru", "RU");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private final InstanceTimeZone timeZone;

    public NotificationTexts(InstanceTimeZone timeZone) {
        this.timeZone = timeZone;
    }

    /** "1 500 ₽", "99,50 ₽", "−200 ₽" (plain spaces, fraction only when not zero). */
    public String money(Money money) {
        BigDecimal amount = money.toDecimal().abs();
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(RUSSIAN);
        symbols.setGroupingSeparator(' ');
        DecimalFormat format = new DecimalFormat("#,##0", symbols);
        int fractionDigits = amount.stripTrailingZeros().scale() > 0 ? money.currency().getDefaultFractionDigits() : 0;
        format.setMinimumFractionDigits(fractionDigits);
        format.setMaximumFractionDigits(fractionDigits);
        String sign = money.isNegative() ? "−" : "";
        return sign + format.format(amount) + " " + money.currency().getSymbol(RUSSIAN);
    }

    /** "Баланс: 1 500 ₽" or "Задолженность: 1 500 ₽". */
    public String balance(Money balance) {
        return balance.isNegative()
                ? "Задолженность: " + money(balance.negate())
                : "Баланс: " + money(balance);
    }

    public String date(LocalDate date) {
        return DATE.format(date);
    }

    /** Date and time in the instance time zone. */
    public String dateTime(Instant instant) {
        return DATE_TIME.format(instant.atZone(timeZone.zoneId()));
    }
}
