package ru.teacherbox.schedule.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.domain.Attendance;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.domain.Participant;

/** Lessons of the schedule with their participants (the bean name differs from the billing lesson log). */
@Repository("scheduleLessonRepository")
public class LessonRepository {

    private static final String SELECT = """
            select id, group_id, series_id, series_date, starts_at, duration_minutes, topic, meeting_url, status,
                   cancelled_by, cancel_reason, original_starts_at, created_at, updated_at, version
            from schedule.lessons
            """;
    private static final String ORDER = " order by starts_at, id";
    /** Lessons the student takes part in, whatever the attendance. */
    private static final String OF_STUDENT =
            " id in (select lesson_id from schedule.lesson_participants where student_id = :studentId)";

    /** A lesson row before its participants are loaded. */
    private record Row(UUID id, @Nullable UUID groupId, @Nullable UUID seriesId, @Nullable LocalDate seriesDate,
            Instant startsAt, int durationMinutes, @Nullable String topic, @Nullable String meetingUrl,
            LessonStatus status, @Nullable CancelledBy cancelledBy, @Nullable String cancelReason,
            @Nullable Instant originalStartsAt, Instant createdAt, Instant updatedAt, long version) {
    }

    private final JdbcClient jdbc;

    public LessonRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Lesson lesson) {
        jdbc.sql("""
                insert into schedule.lessons (id, group_id, series_id, series_date, starts_at, ends_at,
                    duration_minutes, topic, meeting_url, status, cancelled_by, cancel_reason, original_starts_at,
                    created_at, updated_at, version)
                values (:id, :groupId, :seriesId, :seriesDate, :startsAt, :endsAt, :duration, :topic, :meetingUrl,
                    :status, :cancelledBy, :cancelReason, :originalStartsAt, :createdAt, :updatedAt, :version)
                """)
                .param("id", lesson.id())
                .param("groupId", lesson.groupId())
                .param("seriesId", lesson.seriesId())
                .param("seriesDate", lesson.seriesDate())
                .param("startsAt", lesson.startsAt())
                .param("endsAt", lesson.endsAt())
                .param("duration", lesson.durationMinutes())
                .param("topic", lesson.topic())
                .param("meetingUrl", lesson.meetingUrl())
                .param("status", lesson.status().name())
                .param("cancelledBy", name(lesson.cancelledBy()))
                .param("cancelReason", lesson.cancelReason())
                .param("originalStartsAt", lesson.originalStartsAt())
                .param("createdAt", lesson.createdAt())
                .param("updatedAt", lesson.updatedAt())
                .param("version", lesson.version())
                .update();
        insertParticipants(lesson);
    }

    /** Saves changes of a loaded lesson, including its participants. */
    public void update(Lesson lesson) {
        int updated = jdbc.sql("""
                update schedule.lessons
                set starts_at = :startsAt, ends_at = :endsAt, duration_minutes = :duration, topic = :topic,
                    meeting_url = :meetingUrl, status = :status, cancelled_by = :cancelledBy,
                    cancel_reason = :cancelReason, original_starts_at = :originalStartsAt,
                    updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", lesson.id())
                .param("version", lesson.version())
                .param("startsAt", lesson.startsAt())
                .param("endsAt", lesson.endsAt())
                .param("duration", lesson.durationMinutes())
                .param("topic", lesson.topic())
                .param("meetingUrl", lesson.meetingUrl())
                .param("status", lesson.status().name())
                .param("cancelledBy", name(lesson.cancelledBy()))
                .param("cancelReason", lesson.cancelReason())
                .param("originalStartsAt", lesson.originalStartsAt())
                .param("updatedAt", lesson.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Lesson " + lesson.id() + " was modified");
        }
        jdbc.sql("delete from schedule.lesson_participants where lesson_id = :id").param("id", lesson.id()).update();
        insertParticipants(lesson);
        lesson.markSaved(lesson.version() + 1);
    }

    /** Deletes the lesson with its participants, requests and sent reminders. */
    public void delete(Lesson lesson) {
        int deleted = jdbc.sql("delete from schedule.lessons where id = :id and version = :version")
                .param("id", lesson.id())
                .param("version", lesson.version())
                .update();
        if (deleted != 1) {
            throw new OptimisticLockingFailureException("Lesson " + lesson.id() + " was modified");
        }
    }

    public Optional<Lesson> findById(UUID id) {
        return load(jdbc.sql(SELECT + " where id = :id").param("id", id).query(LessonRepository::map).list())
                .stream().findFirst();
    }

    /** Whether any lesson was ever planned. */
    public boolean exists() {
        return jdbc.sql("select count(*) from schedule.lessons").query(Long.class).single() > 0;
    }

    /** The student's nearest scheduled lesson that has not ended at {@code now} and the student will attend. */
    public Optional<Lesson> findNextScheduled(UUID studentId, Instant now) {
        return load(jdbc.sql(SELECT + """
                 where status = 'SCHEDULED' and ends_at > :now
                   and id in (select lesson_id from schedule.lesson_participants
                              where student_id = :studentId and attendance = 'EXPECTED')
                """ + ORDER + " limit 1")
                .param("studentId", studentId)
                .param("now", now)
                .query(LessonRepository::map)
                .list())
                .stream().findFirst();
    }

    /** Lessons that start in {@code [from, to)}. */
    public List<Lesson> findStartingBetween(Instant from, Instant to) {
        return load(jdbc.sql(SELECT + " where starts_at >= :from and starts_at < :to" + ORDER)
                .param("from", from)
                .param("to", to)
                .query(LessonRepository::map)
                .list());
    }

    /** Lessons of the student (alone or with a group) that start in {@code [from, to)}. */
    public List<Lesson> findStartingBetween(UUID studentId, Instant from, Instant to) {
        return load(jdbc.sql(SELECT + " where starts_at >= :from and starts_at < :to and" + OF_STUDENT + ORDER)
                .param("studentId", studentId)
                .param("from", from)
                .param("to", to)
                .query(LessonRepository::map)
                .list());
    }

    /** Planned lessons of a group that start after {@code after}. */
    public List<Lesson> findScheduledOfGroup(UUID groupId, Instant after) {
        return load(jdbc.sql(SELECT + " where group_id = :groupId and status = 'SCHEDULED' and starts_at > :after"
                        + ORDER)
                .param("groupId", groupId)
                .param("after", after)
                .query(LessonRepository::map)
                .list());
    }

    /** Lessons that are not cancelled and occupy part of {@code [from, to)}. */
    public List<Lesson> findOverlapping(Instant from, Instant to) {
        return load(jdbc.sql(SELECT + " where status <> 'CANCELLED' and starts_at < :to and ends_at > :from" + ORDER)
                .param("from", from)
                .param("to", to)
                .query(LessonRepository::map)
                .list());
    }

    /** Planned lessons that start in {@code (after, until]}. */
    public List<Lesson> findScheduledStarting(Instant after, Instant until) {
        return load(jdbc.sql(SELECT + " where status = 'SCHEDULED' and starts_at > :after and starts_at <= :until"
                        + ORDER)
                .param("after", after)
                .param("until", until)
                .query(LessonRepository::map)
                .list());
    }

    /** Planned lessons that have ended by {@code before} and still have no outcome. */
    public List<Lesson> findUnmarked(Instant before) {
        return load(jdbc.sql(SELECT + " where status = 'SCHEDULED' and ends_at <= :before" + ORDER)
                .param("before", before)
                .query(LessonRepository::map)
                .list());
    }

    /**
     * Removes the planned lessons of a series from {@code from} on, except the ones moved
     * individually (they are arranged separately and stay) and the ones with a charged participant.
     *
     * @return ids of the removed lessons
     */
    public List<UUID> deleteUntouchedOfSeries(UUID seriesId, LocalDate from) {
        List<UUID> ids = jdbc.sql("""
                select id from schedule.lessons
                where series_id = :seriesId and series_date >= :from and status = 'SCHEDULED'
                  and original_starts_at is null
                  and id not in (select lesson_id from schedule.lesson_participants where completion_id is not null)
                """)
                .param("seriesId", seriesId)
                .param("from", from)
                .query(UUID.class)
                .list();
        if (!ids.isEmpty()) {
            jdbc.sql("delete from schedule.lessons where id in (:ids)").param("ids", ids).update();
        }
        return ids;
    }

    public boolean existsForSeriesDate(UUID seriesId, LocalDate date) {
        return jdbc.sql("select count(*) from schedule.lessons where series_id = :seriesId and series_date = :date")
                .param("seriesId", seriesId)
                .param("date", date)
                .query(Long.class)
                .single() > 0;
    }

    /** Remembers the reminders sent for a lesson (one row per advance time in minutes). */
    public void markRemindersSent(UUID lessonId, Collection<Integer> beforeMinutes, Instant now) {
        for (int minutes : beforeMinutes) {
            jdbc.sql("""
                    merge into schedule.reminders_sent (lesson_id, before_minutes, sent_at)
                    key (lesson_id, before_minutes) values (:lessonId, :minutes, :now)
                    """)
                    .param("lessonId", lessonId)
                    .param("minutes", minutes)
                    .param("now", now)
                    .update();
        }
    }

    public List<Integer> remindersSent(UUID lessonId) {
        return jdbc.sql("select before_minutes from schedule.reminders_sent where lesson_id = :lessonId")
                .param("lessonId", lessonId)
                .query(Integer.class)
                .list();
    }

    /** A moved lesson gets its reminders again. */
    public void clearReminders(UUID lessonId) {
        jdbc.sql("delete from schedule.reminders_sent where lesson_id = :lessonId").param("lessonId", lessonId).update();
    }

    private void insertParticipants(Lesson lesson) {
        List<Participant> participants = lesson.participants();
        for (int position = 0; position < participants.size(); position++) {
            Participant participant = participants.get(position);
            jdbc.sql("""
                    insert into schedule.lesson_participants (lesson_id, student_id, position, attendance,
                        completion_id)
                    values (:lessonId, :studentId, :position, :attendance, :completionId)
                    """)
                    .param("lessonId", lesson.id())
                    .param("studentId", participant.studentId())
                    .param("position", position)
                    .param("attendance", participant.attendance().name())
                    .param("completionId", participant.completionId())
                    .update();
        }
    }

    private List<Lesson> load(List<Row> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<Participant>> participants = new HashMap<>();
        for (List<UUID> chunk : chunks(rows.stream().map(Row::id).toList())) {
            jdbc.sql("""
                    select lesson_id, student_id, attendance, completion_id from schedule.lesson_participants
                    where lesson_id in (:ids)
                    order by lesson_id, position
                    """)
                    .param("ids", chunk)
                    .query((rs, rowNum) -> Map.entry(rs.getObject("lesson_id", UUID.class),
                            new Participant(rs.getObject("student_id", UUID.class),
                                    Attendance.valueOf(rs.getString("attendance")),
                                    rs.getObject("completion_id", UUID.class))))
                    .list()
                    .forEach(entry -> participants.computeIfAbsent(entry.getKey(), key -> new ArrayList<>())
                            .add(entry.getValue()));
        }
        return rows.stream()
                .map(row -> Lesson.restore(row.id(), row.groupId(), participants.getOrDefault(row.id(), List.of()),
                        row.seriesId(), row.seriesDate(), row.startsAt(), row.durationMinutes(), row.topic(),
                        row.meetingUrl(), row.status(), row.cancelledBy(), row.cancelReason(),
                        row.originalStartsAt(), row.createdAt(), row.updatedAt(), row.version()))
                .toList();
    }

    /** Keeps {@code in (...)} lists of long periods within reasonable size. */
    private static List<List<UUID>> chunks(List<UUID> ids) {
        int size = 500;
        List<List<UUID>> chunks = new ArrayList<>();
        for (int from = 0; from < ids.size(); from += size) {
            chunks.add(ids.subList(from, Math.min(ids.size(), from + size)));
        }
        return chunks;
    }

    private static @Nullable String name(@Nullable Enum<?> value) {
        return value == null ? null : value.name();
    }

    private static Row map(ResultSet rs, int rowNum) throws SQLException {
        String cancelledBy = rs.getString("cancelled_by");
        return new Row(
                rs.getObject("id", UUID.class),
                rs.getObject("group_id", UUID.class),
                rs.getObject("series_id", UUID.class),
                rs.getObject("series_date", LocalDate.class),
                rs.getObject("starts_at", Instant.class),
                rs.getInt("duration_minutes"),
                rs.getString("topic"),
                rs.getString("meeting_url"),
                LessonStatus.valueOf(rs.getString("status")),
                cancelledBy == null ? null : CancelledBy.valueOf(cancelledBy),
                rs.getString("cancel_reason"),
                rs.getObject("original_starts_at", Instant.class),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}
