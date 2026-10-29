package ru.teacherbox.homework.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.homework.domain.AssignmentVideo;
import ru.teacherbox.homework.domain.VideoLink;

/** Videos of assignments (ADR-0047); they go with their assignment (cascade). */
@Repository
public class VideoRepository {

    private final JdbcClient jdbc;

    public VideoRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Puts these videos in place of the assignment's ones. */
    public void replace(UUID assignmentId, List<AssignmentVideo> videos) {
        jdbc.sql("delete from homework.assignment_videos where assignment_id = :assignmentId")
                .param("assignmentId", assignmentId)
                .update();
        for (AssignmentVideo video : videos) {
            jdbc.sql("""
                    insert into homework.assignment_videos (id, assignment_id, position, url, provider, video_id,
                        start_seconds, title, transcript, transcript_shown)
                    values (:id, :assignmentId, :position, :url, :provider, :videoId, :startSeconds, :title,
                        :transcript, :transcriptShown)
                    """)
                    .param("id", video.id())
                    .param("assignmentId", video.assignmentId())
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
    public List<AssignmentVideo> findByAssignment(UUID assignmentId) {
        return jdbc.sql("""
                select id, assignment_id, position, url, provider, video_id, start_seconds, title, transcript,
                    transcript_shown
                from homework.assignment_videos where assignment_id = :assignmentId order by position
                """)
                .param("assignmentId", assignmentId)
                .query(VideoRepository::map)
                .list();
    }

    private static AssignmentVideo map(ResultSet rs, int rowNum) throws SQLException {
        int start = rs.getInt("start_seconds");
        Integer startSeconds = rs.wasNull() ? null : start;
        VideoLink link = new VideoLink(rs.getString("url"), VideoLink.Provider.valueOf(rs.getString("provider")),
                rs.getString("video_id"), startSeconds);
        return new AssignmentVideo(rs.getObject("id", UUID.class), rs.getObject("assignment_id", UUID.class),
                rs.getInt("position"), link, rs.getString("title"), rs.getString("transcript"),
                rs.getBoolean("transcript_shown"));
    }

    /** How many videos every assignment has (assignments with none are absent). */
    public Map<UUID, Integer> countsByAssignment() {
        Map<UUID, Integer> counts = new HashMap<>();
        jdbc.sql("select assignment_id, count(*) as total from homework.assignment_videos group by assignment_id")
                .query((ResultSet rs) -> {
                    counts.put(rs.getObject("assignment_id", UUID.class), rs.getInt("total"));
                });
        return counts;
    }
}
