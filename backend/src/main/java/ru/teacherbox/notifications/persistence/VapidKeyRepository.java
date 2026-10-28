package ru.teacherbox.notifications.persistence;

import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The VAPID key pair of the portal, the only row of {@code webpush_keys} (ADR-0051). */
@Repository
public class VapidKeyRepository {

    /** Both keys base64url; the private one is a 32-byte scalar. */
    public record StoredKeys(String publicKey, String privateKey, Instant createdAt) {

        @Override
        public String toString() {
            return "StoredKeys[publicKey=" + publicKey + ", privateKey=***]";
        }
    }

    private final JdbcClient jdbc;

    public VapidKeyRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<StoredKeys> find() {
        return jdbc.sql("select public_key, private_key, created_at from notifications.webpush_keys where id = 1")
                .query((rs, rowNum) -> new StoredKeys(rs.getString("public_key"), rs.getString("private_key"),
                        rs.getObject("created_at", Instant.class)))
                .optional();
    }

    /** Stores the pair unless there is one already; returns whether this call stored it. */
    public boolean insertIfAbsent(StoredKeys keys) {
        return jdbc.sql("""
                merge into notifications.webpush_keys using (values (1)) as source(id) on webpush_keys.id = source.id
                when not matched then insert (id, public_key, private_key, created_at)
                values (1, :publicKey, :privateKey, :createdAt)
                """)
                .param("publicKey", keys.publicKey())
                .param("privateKey", keys.privateKey())
                .param("createdAt", keys.createdAt())
                .update() > 0;
    }
}
