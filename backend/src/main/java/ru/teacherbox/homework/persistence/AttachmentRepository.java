package ru.teacherbox.homework.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.homework.domain.Attachment;
import ru.teacherbox.homework.domain.AttachmentOwner;

@Repository
public class AttachmentRepository {

    private static final String SELECT = """
            select id, owner_type, owner_id, file_key, filename, content_type, size_bytes, sha256, uploaded_at
            from homework.attachments
            """;

    private final JdbcClient jdbc;

    public AttachmentRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Attachment attachment) {
        jdbc.sql("""
                insert into homework.attachments (id, owner_type, owner_id, file_key, filename, content_type,
                    size_bytes, sha256, uploaded_at)
                values (:id, :ownerType, :ownerId, :fileKey, :filename, :contentType, :size, :sha256, :uploadedAt)
                """)
                .param("id", attachment.id())
                .param("ownerType", attachment.ownerType().name())
                .param("ownerId", attachment.ownerId())
                .param("fileKey", attachment.fileKey())
                .param("filename", attachment.filename())
                .param("contentType", attachment.contentType())
                .param("size", attachment.size())
                .param("sha256", attachment.sha256())
                .param("uploadedAt", attachment.uploadedAt())
                .update();
    }

    public void delete(UUID id) {
        jdbc.sql("delete from homework.attachments where id = :id").param("id", id).update();
    }

    public Optional<Attachment> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(AttachmentRepository::map).optional();
    }

    public List<Attachment> findByOwner(AttachmentOwner ownerType, UUID ownerId) {
        return findByOwners(ownerType, List.of(ownerId));
    }

    public List<Attachment> findByOwners(AttachmentOwner ownerType, Collection<UUID> ownerIds) {
        if (ownerIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where owner_type = :ownerType and owner_id in (:ownerIds) order by uploaded_at, id")
                .param("ownerType", ownerType.name())
                .param("ownerIds", ownerIds)
                .query(AttachmentRepository::map)
                .list();
    }

    private static Attachment map(ResultSet rs, int rowNum) throws SQLException {
        return new Attachment(
                rs.getObject("id", UUID.class),
                AttachmentOwner.valueOf(rs.getString("owner_type")),
                rs.getObject("owner_id", UUID.class),
                rs.getString("file_key"),
                rs.getString("filename"),
                rs.getString("content_type"),
                rs.getLong("size_bytes"),
                rs.getString("sha256"),
                rs.getObject("uploaded_at", Instant.class));
    }
}
