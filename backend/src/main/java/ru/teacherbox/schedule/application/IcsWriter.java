package ru.teacherbox.schedule.application;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;

/**
 * Lessons as an iCalendar feed (RFC 5545): one event per lesson, times in UTC, cancelled lessons
 * with {@code STATUS:CANCELLED} so that calendars remove them.
 */
final class IcsWriter {

    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
            .withZone(ZoneOffset.UTC);
    private static final int MAX_LINE_OCTETS = 75;

    private IcsWriter() {
    }

    /**
     * @param summary title of a lesson's event, e.g. the student's name for the teacher
     */
    static String calendar(String name, List<Lesson> lessons, Function<Lesson, String> summary, Instant now) {
        StringBuilder ics = new StringBuilder();
        line(ics, "BEGIN:VCALENDAR");
        line(ics, "VERSION:2.0");
        line(ics, "PRODID:-//Teacher Box//Schedule//RU");
        line(ics, "CALSCALE:GREGORIAN");
        line(ics, "METHOD:PUBLISH");
        line(ics, "X-WR-CALNAME:" + text(name));
        line(ics, "REFRESH-INTERVAL;VALUE=DURATION:PT1H");
        line(ics, "X-PUBLISHED-TTL:PT1H");
        for (Lesson lesson : lessons) {
            boolean cancelled = lesson.status() == LessonStatus.CANCELLED;
            line(ics, "BEGIN:VEVENT");
            line(ics, "UID:" + lesson.id() + "@teacherbox");
            line(ics, "DTSTAMP:" + UTC.format(now));
            line(ics, "LAST-MODIFIED:" + UTC.format(lesson.updatedAt()));
            line(ics, "SEQUENCE:" + lesson.version());
            line(ics, "DTSTART:" + UTC.format(lesson.startsAt()));
            line(ics, "DTEND:" + UTC.format(lesson.endsAt()));
            line(ics, "SUMMARY:" + text((cancelled ? "Отменено: " : "") + summary.apply(lesson)));
            String description = description(lesson);
            if (description != null) {
                line(ics, "DESCRIPTION:" + text(description));
            }
            if (lesson.meetingUrl() != null) {
                line(ics, "URL:" + lesson.meetingUrl());
            }
            line(ics, "STATUS:" + (cancelled ? "CANCELLED" : "CONFIRMED"));
            line(ics, "TRANSP:OPAQUE");
            line(ics, "END:VEVENT");
        }
        line(ics, "END:VCALENDAR");
        return ics.toString();
    }

    private static @Nullable String description(Lesson lesson) {
        StringBuilder text = new StringBuilder();
        if (lesson.topic() != null) {
            text.append("Тема: ").append(lesson.topic());
        }
        if (lesson.meetingUrl() != null) {
            text.append(text.isEmpty() ? "" : "\n").append("Ссылка на урок: ").append(lesson.meetingUrl());
        }
        if (lesson.cancelReason() != null) {
            text.append(text.isEmpty() ? "" : "\n").append("Причина отмены: ").append(lesson.cancelReason());
        }
        return text.isEmpty() ? null : text.toString();
    }

    /** Escapes a TEXT value. */
    static String text(String value) {
        return value.replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\r\n", "\\n")
                .replace("\n", "\\n")
                .replace("\r", "\\n");
    }

    /** Appends a content line folded at 75 octets without splitting a UTF-8 character. */
    static void line(StringBuilder ics, String content) {
        int octets = 0;
        int limit = MAX_LINE_OCTETS;
        for (int i = 0; i < content.length(); ) {
            int codePoint = content.codePointAt(i);
            int size = new String(Character.toChars(codePoint)).getBytes(StandardCharsets.UTF_8).length;
            if (octets + size > limit) {
                ics.append("\r\n ");
                octets = 0;
                limit = MAX_LINE_OCTETS - 1;
            }
            ics.appendCodePoint(codePoint);
            octets += size;
            i += Character.charCount(codePoint);
        }
        ics.append("\r\n");
    }
}
