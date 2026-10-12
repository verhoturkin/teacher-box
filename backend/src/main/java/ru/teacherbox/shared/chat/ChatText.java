package ru.teacherbox.shared.chat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import ru.teacherbox.shared.i18n.Language;

/** Dates and times in the messages of the bot, in the instance time zone. */
public final class ChatText {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private ChatText() {
    }

    /** «пн 29.09, 18:30», «Mon 29.09, 18:30». */
    public static String dayTime(Instant instant, ZoneId zone, Language language) {
        return ChatWords.of(language).dayTime().format(instant.atZone(zone));
    }

    /** «пн 29.09 18:30», for buttons. */
    public static String shortDayTime(Instant instant, ZoneId zone, Language language) {
        return ChatWords.of(language).shortDayTime().format(instant.atZone(zone));
    }

    /** «пн 29.09, 18:30–19:30». */
    public static String range(Instant start, Instant end, ZoneId zone, Language language) {
        return dayTime(start, zone, language) + "–" + TIME.format(end.atZone(zone));
    }

    /** «29.09.2026». */
    public static String date(LocalDate date) {
        return DATE.format(date);
    }
}
