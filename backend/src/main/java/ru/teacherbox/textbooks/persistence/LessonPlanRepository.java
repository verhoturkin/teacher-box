package ru.teacherbox.textbooks.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.shared.persistence.OptimisticLock;
import ru.teacherbox.shared.persistence.RecordRowMapper;
import ru.teacherbox.textbooks.api.VideoLink;
import ru.teacherbox.textbooks.domain.LessonPlan;
import ru.teacherbox.textbooks.domain.PlanTextbook;
import ru.teacherbox.textbooks.domain.PlanVideo;

/** Lesson plans with their textbooks and videos (ADR-0071); textbooks and videos go with their plan (cascade). */
@Repository
public class LessonPlanRepository {

    private static final String SELECT = """
            select id, title, body, course_id, bank, source_id, created_at, updated_at, version
            from textbooks.lesson_plans
            """;

    private final JdbcClient jdbc;

    public LessonPlanRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(LessonPlan plan) {
        jdbc.sql("""
                insert into textbooks.lesson_plans (id, title, body, course_id, bank, source_id, created_at,
                    updated_at, version)
                values (:id, :title, :body, :courseId, :bank, :sourceId, :createdAt, :updatedAt, :version)
                """)
                .param("id", plan.id())
                .param("title", plan.title())
                .param("body", plan.body())
                .param("courseId", plan.courseId())
                .param("bank", plan.bank())
                .param("sourceId", plan.sourceId())
                .param("createdAt", plan.createdAt())
                .param("updatedAt", plan.updatedAt())
                .param("version", plan.version())
                .update();
    }

    /**
     * Saves the content and the source of the plan.
     *
     * @return the plan with its new version
     * @throws OptimisticLockingFailureException if the plan was changed since it was loaded
     */
    public LessonPlan update(LessonPlan plan) {
        int updated = jdbc.sql("""
                update textbooks.lesson_plans set title = :title, body = :body, course_id = :courseId,
                    source_id = :sourceId, updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", plan.id())
                .param("title", plan.title())
                .param("body", plan.body())
                .param("courseId", plan.courseId())
                .param("sourceId", plan.sourceId())
                .param("updatedAt", plan.updatedAt())
                .param("version", plan.version())
                .update();
        OptimisticLock.requireUpdated(updated, "LessonPlan", plan.id());
        return new LessonPlan(plan.id(), plan.title(), plan.body(), plan.courseId(), plan.bank(), plan.sourceId(),
                plan.createdAt(), plan.updatedAt(), plan.version() + 1);
    }

    /** Deletes the plan with its textbooks and videos; the copies of a bank item lose their source. */
    public boolean delete(UUID id) {
        return jdbc.sql("delete from textbooks.lesson_plans where id = :id").param("id", id).update() > 0;
    }

    public Optional<LessonPlan> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(RecordRowMapper.of(LessonPlan.class)).optional();
    }

    /** The given plans, deleted ones are missing. */
    public List<LessonPlan> findByIds(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where id in (:ids)").param("ids", ids).query(RecordRowMapper.of(LessonPlan.class)).list();
    }

    /** Bank items or working plans, the last changed first. */
    public List<LessonPlan> findAll(boolean bank) {
        return jdbc.sql(SELECT + " where bank = :bank order by updated_at desc, id").param("bank", bank)
                .query(RecordRowMapper.of(LessonPlan.class)).list();
    }

    /** How many working plans came from each bank item (items never used are absent). */
    public Map<UUID, Integer> uses() {
        Map<UUID, Integer> counts = new HashMap<>();
        jdbc.sql("""
                select source_id, count(*) as total from textbooks.lesson_plans
                where source_id is not null group by source_id
                """)
                .query((ResultSet rs) -> {
                    counts.put(rs.getObject("source_id", UUID.class), rs.getInt("total"));
                });
        return counts;
    }

    /** How many working plans came from the bank item. */
    public int countUses(UUID bankItemId) {
        return jdbc.sql("select count(*) from textbooks.lesson_plans where source_id = :id").param("id", bankItemId)
                .query(Integer.class).single();
    }

    /** Puts these textbooks in place of the plan's ones. */
    public void replaceTextbooks(UUID planId, List<PlanTextbook> textbooks) {
        jdbc.sql("delete from textbooks.lesson_plan_textbooks where plan_id = :planId").param("planId", planId)
                .update();
        for (PlanTextbook textbook : textbooks) {
            jdbc.sql("""
                    insert into textbooks.lesson_plan_textbooks (plan_id, textbook_id, position, pages)
                    values (:planId, :textbookId, :position, :pages)
                    """)
                    .param("planId", textbook.planId())
                    .param("textbookId", textbook.textbookId())
                    .param("position", textbook.position())
                    .param("pages", textbook.pages())
                    .update();
        }
    }

    /** In the teacher's order. */
    public List<PlanTextbook> findTextbooks(UUID planId) {
        return jdbc.sql("""
                select plan_id, textbook_id, position, pages from textbooks.lesson_plan_textbooks
                where plan_id = :planId order by position
                """)
                .param("planId", planId)
                .query(RecordRowMapper.of(PlanTextbook.class))
                .list();
    }

    /** Puts these videos in place of the plan's ones. */
    public void replaceVideos(UUID planId, List<PlanVideo> videos) {
        jdbc.sql("delete from textbooks.lesson_plan_videos where plan_id = :planId").param("planId", planId)
                .update();
        for (PlanVideo video : videos) {
            jdbc.sql("""
                    insert into textbooks.lesson_plan_videos (id, plan_id, position, url, provider, video_id,
                        start_seconds, title, transcript, transcript_shown)
                    values (:id, :planId, :position, :url, :provider, :videoId, :startSeconds, :title,
                        :transcript, :transcriptShown)
                    """)
                    .param("id", video.id())
                    .param("planId", video.planId())
                    .param("position", video.position())
                    .param("url", video.link().url())
                    .param("provider", video.link().provider().name())
                    .param("videoId", video.link().videoId())
                    .param("startSeconds", video.link().startSeconds())
                    .param("title", video.title())
                    .param("transcript", video.transcript())
                    .param("transcriptShown", video.transcriptShown())
                    .update();
        }
    }

    /** In the teacher's order. */
    public List<PlanVideo> findVideos(UUID planId) {
        return jdbc.sql("""
                select id, plan_id, position, url, provider, video_id, start_seconds, title, transcript,
                    transcript_shown
                from textbooks.lesson_plan_videos where plan_id = :planId order by position
                """)
                .param("planId", planId)
                .query(LessonPlanRepository::mapVideo)
                .list();
    }

    private static PlanVideo mapVideo(ResultSet rs, int rowNum) throws SQLException {
        VideoLink link = new VideoLink(rs.getString("url"), VideoLink.Provider.valueOf(rs.getString("provider")),
                rs.getString("video_id"), rs.getObject("start_seconds", Integer.class));
        return new PlanVideo(rs.getObject("id", UUID.class), rs.getObject("plan_id", UUID.class),
                rs.getInt("position"), link, rs.getString("title"), rs.getString("transcript"),
                rs.getBoolean("transcript_shown"));
    }
}
