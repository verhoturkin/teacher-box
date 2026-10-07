package ru.teacherbox.textbooks.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.textbooks.api.TextbookFormat;
import ru.teacherbox.textbooks.api.TextbookKind;
import ru.teacherbox.textbooks.domain.MemberType;
import ru.teacherbox.textbooks.domain.Textbook;
import ru.teacherbox.textbooks.domain.TextbookFile;
import ru.teacherbox.textbooks.domain.TextbookMember;

/** Textbooks and their members. */
@Repository
public class TextbookRepository {

    private static final String SELECT = """
            select id, kind, title, course, page_count, format, file_key, filename, content_type, size, created_at,
                   updated_at, version
            from textbooks.textbooks
            """;
    private static final String ORDER = " order by created_at desc, id desc";

    private final JdbcClient jdbc;

    public TextbookRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Textbook textbook, Collection<TextbookMember> members) {
        jdbc.sql("""
                insert into textbooks.textbooks (id, kind, title, course, page_count, format, file_key, filename,
                    content_type, size, created_at, updated_at, version)
                values (:id, :kind, :title, :course, :pageCount, :format, :fileKey, :filename, :contentType, :size,
                    :createdAt, :updatedAt, :version)
                """)
                .params(params(textbook))
                .param("createdAt", textbook.createdAt())
                .update();
        insertMembers(textbook.id(), members);
    }

    /**
     * Saves the fields and the file; members are replaced only when given.
     *
     * @return the saved textbook with its new version
     * @throws OptimisticLockingFailureException if the textbook was changed since it was loaded
     */
    public Textbook update(Textbook textbook, Optional<? extends Collection<TextbookMember>> members) {
        int updated = jdbc.sql("""
                update textbooks.textbooks set kind = :kind, title = :title, course = :course,
                    page_count = :pageCount, format = :format, file_key = :fileKey, filename = :filename,
                    content_type = :contentType, size = :size, updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .params(params(textbook))
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Textbook " + textbook.id() + " was modified");
        }
        members.ifPresent(list -> {
            jdbc.sql("delete from textbooks.textbook_members where textbook_id = :id").param("id", textbook.id())
                    .update();
            insertMembers(textbook.id(), list);
        });
        return new Textbook(textbook.id(), textbook.kind(), textbook.title(), textbook.course(),
                textbook.pageCount(), textbook.file(), textbook.createdAt(), textbook.updatedAt(),
                textbook.version() + 1);
    }

    /** Deletes the textbook with its members. */
    public boolean delete(UUID id) {
        return jdbc.sql("delete from textbooks.textbooks where id = :id").param("id", id).update() > 0;
    }

    public Optional<Textbook> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(TextbookRepository::map).optional();
    }

    /** Newest first. */
    public List<Textbook> findAll() {
        return jdbc.sql(SELECT + ORDER).query(TextbookRepository::map).list();
    }

    public List<Textbook> findByIds(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where id in (:ids)" + ORDER).param("ids", ids).query(TextbookRepository::map)
                .list();
    }

    /** Ids of the textbooks any of the students or groups is a member of. */
    public List<UUID> findIdsByMembers(Collection<UUID> memberIds) {
        if (memberIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("select distinct textbook_id from textbooks.textbook_members where member_id in (:ids)")
                .param("ids", memberIds)
                .query(UUID.class)
                .list();
    }

    public List<TextbookMember> findMembers(UUID textbookId) {
        return findMembers(List.of(textbookId)).getOrDefault(textbookId, List.of());
    }

    public Map<UUID, List<TextbookMember>> findMembers(Collection<UUID> textbookIds) {
        Map<UUID, List<TextbookMember>> members = new HashMap<>();
        if (textbookIds.isEmpty()) {
            return members;
        }
        jdbc.sql("""
                select textbook_id, member_type, member_id from textbooks.textbook_members
                where textbook_id in (:ids)
                order by member_type desc, member_id
                """)
                .param("ids", textbookIds)
                .query((ResultSet rs) -> {
                    members.computeIfAbsent(rs.getObject("textbook_id", UUID.class), id -> new ArrayList<>())
                            .add(new TextbookMember(MemberType.valueOf(rs.getString("member_type")),
                                    rs.getObject("member_id", UUID.class)));
                });
        return members;
    }

    private void insertMembers(UUID textbookId, Collection<TextbookMember> members) {
        for (TextbookMember member : members) {
            jdbc.sql("""
                    insert into textbooks.textbook_members (textbook_id, member_type, member_id)
                    values (:textbookId, :type, :memberId)
                    """)
                    .param("textbookId", textbookId)
                    .param("type", member.type().name())
                    .param("memberId", member.id())
                    .update();
        }
    }

    private static Map<String, Object> params(Textbook textbook) {
        Map<String, Object> params = new HashMap<>();
        params.put("id", textbook.id());
        params.put("kind", textbook.kind().name());
        params.put("title", textbook.title());
        params.put("course", textbook.course());
        params.put("pageCount", textbook.pageCount());
        params.put("format", textbook.file().format().name());
        params.put("fileKey", textbook.file().key());
        params.put("filename", textbook.file().filename());
        params.put("contentType", textbook.file().contentType());
        params.put("size", textbook.file().size());
        params.put("updatedAt", textbook.updatedAt());
        params.put("version", textbook.version());
        return params;
    }

    private static Textbook map(ResultSet rs, int rowNum) throws SQLException {
        return new Textbook(
                rs.getObject("id", UUID.class),
                TextbookKind.valueOf(rs.getString("kind")),
                rs.getString("title"),
                rs.getString("course"),
                rs.getObject("page_count", Integer.class),
                new TextbookFile(rs.getString("file_key"), rs.getString("filename"), rs.getString("content_type"),
                        rs.getLong("size"), TextbookFormat.valueOf(rs.getString("format"))),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}
