package ru.teacherbox.boards.persistence;

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
import ru.teacherbox.boards.domain.Board;
import ru.teacherbox.boards.domain.BoardOwner;

@Repository
public class BoardRepository {

    private static final String SELECT = """
            select id, owner_type, owner_id, title, url, created_at, updated_at, version from boards.boards
            """;
    private static final String ORDER = " order by created_at, id";

    private final JdbcClient jdbc;

    public BoardRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Board board) {
        jdbc.sql("""
                insert into boards.boards (id, owner_type, owner_id, title, url, created_at, updated_at, version)
                values (:id, :ownerType, :ownerId, :title, :url, :createdAt, :updatedAt, :version)
                """)
                .param("id", board.id())
                .param("ownerType", board.ownerType().name())
                .param("ownerId", board.ownerId())
                .param("title", board.title())
                .param("url", board.url())
                .param("createdAt", board.createdAt())
                .param("updatedAt", board.updatedAt())
                .param("version", board.version())
                .update();
    }

    /**
     * @return the saved board with its new version
     * @throws OptimisticLockingFailureException if the board was changed since it was loaded
     */
    public Board update(Board board) {
        int updated = jdbc.sql("""
                update boards.boards set title = :title, url = :url, updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", board.id())
                .param("version", board.version())
                .param("title", board.title())
                .param("url", board.url())
                .param("updatedAt", board.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Board " + board.id() + " was modified");
        }
        return new Board(board.id(), board.ownerType(), board.ownerId(), board.title(), board.url(),
                board.createdAt(), board.updatedAt(), board.version() + 1);
    }

    public boolean delete(UUID id) {
        return jdbc.sql("delete from boards.boards where id = :id").param("id", id).update() > 0;
    }

    public Optional<Board> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(BoardRepository::map).optional();
    }

    public List<Board> findAll() {
        return jdbc.sql(SELECT + ORDER).query(BoardRepository::map).list();
    }

    public List<Board> findByOwners(Collection<UUID> ownerIds) {
        if (ownerIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where owner_id in (:ids)" + ORDER)
                .param("ids", ownerIds)
                .query(BoardRepository::map)
                .list();
    }

    private static Board map(ResultSet rs, int rowNum) throws SQLException {
        return new Board(
                rs.getObject("id", UUID.class),
                BoardOwner.valueOf(rs.getString("owner_type")),
                rs.getObject("owner_id", UUID.class),
                rs.getString("title"),
                rs.getString("url"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}
