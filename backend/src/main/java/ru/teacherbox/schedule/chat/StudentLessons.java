package ru.teacherbox.schedule.chat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.schedule.application.ScheduleDirectory;
import ru.teacherbox.schedule.application.ScheduleQueries;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.ParticipantView;
import ru.teacherbox.schedule.domain.Attendance;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatText;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** A student's upcoming lessons as the bot shows them, to the student or to their guardian (ADR-0069). */
@Component
class StudentLessons {

    /** How far ahead the bot looks. */
    static final int DAYS_AHEAD = 30;

    /** The prefix of the button that picks a guardian's child. */
    static final String CHILD = "child:";

    private final ScheduleQueries queries;
    private final ScheduleDirectory directory;
    private final InstanceTimeZone timeZone;
    private final Clock clock;

    StudentLessons(ScheduleQueries queries, ScheduleDirectory directory, InstanceTimeZone timeZone, Clock clock) {
        this.queries = queries;
        this.directory = directory;
        this.timeZone = timeZone;
        this.clock = clock;
    }

    /** The guardian's current children in the order they were linked. */
    List<StudentSummary> children(UUID guardianId) {
        return directory.childrenOf(guardianId);
    }

    /**
     * Whose lessons a dialog is about.
     *
     * @param name the child's name when a guardian acts on their behalf; {@code null}: the student themselves
     */
    record Subject(UUID studentId, @Nullable String name) {
    }

    /**
     * The student themselves, or the child a guardian chose (kept under {@code child} in the state) while that
     * child is still theirs; empty: no child chosen yet, or no longer theirs.
     */
    Optional<Subject> subject(ChatUser user, ChatState state) {
        if (!user.isGuardian()) {
            return Optional.of(new Subject(user.id(), null));
        }
        return state.id("child").flatMap(childId -> children(user.id()).stream()
                .filter(child -> child.id().equals(childId))
                .findFirst())
                .map(child -> new Subject(child.id(), child.displayName()));
    }

    Instant now() {
        return clock.instant();
    }

    LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), zone());
    }

    ZoneId zone() {
        return timeZone.zoneId();
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
    String describe(LessonView lesson, Language language) {
        StringBuilder text = new StringBuilder(ChatText.range(lesson.startsAt(), lesson.endsAt(), zone(), language));
        if (lesson.groupName() != null) {
            text.append(ScheduleChatTexts.of(language).inGroup(lesson.groupName()));
        }
        if (lesson.title() != null) {
            text.append(" — ").append(lesson.title());
        }
        return text.toString();
    }

    /** «пн 29.09 18:30 · ОГЭ», for a button. */
    String label(LessonView lesson, Language language) {
        String when = ChatText.shortDayTime(lesson.startsAt(), zone(), language);
        return lesson.groupName() == null ? when : when + " · " + lesson.groupName();
    }

    static boolean expected(LessonView lesson, UUID studentId) {
        return lesson.participants().stream()
                .filter(participant -> participant.studentId().equals(studentId))
                .map(ParticipantView::attendance)
                .anyMatch(attendance -> attendance == Attendance.EXPECTED);
    }
}
