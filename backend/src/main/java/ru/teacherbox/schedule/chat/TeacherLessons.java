package ru.teacherbox.schedule.chat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.application.ScheduleQueries;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.shared.chat.ChatText;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** The teacher's lessons and requests as the bot shows them. */
@Component
class TeacherLessons {

    private final ScheduleQueries queries;
    private final ZoneId zone;
    private final Clock clock;

    TeacherLessons(ScheduleQueries queries, InstanceTimeZone timeZone, Clock clock) {
        this.queries = queries;
        this.zone = timeZone.zoneId();
        this.clock = clock;
    }

    ZoneId zone() {
        return zone;
    }

    Instant now() {
        return clock.instant();
    }

    List<LessonView> today() {
        LocalDate today = LocalDate.ofInstant(clock.instant(), zone);
        return queries.lessons(today, today.plusDays(1));
    }

    List<LessonView> unmarked() {
        return queries.unmarked();
    }

    Optional<LessonView> lesson(UUID lessonId) {
        return Optional.of(queries.lesson(lessonId));
    }

    List<RequestView> pendingRequests() {
        return queries.pendingRequests();
    }

    Optional<RequestView> pendingRequest(UUID requestId) {
        return queries.pendingRequests().stream().filter(request -> request.id().equals(requestId)).findFirst();
    }

    /** A started lesson without an outcome. */
    boolean markable(LessonView lesson) {
        return lesson.status() == LessonStatus.SCHEDULED && !lesson.startsAt().isAfter(clock.instant());
    }

    /** «Мария» or «группа «ОГЭ»». */
    static String who(LessonView lesson) {
        return lesson.groupName() != null ? "группа «" + lesson.groupName() + "»"
                : lesson.studentName() != null ? lesson.studentName() : "ученик";
    }

    /** «пн 29.09, 18:30–19:30, Мария — Дроби». */
    String describe(LessonView lesson) {
        String text = ChatText.range(lesson.startsAt(), lesson.endsAt(), zone) + ", " + who(lesson);
        return lesson.topic() == null ? text : text + " — " + lesson.topic();
    }

    /** «18:30 Мария», for a button. */
    String label(LessonView lesson) {
        return ChatText.shortDayTime(lesson.startsAt(), zone) + " " + (lesson.groupName() != null
                ? lesson.groupName() : lesson.studentName() != null ? lesson.studentName() : "");
    }

    static String status(LessonStatus status) {
        return switch (status) {
            case SCHEDULED -> "запланировано";
            case CONDUCTED -> "проведено";
            case MISSED -> "пропуск";
            case CANCELLED -> "отменено";
        };
    }
}
