package ru.teacherbox.identity.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.identity.domain.AccountStatus;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.shared.security.Role;

@Repository
public class UserRepository {

    private static final String SELECT = """
            select id, role, login, password_hash, display_name, email, phone, note, status,
                   failed_logins, locked_until, created_at, updated_at, version
            from identity.users
            """;

    private final JdbcClient jdbc;

    public UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(User user) {
        jdbc.sql("""
                insert into identity.users (id, role, teacher_marker, login, password_hash, display_name, email,
                    phone, note, status, failed_logins, locked_until, created_at, updated_at, version)
                values (:id, :role, :teacherMarker, :login, :passwordHash, :displayName, :email,
                    :phone, :note, :status, :failedLogins, :lockedUntil, :createdAt, :updatedAt, :version)
                """)
                .param("id", user.id())
                .param("role", user.role().name())
                .param("teacherMarker", user.isTeacher() ? Boolean.TRUE : null)
                .param("login", user.login())
                .param("passwordHash", user.passwordHash())
                .param("displayName", user.profile().displayName())
                .param("email", user.profile().email())
                .param("phone", user.profile().phone())
                .param("note", user.profile().note())
                .param("status", user.status().name())
                .param("failedLogins", user.failedLogins())
                .param("lockedUntil", user.lockedUntil())
                .param("createdAt", user.createdAt())
                .param("updatedAt", user.updatedAt())
                .param("version", user.version())
                .update();
    }

    /**
     * Saves changes of a loaded user.
     *
     * @throws OptimisticLockingFailureException if the user was changed since it was loaded
     */
    public void update(User user) {
        int updated = jdbc.sql("""
                update identity.users
                set login = :login, password_hash = :passwordHash, display_name = :displayName, email = :email,
                    phone = :phone, note = :note, status = :status, failed_logins = :failedLogins,
                    locked_until = :lockedUntil, updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", user.id())
                .param("version", user.version())
                .param("login", user.login())
                .param("passwordHash", user.passwordHash())
                .param("displayName", user.profile().displayName())
                .param("email", user.profile().email())
                .param("phone", user.profile().phone())
                .param("note", user.profile().note())
                .param("status", user.status().name())
                .param("failedLogins", user.failedLogins())
                .param("lockedUntil", user.lockedUntil())
                .param("updatedAt", user.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("User " + user.id() + " was modified concurrently");
        }
        user.markSaved(user.version() + 1);
    }

    public Optional<User> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(UserRepository::map).optional();
    }

    public Optional<User> findByLogin(String normalizedLogin) {
        return jdbc.sql(SELECT + " where login = :login")
                .param("login", normalizedLogin)
                .query(UserRepository::map)
                .optional();
    }

    public boolean existsByLogin(String normalizedLogin) {
        return jdbc.sql("select count(*) from identity.users where login = :login")
                .param("login", normalizedLogin)
                .query(Integer.class)
                .single() > 0;
    }

    public Optional<User> findTeacher() {
        return jdbc.sql(SELECT + " where role = 'TEACHER'").query(UserRepository::map).optional();
    }

    public Optional<User> findAdministrator() {
        return jdbc.sql(SELECT + " where role = 'ADMIN'").query(UserRepository::map).optional();
    }

    public Optional<User> findStudent(UUID id) {
        return jdbc.sql(SELECT + " where id = :id and role = 'STUDENT'")
                .param("id", id)
                .query(UserRepository::map)
                .optional();
    }

    public List<User> findStudents() {
        return jdbc.sql(SELECT + " where role = 'STUDENT' order by lower(display_name), id")
                .query(UserRepository::map)
                .list();
    }

    public List<User> findStudentsByIds(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where role = 'STUDENT' and id in (:ids) order by lower(display_name), id")
                .param("ids", ids)
                .query(UserRepository::map)
                .list();
    }

    private static User map(ResultSet rs, int rowNum) throws SQLException {
        return User.restore(
                rs.getObject("id", UUID.class),
                Role.valueOf(rs.getString("role")),
                rs.getString("login"),
                rs.getString("password_hash"),
                new Profile(rs.getString("display_name"), rs.getString("email"), rs.getString("phone"),
                        rs.getString("note")),
                AccountStatus.valueOf(rs.getString("status")),
                rs.getInt("failed_logins"),
                rs.getObject("locked_until", Instant.class),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}
