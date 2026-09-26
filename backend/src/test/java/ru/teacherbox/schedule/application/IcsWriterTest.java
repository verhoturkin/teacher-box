package ru.teacherbox.schedule.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.domain.Lesson;

class IcsWriterTest {

    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");
    private static final String FOLD = "\r\n ";

    @Test
    void writesOneEventPerLesson() {
        Lesson lesson = Lesson.plan(UUID.randomUUID(), UUID.randomUUID(), null, null,
                Instant.parse("2026-10-02T15:00:00Z"), 90, "Дроби; задачи, часть 2", "https://zoom.us/j/1", NOW);
        Lesson cancelled = Lesson.plan(UUID.randomUUID(), UUID.randomUUID(), null, null,
                Instant.parse("2026-10-03T15:00:00Z"), 60, null, null, NOW);
        cancelled.cancel(CancelledBy.TEACHER, "Болезнь", NOW);

        String ics = IcsWriter.calendar("Занятия", List.of(lesson, cancelled), found -> "Урок: Иван", NOW)
                .replace(FOLD, "");

        assertThat(ics).startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n").endsWith("END:VCALENDAR\r\n");
        assertThat(ics).contains("UID:" + lesson.id() + "@teacherbox\r\n")
                .contains("DTSTAMP:20261001T100000Z\r\n")
                .contains("DTSTART:20261002T150000Z\r\n")
                .contains("DTEND:20261002T163000Z\r\n")
                .contains("SUMMARY:Урок: Иван\r\n")
                .contains("DESCRIPTION:Тема: Дроби\\; задачи\\, часть 2\\nСсылка на урок: https://zoom.us/j/1")
                .contains("URL:https://zoom.us/j/1\r\n")
                .contains("SUMMARY:Отменено: Урок: Иван\r\n")
                .contains("DESCRIPTION:Причина отмены: Болезнь\r\n")
                .contains("STATUS:CANCELLED\r\n")
                .contains("STATUS:CONFIRMED\r\n")
                .contains("X-WR-CALNAME:Занятия\r\n");
        assertThat(ics.split("BEGIN:VEVENT", -1)).hasSize(3);
    }

    @Test
    void leavesOutAnEmptyDescription() {
        Lesson lesson = Lesson.plan(UUID.randomUUID(), UUID.randomUUID(), null, null, NOW.plus(Duration.ofDays(1)),
                60, null, null, NOW);

        assertThat(IcsWriter.calendar("Занятия", List.of(lesson), found -> "Занятие", NOW))
                .doesNotContain("DESCRIPTION").doesNotContain("URL:");
    }

    @Test
    void escapesText() {
        assertThat(IcsWriter.text("a\\b;c,d\r\ne\nf\rg")).isEqualTo("a\\\\b\\;c\\,d\\ne\\nf\\ng");
    }

    @Test
    void foldsLongLinesWithoutSplittingCharacters() {
        StringBuilder ics = new StringBuilder();

        IcsWriter.line(ics, "SUMMARY:" + "Ж".repeat(100));

        String[] lines = ics.toString().split("\r\n");
        assertThat(lines.length).isGreaterThan(2);
        for (String line : lines) {
            assertThat(line.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(75);
        }
        assertThat(ics.toString().replace(FOLD, "")).isEqualTo("SUMMARY:" + "Ж".repeat(100) + "\r\n");
    }
}
