package ru.teacherbox.boards.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.boards.domain.BackupKind;
import ru.teacherbox.boards.domain.BoardBackup;
import ru.teacherbox.boards.domain.BoardFile;
import ru.teacherbox.boards.domain.BoardScene;

/** Scenes of Excalidraw boards, their copies and images. */
@Repository
public class SceneRepository {

    private static final String SELECT_SCENE = """
            select board_id, elements, app_state, scene_version, updated_at, updated_by from boards.board_scenes
            """;
    private static final String SELECT_BACKUP = """
            select id, board_id, kind, elements, app_state, scene_version, created_at from boards.board_backups
            """;
    private static final String SELECT_FILE = """
            select board_id, file_id, file_key, content_type, size, created_at from boards.board_files
            """;

    private final JdbcClient jdbc;

    public SceneRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(BoardScene scene) {
        jdbc.sql("""
                insert into boards.board_scenes (board_id, elements, app_state, scene_version, updated_at, updated_by)
                values (:boardId, :elements, :appState, :version, :updatedAt, :updatedBy)
                """)
                .param("boardId", scene.boardId())
                .param("elements", scene.elements())
                .param("appState", scene.appState())
                .param("version", scene.version())
                .param("updatedAt", scene.updatedAt())
                .param("updatedBy", scene.updatedBy())
                .update();
    }

    public void update(BoardScene scene) {
        jdbc.sql("""
                update boards.board_scenes set elements = :elements, app_state = :appState,
                    scene_version = :version, updated_at = :updatedAt, updated_by = :updatedBy
                where board_id = :boardId
                """)
                .param("boardId", scene.boardId())
                .param("elements", scene.elements())
                .param("appState", scene.appState())
                .param("version", scene.version())
                .param("updatedAt", scene.updatedAt())
                .param("updatedBy", scene.updatedBy())
                .update();
    }

    public Optional<BoardScene> find(UUID boardId) {
        return jdbc.sql(SELECT_SCENE + " where board_id = :id").param("id", boardId)
                .query(SceneRepository::mapScene).optional();
    }

    /** The scene locked until the end of the transaction: saves of one board go one after another. */
    public Optional<BoardScene> lock(UUID boardId) {
        return jdbc.sql(SELECT_SCENE + " where board_id = :id for update").param("id", boardId)
                .query(SceneRepository::mapScene).optional();
    }

    public Optional<Long> findVersion(UUID boardId) {
        return jdbc.sql("select scene_version from boards.board_scenes where board_id = :id").param("id", boardId)
                .query(Long.class).optional();
    }

    /** When each scene was changed last, by board. */
    public Map<UUID, Instant> findUpdatedAt(List<UUID> boardIds) {
        if (boardIds.isEmpty()) {
            return Map.of();
        }
        return jdbc.sql("select board_id, updated_at from boards.board_scenes where board_id in (:ids)")
                .param("ids", boardIds)
                .query((rs, row) -> Map.entry(rs.getObject("board_id", UUID.class),
                        rs.getObject("updated_at", Instant.class)))
                .list().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    /** Scenes changed after their last daily copy (or never copied), with at least one save. */
    public List<UUID> findChangedSinceLastDailyCopy() {
        return jdbc.sql("""
                select s.board_id from boards.board_scenes s
                where s.scene_version > coalesce(
                    (select max(b.scene_version) from boards.board_backups b
                     where b.board_id = s.board_id and b.kind = 'DAILY'), 0)
                order by s.board_id
                """).query(UUID.class).list();
    }

    public void insert(BoardBackup backup) {
        jdbc.sql("""
                insert into boards.board_backups (id, board_id, kind, elements, app_state, scene_version, created_at)
                values (:id, :boardId, :kind, :elements, :appState, :version, :createdAt)
                """)
                .param("id", backup.id())
                .param("boardId", backup.boardId())
                .param("kind", backup.kind().name())
                .param("elements", backup.elements())
                .param("appState", backup.appState())
                .param("version", backup.sceneVersion())
                .param("createdAt", backup.createdAt())
                .update();
    }

    /** Newest first. */
    public List<BoardBackup> findBackups(UUID boardId) {
        return jdbc.sql(SELECT_BACKUP + " where board_id = :id order by created_at desc, id desc")
                .param("id", boardId).query(SceneRepository::mapBackup).list();
    }

    public Optional<BoardBackup> findBackup(UUID boardId, UUID backupId) {
        return jdbc.sql(SELECT_BACKUP + " where board_id = :boardId and id = :id")
                .param("boardId", boardId).param("id", backupId).query(SceneRepository::mapBackup).optional();
    }

    public int countBackups(UUID boardId, BackupKind kind) {
        return jdbc.sql("select count(*) from boards.board_backups where board_id = :id and kind = :kind")
                .param("id", boardId).param("kind", kind.name()).query(Integer.class).single();
    }

    public boolean deleteBackup(UUID boardId, UUID backupId) {
        return jdbc.sql("delete from boards.board_backups where board_id = :boardId and id = :id")
                .param("boardId", boardId).param("id", backupId).update() > 0;
    }

    public void insert(BoardFile file) {
        jdbc.sql("""
                insert into boards.board_files (board_id, file_id, file_key, content_type, size, created_at)
                values (:boardId, :fileId, :fileKey, :contentType, :size, :createdAt)
                """)
                .param("boardId", file.boardId())
                .param("fileId", file.fileId())
                .param("fileKey", file.fileKey())
                .param("contentType", file.contentType())
                .param("size", file.size())
                .param("createdAt", file.createdAt())
                .update();
    }

    public Optional<BoardFile> findFile(UUID boardId, String fileId) {
        return jdbc.sql(SELECT_FILE + " where board_id = :boardId and file_id = :fileId")
                .param("boardId", boardId).param("fileId", fileId).query(SceneRepository::mapFile).optional();
    }

    public List<BoardFile> findFiles(UUID boardId) {
        return jdbc.sql(SELECT_FILE + " where board_id = :id").param("id", boardId)
                .query(SceneRepository::mapFile).list();
    }

    public void deleteFile(UUID boardId, String fileId) {
        jdbc.sql("delete from boards.board_files where board_id = :boardId and file_id = :fileId")
                .param("boardId", boardId).param("fileId", fileId).update();
    }

    private static BoardScene mapScene(ResultSet rs, int rowNum) throws SQLException {
        return new BoardScene(
                rs.getObject("board_id", UUID.class),
                rs.getString("elements"),
                rs.getString("app_state"),
                rs.getLong("scene_version"),
                rs.getObject("updated_at", Instant.class),
                rs.getObject("updated_by", UUID.class));
    }

    private static BoardBackup mapBackup(ResultSet rs, int rowNum) throws SQLException {
        return new BoardBackup(
                rs.getObject("id", UUID.class),
                rs.getObject("board_id", UUID.class),
                BackupKind.valueOf(rs.getString("kind")),
                rs.getString("elements"),
                rs.getString("app_state"),
                rs.getLong("scene_version"),
                rs.getObject("created_at", Instant.class));
    }

    private static BoardFile mapFile(ResultSet rs, int rowNum) throws SQLException {
        return new BoardFile(
                rs.getObject("board_id", UUID.class),
                rs.getString("file_id"),
                rs.getString("file_key"),
                rs.getString("content_type"),
                rs.getLong("size"),
                rs.getObject("created_at", Instant.class));
    }
}
