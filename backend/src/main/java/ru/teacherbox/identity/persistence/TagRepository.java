package ru.teacherbox.identity.persistence;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.identity.domain.Tag;
import ru.teacherbox.shared.persistence.OptimisticLock;

/** Student tags, their values and the values set on students. */
@Repository
public class TagRepository {

    private record Row(UUID id, String name, Tag.Kind kind, boolean useInAi, long version) {
    }

    private final JdbcClient jdbc;

    public TagRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** All tags in the teacher's order. */
    public List<Tag> findAll() {
        return withValues(jdbc.sql("select id, name, kind, use_in_ai, version from identity.tags order by position, id")
                .query(Row.class)
                .list());
    }

    public void insert(Tag tag) {
        jdbc.sql("""
                insert into identity.tags (id, name, kind, use_in_ai, position, version)
                values (:id, :name, :kind, :useInAi, (select coalesce(max(position), -1) + 1 from identity.tags), :version)
                """)
                .param("id", tag.id())
                .param("name", tag.name())
                .param("kind", tag.kind().name())
                .param("useInAi", tag.useInAi())
                .param("version", tag.version())
                .update();
        saveValues(tag);
    }

    /**
     * Saves the name, the flag and the values of a loaded tag; values missing from it are removed from the tag
     * and from the students.
     *
     * @return how many students lost a removed value
     * @throws OptimisticLockingFailureException if the tag was changed since it was loaded
     */
    public int update(Tag tag) {
        int updated = jdbc.sql("""
                update identity.tags set name = :name, kind = :kind, use_in_ai = :useInAi, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", tag.id())
                .param("version", tag.version())
                .param("name", tag.name())
                .param("kind", tag.kind().name())
                .param("useInAi", tag.useInAi())
                .update();
        OptimisticLock.requireUpdated(updated, "Tag", tag.id());
        List<UUID> kept = tag.values().stream().map(Tag.Value::id).toList();
        // a text tag has no values (and no student of a kind-changed tag has any): "not in ()" would be invalid
        if (kept.isEmpty()) {
            jdbc.sql("delete from identity.tag_values where tag_id = :id").param("id", tag.id()).update();
            return 0;
        }
        int cleared = jdbc.sql("delete from identity.student_tags where tag_id = :id and value_id not in (:kept)")
                .param("id", tag.id()).param("kept", kept).update();
        jdbc.sql("delete from identity.tag_values where tag_id = :id and id not in (:kept)")
                .param("id", tag.id()).param("kept", kept).update();
        saveValues(tag);
        return cleared;
    }

    /** Whether any student has a value of the tag. */
    public boolean isUsed(UUID id) {
        return jdbc.sql("select count(*) from identity.student_tags where tag_id = :id").param("id", id)
                .query(Long.class).single() > 0;
    }

    /** @return how many students had a value of the tag */
    public int delete(UUID id) {
        int cleared = jdbc.sql("delete from identity.student_tags where tag_id = :id").param("id", id).update();
        jdbc.sql("delete from identity.tag_values where tag_id = :id").param("id", id).update();
        jdbc.sql("delete from identity.tags where id = :id").param("id", id).update();
        return cleared;
    }

    /** Puts the tags in the given order. */
    public void reorder(List<UUID> ids) {
        for (int position = 0; position < ids.size(); position++) {
            jdbc.sql("update identity.tags set position = :position where id = :id")
                    .param("id", ids.get(position)).param("position", position).update();
        }
    }

    /** Tag id to value id (list tags) or text (text tags) of each given student; students without any are absent. */
    public Map<UUID, Map<UUID, String>> findStudentTags(Collection<UUID> studentIds) {
        Map<UUID, Map<UUID, String>> result = new HashMap<>();
        if (studentIds.isEmpty()) {
            return result;
        }
        jdbc.sql("select student_id, tag_id, value_id, text from identity.student_tags where student_id in (:ids)")
                .param("ids", studentIds)
                .query((rs, rowNum) -> {
                    String value = rs.getString("text");
                    result.computeIfAbsent(rs.getObject("student_id", UUID.class), key -> new HashMap<>())
                            .put(rs.getObject("tag_id", UUID.class),
                                    value != null ? value : rs.getObject("value_id", UUID.class).toString());
                    return 0;
                }).list();
        return result;
    }

    /** Replaces all values of a student: tag id to value id (list tags) or text (text tags). */
    public void replaceStudentTags(UUID studentId, Map<UUID, Tag.Kind> kinds, Map<UUID, String> values) {
        jdbc.sql("delete from identity.student_tags where student_id = :id").param("id", studentId).update();
        values.forEach((tagId, value) -> {
            String column = kinds.get(tagId) == Tag.Kind.TEXT ? "text" : "value_id";
            Object bound = kinds.get(tagId) == Tag.Kind.TEXT ? value : UUID.fromString(value);
            jdbc.sql("insert into identity.student_tags (student_id, tag_id, " + column + ") values (:s, :t, :v)")
                    .param("s", studentId).param("t", tagId).param("v", bound).update();
        });
    }

    private void saveValues(Tag tag) {
        List<Tag.Value> values = tag.values();
        for (int position = 0; position < values.size(); position++) {
            jdbc.sql("""
                    merge into identity.tag_values (id, tag_id, label, position) key (id)
                    values (:id, :tagId, :label, :position)
                    """)
                    .param("id", values.get(position).id())
                    .param("tagId", tag.id())
                    .param("label", values.get(position).label())
                    .param("position", position)
                    .update();
        }
    }

    private List<Tag> withValues(List<Row> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<Tag.Value>> values = new HashMap<>();
        jdbc.sql("select id, tag_id, label from identity.tag_values where tag_id in (:ids) order by position, id")
                .param("ids", rows.stream().map(Row::id).toList())
                .query((rs, rowNum) -> Map.entry(rs.getObject("tag_id", UUID.class),
                        new Tag.Value(rs.getObject("id", UUID.class), rs.getString("label"))))
                .list()
                .forEach(entry -> values.computeIfAbsent(entry.getKey(), key -> new ArrayList<>()).add(entry.getValue()));
        return rows.stream()
                .map(row -> new Tag(row.id(), row.name(), row.kind(), row.useInAi(), values.getOrDefault(row.id(), List.of()),
                        row.version()))
                .toList();
    }
}
