package ru.teacherbox.notifications.application;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Formatting of amounts and dates in Russian notification texts. */
@Component
public class NotificationTexts {

    private static final Locale RUSSIAN = Locale.of("ru", "RU");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");
    private static final DateTimeFormatter LESSON_TIME = DateTimeFormatter.ofPattern("EEEE, dd.MM 'в' HH:mm", RUSSIAN);
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private static final Map<DayOfWeek, String> ON_WEEKDAYS = Map.of(
            DayOfWeek.MONDAY, "понедельникам", DayOfWeek.TUESDAY, "вторникам", DayOfWeek.WEDNESDAY, "средам",
            DayOfWeek.THURSDAY, "четвергам", DayOfWeek.FRIDAY, "пятницам", DayOfWeek.SATURDAY, "субботам",
            DayOfWeek.SUNDAY, "воскресеньям");

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

    /** "вторник, 01.10 в 18:00" in the instance time zone. */
    public String lessonTime(Instant instant) {
        return LESSON_TIME.format(instant.atZone(timeZone.zoneId()));
    }

    /** "по вторникам и четвергам в 18:00". */
    public String weekly(List<DayOfWeek> weekdays, LocalTime time) {
        List<String> days = weekdays.stream().sorted().map(ON_WEEKDAYS::get).toList();
        String joined = days.size() == 1 ? days.getFirst()
                : String.join(", ", days.subList(0, days.size() - 1)) + " и " + days.getLast();
        return "по " + joined + " в " + TIME.format(time);
    }

    /** "1 час", "24 часа", "30 минут", "2 дня" (days from two days on). */
    public String duration(Duration duration) {
        long minutes = duration.toMinutes();
        if (minutes >= 2 * 24 * 60 && minutes % (24 * 60) == 0) {
            return plural(minutes / (24 * 60), "день", "дня", "дней");
        }
        if (minutes > 0 && minutes % 60 == 0) {
            return plural(minutes / 60, "час", "часа", "часов");
        }
        return plural(minutes, "минуту", "минуты", "минут");
    }

    static String plural(long count, String one, String few, String many) {
        long lastTwo = count % 100;
        long last = count % 10;
        String word;
        if (lastTwo >= 11 && lastTwo <= 14) {
            word = many;
        } else if (last == 1) {
            word = one;
        } else if (last >= 2 && last <= 4) {
            word = few;
        } else {
            word = many;
        }
        return count + " " + word;
    }
}
