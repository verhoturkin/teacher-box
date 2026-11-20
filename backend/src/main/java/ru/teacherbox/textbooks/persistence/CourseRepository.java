package ru.teacherbox.textbooks.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.shared.persistence.OptimisticLock;
import ru.teacherbox.textbooks.domain.Course;

/**
 * Courses and the current courses of students and groups (ADR-0071). Names are unique ignoring case: the key is
 * {@code lower(name)} of the database.
 */
@Repository
public class CourseRepository {

    /** A student's or a group's current course. */
    public record Link(UUID ownerId, UUID courseId) {
    }

    private static final String SELECT = "select id, name, position, version from textbooks.courses";

    private final JdbcClient jdbc;

    public CourseRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** The course goes after the others. */
    public Course insert(Course course) {
        int position = jdbc.sql("select coalesce(max(position) + 1, 0) from textbooks.courses").query(Integer.class)
                .single();
        jdbc.sql("""
                insert into textbooks.courses (id, name, name_key, position, version)
                values (:id, :name, lower(:name), :position, 0)
                """)
                .param("id", course.id())
                .param("name", course.name())
                .param("position", position)
                .update();
        return new Course(course.id(), course.name(), position, 0);
    }

    /**
     * @return the course with its new version
     * @throws OptimisticLockingFailureException if the course was changed since it was loaded
     */
    public Course update(Course course) {
        int updated = jdbc.sql("""
                update textbooks.courses set name = :name, name_key = lower(:name), version = version + 1
                where id = :id and version = :version
                """)
                .param("id", course.id())
                .param("name", course.name())
                .param("version", course.version())
                .update();
        OptimisticLock.requireUpdated(updated, "Course", course.id());
        return new Course(course.id(), course.name(), course.position(), course.version() + 1);
    }

    /**
     * Deletes the course with its links: the current courses of students and groups (cascade), the textbooks'
     * course (a new version of each) and the textbooks shared with its students.
     */
    public void delete(UUID id) {
        jdbc.sql("""
                update textbooks.textbooks set course_id = null, version = version + 1 where course_id = :id
                """).param("id", id).update();
        jdbc.sql("delete from textbooks.textbook_members where member_type = 'COURSE' and member_id = :id")
                .param("id", id).update();
        jdbc.sql("delete from textbooks.courses where id = :id").param("id", id).update();
    }

    /** Puts the courses in the given order; a new position does not change a course's version. */
    public void reorder(List<UUID> ids) {
        for (int position = 0; position < ids.size(); position++) {
            jdbc.sql("update textbooks.courses set position = :position where id = :id")
                    .param("id", ids.get(position)).param("position", position).update();
        }
    }

    public Optional<Course> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(CourseRepository::map).optional();
    }

    /** Another course with the same name ignoring case. */
    public boolean nameTaken(String name, UUID exceptId) {
        return jdbc.sql("select count(*) from textbooks.courses where name_key = lower(:name) and id <> :id")
                .param("name", name)
                .param("id", exceptId)
                .query(Integer.class)
                .single() > 0;
    }

    /** In the teacher's order. */
    public List<Course> findAll() {
        return jdbc.sql(SELECT + " order by position, name_key").query(CourseRepository::map).list();
    }

    public List<Course> findByIds(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where id in (:ids) order by position, name_key").param("ids", ids)
                .query(CourseRepository::map).list();
    }

    public Optional<UUID> courseOfStudent(UUID studentId) {
        return jdbc.sql("select course_id from textbooks.student_courses where student_id = :id")
                .param("id", studentId).query(UUID.class).optional();
    }

    public Optional<UUID> courseOfGroup(UUID groupId) {
        return jdbc.sql("select course_id from textbooks.group_courses where group_id = :id")
                .param("id", groupId).query(UUID.class).optional();
    }

    /** The courses of the given groups. */
    public List<UUID> coursesOfGroups(Collection<UUID> groupIds) {
        if (groupIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("select distinct course_id from textbooks.group_courses where group_id in (:ids)")
                .param("ids", groupIds).query(UUID.class).list();
    }

    /** Sets the student's current course; {@code null} — none. */
    public void setStudentCourse(UUID studentId, @Nullable UUID courseId) {
        setLink("student_courses", "student_id", studentId, courseId);
    }

    /** Sets the group's current course; {@code null} — none. */
    public void setGroupCourse(UUID groupId, @Nullable UUID courseId) {
        setLink("group_courses", "group_id", groupId, courseId);
    }

    public List<Link> studentLinks() {
        return links("select student_id, course_id from textbooks.student_courses order by student_id");
    }

    public List<Link> groupLinks() {
        return links("select group_id, course_id from textbooks.group_courses order by group_id");
    }

    private void setLink(String table, String column, UUID ownerId, @Nullable UUID courseId) {
        jdbc.sql("delete from textbooks." + table + " where " + column + " = :owner").param("owner", ownerId)
                .update();
        if (courseId != null) {
            jdbc.sql("insert into textbooks." + table + " (" + column + ", course_id) values (:owner, :course)")
                    .param("owner", ownerId)
                    .param("course", courseId)
                    .update();
        }
    }

    private List<Link> links(String sql) {
        return jdbc.sql(sql).query((rs, rowNum) -> new Link(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class)))
                .list();
    }

    private static Course map(ResultSet rs, int rowNum) throws SQLException {
        return new Course(rs.getObject("id", UUID.class), rs.getString("name"), rs.getInt("position"),
                rs.getLong("version"));
    }
}
