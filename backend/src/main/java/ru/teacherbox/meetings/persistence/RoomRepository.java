package ru.teacherbox.meetings.persistence;

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
import ru.teacherbox.meetings.domain.Room;
import ru.teacherbox.meetings.domain.RoomOwner;

@Repository
public class RoomRepository {

    private static final String SELECT = """
            select id, owner_type, owner_id, join_url, created_at, updated_at, version
            from meetings.rooms
            """;

    private final JdbcClient jdbc;

    public RoomRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Room room) {
        jdbc.sql("""
                insert into meetings.rooms (id, owner_type, owner_id, join_url, created_at, updated_at, version)
                values (:id, :ownerType, :ownerId, :joinUrl, :createdAt, :updatedAt, :version)
                """)
                .param("id", room.id())
                .param("ownerType", room.ownerType().name())
                .param("ownerId", room.ownerId())
                .param("joinUrl", room.joinUrl())
                .param("createdAt", room.createdAt())
                .param("updatedAt", room.updatedAt())
                .param("version", room.version())
                .update();
    }

    /** @throws OptimisticLockingFailureException if the room was changed since it was loaded */
    public Room update(Room room) {
        int updated = jdbc.sql("""
                update meetings.rooms
                set join_url = :joinUrl, updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", room.id())
                .param("version", room.version())
                .param("joinUrl", room.joinUrl())
                .param("updatedAt", room.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Room " + room.id() + " was modified");
        }
        return new Room(room.id(), room.ownerType(), room.ownerId(), room.joinUrl(), room.createdAt(),
                room.updatedAt(), room.version() + 1);
    }

    public boolean deleteByOwner(UUID ownerId) {
        return jdbc.sql("delete from meetings.rooms where owner_id = :ownerId").param("ownerId", ownerId).update() > 0;
    }

    public Optional<Room> findByOwner(UUID ownerId) {
        return jdbc.sql(SELECT + " where owner_id = :ownerId").param("ownerId", ownerId).query(RoomRepository::map)
                .optional();
    }

    public List<Room> findByOwners(Collection<UUID> ownerIds) {
        if (ownerIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where owner_id in (:ids)").param("ids", ownerIds).query(RoomRepository::map).list();
    }

    public List<Room> findAll() {
        return jdbc.sql(SELECT + " order by created_at, id").query(RoomRepository::map).list();
    }

    private static Room map(ResultSet rs, int rowNum) throws SQLException {
        return new Room(
                rs.getObject("id", UUID.class),
                RoomOwner.valueOf(rs.getString("owner_type")),
                rs.getObject("owner_id", UUID.class),
                rs.getString("join_url"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}
