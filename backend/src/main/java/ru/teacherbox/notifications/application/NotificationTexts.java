package ru.teacherbox.notifications.application;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.shared.money.MoneyFormat;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Formatting of amounts and dates in notification texts, in the recipient's language (ADR-0036). */
@Component
public class NotificationTexts {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private final InstanceTimeZone timeZone;

    public NotificationTexts(InstanceTimeZone timeZone) {
        this.timeZone = timeZone;
    }

    /** "1 500 ₽", "99,50 ₽", "−200 ₽"; "₽1,500" in English. */
    public String money(Money money, Language language) {
        return MoneyFormat.format(money, language);
    }

    /** "Баланс: 1 500 ₽" or "Задолженность: 1 500 ₽"; "Balance: ₽1,500" or "Amount due: ₽1,500". */
    public String balance(Money balance, Language language) {
        boolean debt = balance.isNegative();
        String amount = money(debt ? balance.negate() : balance, language);
        return switch (language) {
            case RU -> (debt ? "Задолженность: " : "Баланс: ") + amount;
            case EN -> (debt ? "Amount due: " : "Balance: ") + amount;
        };
    }

    public String date(LocalDate date) {
        return DATE.format(date);
    }

    /** Date and time in the instance time zone. */
    public String dateTime(Instant instant) {
        return DATE_TIME.format(instant.atZone(timeZone.zoneId()));
    }
}
