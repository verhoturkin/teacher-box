package ru.teacherbox.schedule.chat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.application.ScheduleQueries;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.ParticipantView;
import ru.teacherbox.schedule.domain.Attendance;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.shared.chat.ChatText;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** A student's upcoming lessons as the bot shows them. */
@Component
class StudentLessons {

    /** How far ahead the bot looks. */
    static final int DAYS_AHEAD = 30;

    private final ScheduleQueries queries;
    private final ZoneId zone;
    private final Clock clock;

    StudentLessons(ScheduleQueries queries, InstanceTimeZone timeZone, Clock clock) {
        this.queries = queries;
        this.zone = timeZone.zoneId();
        this.clock = clock;
    }

    Instant now() {
        return clock.instant();
    }

    LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), zone);
    }

    ZoneId zone() {
        return zone;
    }

    /** Planned lessons that have not ended yet, soonest first. */
    List<LessonView> upcoming(UUID studentId) {
        Instant now = clock.instant();
        LocalDate today = today();
        return queries.studentLessons(studentId, today, today.plusDays(DAYS_AHEAD)).stream()
                .filter(lesson -> lesson.status() == LessonStatus.SCHEDULED && lesson.endsAt().isAfter(now))
                .toList();
    }

    /** Lessons the student may still ask about: not started, the student comes, no unanswered request. */
    List<LessonView> changeable(UUID studentId) {
        Instant now = clock.instant();
        return upcoming(studentId).stream()
                .filter(lesson -> lesson.startsAt().isAfter(now))
                .filter(lesson -> expected(lesson, studentId))
                .filter(lesson -> lesson.pendingRequests().isEmpty())
                .toList();
    }

    Duration lateCancellation() {
        return Duration.ofMinutes(queries.settings().lateCancellationMinutes());
    }

    /** «пн 29.09, 18:30–19:30 — группа «ОГЭ» — Дроби». */
    String describe(LessonView lesson) {
        StringBuilder text = new StringBuilder(ChatText.range(lesson.startsAt(), lesson.endsAt(), zone));
        if (lesson.groupName() != null) {
            text.append(" — группа «").append(lesson.groupName()).append('»');
        }
        if (lesson.topic() != null) {
            text.append(" — ").append(lesson.topic());
        }
        return text.toString();
    }

    /** «пн 29.09 18:30 · ОГЭ», for a button. */
    String label(LessonView lesson) {
        String when = ChatText.shortDayTime(lesson.startsAt(), zone);
        return lesson.groupName() == null ? when : when + " · " + lesson.groupName();
    }

    static boolean expected(LessonView lesson, UUID studentId) {
        return lesson.participants().stream()
                .filter(participant -> participant.studentId().equals(studentId))
                .map(ParticipantView::attendance)
                .anyMatch(attendance -> attendance == Attendance.EXPECTED);
    }
}
