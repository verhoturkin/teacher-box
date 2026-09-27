package ru.teacherbox.identity.persistence;

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
import org.jspecify.annotations.Nullable;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.identity.domain.StudentGroup;

@Repository
public class GroupRepository {

    private static final String SELECT = """
            select id, name, archived_at, created_at, updated_at, version
            from identity.student_groups
            """;

    /** A group row before its members are loaded. */
    private record Row(UUID id, String name, @Nullable Instant archivedAt, Instant createdAt, Instant updatedAt,
            long version) {
    }

    private final JdbcClient jdbc;

    public GroupRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(StudentGroup group) {
        jdbc.sql("""
                insert into identity.student_groups (id, name, archived_at, created_at, updated_at, version)
                values (:id, :name, :archivedAt, :createdAt, :updatedAt, :version)
                """)
                .param("id", group.id())
                .param("name", group.name())
                .param("archivedAt", group.archivedAt())
                .param("createdAt", group.createdAt())
                .param("updatedAt", group.updatedAt())
                .param("version", group.version())
                .update();
        insertMembers(group);
    }

    /**
     * Saves changes of a loaded group, including its members.
     *
     * @throws OptimisticLockingFailureException if the group was changed since it was loaded
     */
    public void update(StudentGroup group) {
        int updated = jdbc.sql("""
                update identity.student_groups
                set name = :name, archived_at = :archivedAt, updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", group.id())
                .param("version", group.version())
                .param("name", group.name())
                .param("archivedAt", group.archivedAt())
                .param("updatedAt", group.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Group " + group.id() + " was modified concurrently");
        }
        jdbc.sql("delete from identity.group_members where group_id = :id").param("id", group.id()).update();
        insertMembers(group);
        group.markSaved(group.version() + 1);
    }

    public Optional<StudentGroup> findById(UUID id) {
        return withMembers(jdbc.sql(SELECT + " where id = :id").param("id", id).query(GroupRepository::map).list())
                .stream().findFirst();
    }

    public List<StudentGroup> findByIds(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return withMembers(jdbc.sql(SELECT + " where id in (:ids) order by lower(name), id")
                .param("ids", ids)
                .query(GroupRepository::map)
                .list());
    }

    /** All groups, current first, each part sorted by name. */
    public List<StudentGroup> findAll() {
        return withMembers(jdbc.sql(SELECT + " order by archived_at nulls first, lower(name), id")
                .query(GroupRepository::map)
                .list());
    }

    /** Current (not archived) groups the student is a member of. */
    public List<StudentGroup> findCurrentByMember(UUID studentId) {
        return withMembers(jdbc.sql(SELECT + """
                 where archived_at is null
                   and id in (select group_id from identity.group_members where student_id = :studentId)
                 order by lower(name), id
                """)
                .param("studentId", studentId)
                .query(GroupRepository::map)
                .list());
    }

    private void insertMembers(StudentGroup group) {
        List<UUID> members = group.memberIds();
        for (int position = 0; position < members.size(); position++) {
            jdbc.sql("""
                    insert into identity.group_members (group_id, student_id, position)
                    values (:groupId, :studentId, :position)
                    """)
                    .param("groupId", group.id())
                    .param("studentId", members.get(position))
                    .param("position", position)
                    .update();
        }
    }

    private List<StudentGroup> withMembers(List<Row> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<UUID>> members = new HashMap<>();
        jdbc.sql("""
                select group_id, student_id from identity.group_members
                where group_id in (:ids)
                order by group_id, position
                """)
                .param("ids", rows.stream().map(Row::id).toList())
                .query((rs, rowNum) -> Map.entry(rs.getObject("group_id", UUID.class),
                        rs.getObject("student_id", UUID.class)))
                .list()
                .forEach(entry -> members.computeIfAbsent(entry.getKey(), key -> new ArrayList<>())
                        .add(entry.getValue()));
        return rows.stream()
                .map(row -> StudentGroup.restore(row.id(), row.name(), members.getOrDefault(row.id(), List.of()),
                        row.archivedAt(), row.createdAt(), row.updatedAt(), row.version()))
                .toList();
    }

    private static Row map(ResultSet rs, int rowNum) throws SQLException {
        return new Row(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getObject("archived_at", Instant.class),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}
