package ru.teacherbox.boards.persistence;

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
import ru.teacherbox.boards.domain.Board;
import ru.teacherbox.boards.domain.BoardKind;
import ru.teacherbox.boards.domain.BoardMember;
import ru.teacherbox.boards.domain.MemberType;

/** Boards and their members. */
@Repository
public class BoardRepository {

    private static final String SELECT = """
            select id, kind, title, url, created_at, updated_at, version from boards.boards
            """;
    private static final String ORDER = " order by created_at, id";

    private final JdbcClient jdbc;

    public BoardRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Board board, Collection<BoardMember> members) {
        jdbc.sql("""
                insert into boards.boards (id, kind, title, url, created_at, updated_at, version)
                values (:id, :kind, :title, :url, :createdAt, :updatedAt, :version)
                """)
                .param("id", board.id())
                .param("kind", board.kind().name())
                .param("title", board.title())
                .param("url", board.url())
                .param("createdAt", board.createdAt())
                .param("updatedAt", board.updatedAt())
                .param("version", board.version())
                .update();
        insertMembers(board.id(), members);
    }

    /**
     * @return the saved board with its new version
     * @throws OptimisticLockingFailureException if the board was changed since it was loaded
     */
    public Board update(Board board, Collection<BoardMember> members) {
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
        jdbc.sql("delete from boards.board_members where board_id = :id").param("id", board.id()).update();
        insertMembers(board.id(), members);
        return new Board(board.id(), board.kind(), board.title(), board.url(), board.createdAt(), board.updatedAt(),
                board.version() + 1);
    }

    /** Deletes the board with its members, scene, copies and the records of its files. */
    public boolean delete(UUID id) {
        return jdbc.sql("delete from boards.boards where id = :id").param("id", id).update() > 0;
    }

    public Optional<Board> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(BoardRepository::map).optional();
    }

    public List<Board> findAll() {
        return jdbc.sql(SELECT + ORDER).query(BoardRepository::map).list();
    }

    public List<Board> findByIds(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where id in (:ids)" + ORDER).param("ids", ids).query(BoardRepository::map).list();
    }

    /** Ids of the boards any of the students or groups is a member of. */
    public List<UUID> findIdsByMembers(Collection<UUID> memberIds) {
        if (memberIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("select distinct board_id from boards.board_members where member_id in (:ids)")
                .param("ids", memberIds)
                .query(UUID.class)
                .list();
    }

    public List<BoardMember> findMembers(UUID boardId) {
        return findMembers(List.of(boardId)).getOrDefault(boardId, List.of());
    }

    public Map<UUID, List<BoardMember>> findMembers(Collection<UUID> boardIds) {
        Map<UUID, List<BoardMember>> members = new HashMap<>();
        if (boardIds.isEmpty()) {
            return members;
        }
        jdbc.sql("""
                select board_id, member_type, member_id from boards.board_members where board_id in (:ids)
                order by member_type desc, member_id
                """)
                .param("ids", boardIds)
                .query((ResultSet rs) -> {
                    members.computeIfAbsent(rs.getObject("board_id", UUID.class), id -> new ArrayList<>())
                            .add(new BoardMember(MemberType.valueOf(rs.getString("member_type")),
                                    rs.getObject("member_id", UUID.class)));
                });
        return members;
    }

    private void insertMembers(UUID boardId, Collection<BoardMember> members) {
        for (BoardMember member : members) {
            jdbc.sql("""
                    insert into boards.board_members (board_id, member_type, member_id)
                    values (:boardId, :type, :memberId)
                    """)
                    .param("boardId", boardId)
                    .param("type", member.type().name())
                    .param("memberId", member.id())
                    .update();
        }
    }

    private static Board map(ResultSet rs, int rowNum) throws SQLException {
        return new Board(
                rs.getObject("id", UUID.class),
                BoardKind.valueOf(rs.getString("kind")),
                rs.getString("title"),
                rs.getString("url"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}
