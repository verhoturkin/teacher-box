package ru.teacherbox.notifications.application;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.i18n.Plural;
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.shared.money.MoneyFormat;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Formatting of amounts, dates and durations in notification texts, in the recipient's language (ADR-0036). */
@Component
public class NotificationTexts {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DateTimeFormatter DAY_MONTH = DateTimeFormatter.ofPattern("dd.MM");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");
    private static final DateTimeFormatter LESSON_TIME_RU = DateTimeFormatter.ofPattern("EEEE, dd.MM 'в' HH:mm",
            Language.RU.locale());
    private static final DateTimeFormatter LESSON_TIME_EN = DateTimeFormatter.ofPattern("EEEE, dd.MM 'at' HH:mm",
            Language.EN.locale());
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private static final Map<DayOfWeek, String> ON_WEEKDAYS = Map.of(
            DayOfWeek.MONDAY, "понедельникам", DayOfWeek.TUESDAY, "вторникам", DayOfWeek.WEDNESDAY, "средам",
            DayOfWeek.THURSDAY, "четвергам", DayOfWeek.FRIDAY, "пятницам", DayOfWeek.SATURDAY, "субботам",
            DayOfWeek.SUNDAY, "воскресеньям");

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

    /** "01.10": day and month of a lesson in the instance time zone. */
    public String dayMonth(Instant instant) {
        return DAY_MONTH.format(instant.atZone(timeZone.zoneId()));
    }

    /** "вторник, 01.10 в 18:00", "Tuesday, 01.10 at 18:00" in the instance time zone. */
    public String lessonTime(Instant instant, Language language) {
        DateTimeFormatter format = switch (language) {
            case RU -> LESSON_TIME_RU;
            case EN -> LESSON_TIME_EN;
        };
        return format.format(instant.atZone(timeZone.zoneId()));
    }

    /** "по вторникам и четвергам в 18:00", "on Tuesdays and Thursdays at 18:00". */
    public String weekly(List<DayOfWeek> weekdays, LocalTime time, Language language) {
        List<DayOfWeek> sorted = weekdays.stream().sorted().toList();
        return switch (language) {
            case RU -> "по " + list(sorted.stream().map(ON_WEEKDAYS::get).toList(), " и ") + " в " + TIME.format(time);
            case EN -> "on " + list(sorted.stream()
                    .map(day -> day.getDisplayName(TextStyle.FULL, Locale.UK) + "s")
                    .toList(), " and ") + " at " + TIME.format(time);
        };
    }

    /** "1 час", "24 часа", "30 минут", "2 дня" (days from two days on); "1 hour", "2 days". */
    public String duration(Duration duration, Language language) {
        long minutes = duration.toMinutes();
        if (minutes >= 2 * 24 * 60 && minutes % (24 * 60) == 0) {
            long days = minutes / (24 * 60);
            return days + " " + switch (language) {
                case RU -> Plural.russian(days, "день", "дня", "дней");
                case EN -> Plural.english(days, "day", "days");
            };
        }
        if (minutes > 0 && minutes % 60 == 0) {
            long hours = minutes / 60;
            return hours + " " + switch (language) {
                case RU -> Plural.russian(hours, "час", "часа", "часов");
                case EN -> Plural.english(hours, "hour", "hours");
            };
        }
        return minutes + " " + switch (language) {
            case RU -> Plural.russian(minutes, "минуту", "минуты", "минут");
            case EN -> Plural.english(minutes, "minute", "minutes");
        };
    }

    private static String list(List<String> items, String and) {
        return items.size() == 1 ? items.getFirst()
                : String.join(", ", items.subList(0, items.size() - 1)) + and + items.getLast();
    }
}
