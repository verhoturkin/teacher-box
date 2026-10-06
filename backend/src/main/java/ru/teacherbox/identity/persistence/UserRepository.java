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
import ru.teacherbox.identity.domain.Avatar;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.shared.security.Role;

@Repository
public class UserRepository {

    private static final String SELECT = """
            select id, role, login, password_hash, display_name, email, phone, note, own_name, avatar_key,
                   avatar_type, status,
                   failed_logins, locked_until, password_change_required, created_at, updated_at, version
            from identity.users
            """;

    private final JdbcClient jdbc;

    public UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(User user) {
        jdbc.sql("""
                insert into identity.users (id, role, teacher_marker, login, password_hash, display_name, email,
                    phone, note, own_name, avatar_key, avatar_type, status, failed_logins, locked_until,
                    password_change_required, created_at, updated_at, version)
                values (:id, :role, :teacherMarker, :login, :passwordHash, :displayName, :email,
                    :phone, :note, :ownName, :avatarKey, :avatarType, :status, :failedLogins, :lockedUntil,
                    :passwordChangeRequired, :createdAt, :updatedAt, :version)
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
                .param("ownName", user.ownName())
                .param("avatarKey", user.avatar() == null ? null : user.avatar().key())
                .param("avatarType", user.avatar() == null ? null : user.avatar().contentType())
                .param("status", user.status().name())
                .param("failedLogins", user.failedLogins())
                .param("lockedUntil", user.lockedUntil())
                .param("passwordChangeRequired", user.passwordChangeRequired())
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
                    phone = :phone, note = :note, own_name = :ownName, avatar_key = :avatarKey,
                    avatar_type = :avatarType, status = :status, failed_logins = :failedLogins,
                    locked_until = :lockedUntil, password_change_required = :passwordChangeRequired,
                    updated_at = :updatedAt, version = version + 1
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
                .param("ownName", user.ownName())
                .param("avatarKey", user.avatar() == null ? null : user.avatar().key())
                .param("avatarType", user.avatar() == null ? null : user.avatar().contentType())
                .param("status", user.status().name())
                .param("failedLogins", user.failedLogins())
                .param("lockedUntil", user.lockedUntil())
                .param("passwordChangeRequired", user.passwordChangeRequired())
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

    /** The photo with this storage key, if a user has it. */
    public Optional<Avatar> findAvatar(String key) {
        return jdbc.sql("select avatar_key, avatar_type from identity.users where avatar_key = :key")
                .param("key", key)
                .query((rs, rowNum) -> new Avatar(rs.getString("avatar_key"), rs.getString("avatar_type")))
                .optional();
    }

    /** Storage keys of the students' photos (the full reset deletes the files). */
    public List<String> studentAvatarKeys() {
        return jdbc.sql("select avatar_key from identity.users where role = 'STUDENT' and avatar_key is not null")
                .query(String.class)
                .list();
    }

    private static User map(ResultSet rs, int rowNum) throws SQLException {
        String avatarKey = rs.getString("avatar_key");
        return User.restore(
                rs.getObject("id", UUID.class),
                Role.valueOf(rs.getString("role")),
                rs.getString("login"),
                rs.getString("password_hash"),
                new Profile(rs.getString("display_name"), rs.getString("email"), rs.getString("phone"),
                        rs.getString("note")),
                rs.getString("own_name"),
                avatarKey == null ? null : new Avatar(avatarKey, rs.getString("avatar_type")),
                AccountStatus.valueOf(rs.getString("status")),
                rs.getInt("failed_logins"),
                rs.getObject("locked_until", Instant.class),
                rs.getBoolean("password_change_required"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}
