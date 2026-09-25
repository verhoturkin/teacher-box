package ru.teacherbox.ai.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.AiRequest;
import ru.teacherbox.ai.domain.RequestStatus;

@Repository
public class AiRequestRepository {

    /** Requests and tokens of one feature in a period. */
    public record FeatureTotals(long requests, long inputTokens, long outputTokens) {
    }

    private final JdbcClient jdbc;

    public AiRequestRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(AiRequest request) {
        jdbc.sql("""
                insert into ai.requests (id, feature, provider, model, status, input_tokens, output_tokens,
                    duration_ms, error, created_at)
                values (:id, :feature, :provider, :model, :status, :inputTokens, :outputTokens, :durationMs,
                    :error, :createdAt)
                """)
                .param("id", request.id())
                .param("feature", request.feature().name())
                .param("provider", request.provider())
                .param("model", request.model())
                .param("status", request.status().name())
                .param("inputTokens", request.inputTokens())
                .param("outputTokens", request.outputTokens())
                .param("durationMs", request.durationMs())
                .param("error", request.error())
                .param("createdAt", request.createdAt())
                .update();
    }

    /** Input plus output tokens of requests in {@code [from, to)}. */
    public long totalTokens(Instant from, Instant to) {
        return jdbc.sql("""
                select coalesce(sum(input_tokens + output_tokens), 0) from ai.requests
                where created_at >= :from and created_at < :to
                """)
                .param("from", from)
                .param("to", to)
                .query(Long.class)
                .single();
    }

    public Map<AiFeature, FeatureTotals> totalsByFeature(Instant from, Instant to) {
        Map<AiFeature, FeatureTotals> totals = new EnumMap<>(AiFeature.class);
        jdbc.sql("""
                select feature, count(*) as requests, sum(input_tokens) as input_tokens,
                    sum(output_tokens) as output_tokens
                from ai.requests
                where created_at >= :from and created_at < :to
                group by feature
                """)
                .param("from", from)
                .param("to", to)
                .query((ResultSet rs) -> {
                    totals.put(AiFeature.valueOf(rs.getString("feature")), new FeatureTotals(rs.getLong("requests"),
                            rs.getLong("input_tokens"), rs.getLong("output_tokens")));
                });
        return totals;
    }

    /** Requests in {@code [from, to)}, newest first. */
    public List<AiRequest> findRecent(Instant from, Instant to, int limit) {
        return jdbc.sql("""
                select id, feature, provider, model, status, input_tokens, output_tokens, duration_ms, error, created_at
                from ai.requests
                where created_at >= :from and created_at < :to
                order by created_at desc, id desc
                fetch first :limit rows only
                """)
                .param("from", from)
                .param("to", to)
                .param("limit", limit)
                .query(AiRequestRepository::map)
                .list();
    }

    private static AiRequest map(ResultSet rs, int rowNum) throws SQLException {
        return new AiRequest(
                rs.getObject("id", UUID.class),
                AiFeature.valueOf(rs.getString("feature")),
                rs.getString("provider"),
                rs.getString("model"),
                RequestStatus.valueOf(rs.getString("status")),
                rs.getLong("input_tokens"),
                rs.getLong("output_tokens"),
                rs.getLong("duration_ms"),
                rs.getString("error"),
                rs.getObject("created_at", Instant.class));
    }
}
