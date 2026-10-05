package ru.teacherbox.boards.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.boards.domain.BackupKind;
import ru.teacherbox.boards.domain.Board;
import ru.teacherbox.boards.domain.BoardBackup;
import ru.teacherbox.boards.domain.BoardFile;
import ru.teacherbox.boards.domain.BoardScene;
import ru.teacherbox.boards.domain.SceneElements;
import ru.teacherbox.boards.persistence.SceneRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.security.CurrentUser;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Copies of Excalidraw boards (ADR-0028): daily copies of the changed boards, the teacher's own copies
 * and restoring them. Images stay while the scene or any copy refers to them.
 */
@Service
public class BoardBackupService {

    /** Most copies the teacher makes of one board (copies made before a restore are not limited). */
    static final int MAX_MANUAL = 20;

    /** An unreferenced image younger than this may belong to a scene being saved right now. */
    static final Duration UPLOAD_GRACE = Duration.ofDays(1);

    private static final Logger log = LoggerFactory.getLogger(BoardBackupService.class);

    public record BackupView(UUID id, BackupKind kind, long sceneVersion, Instant createdAt) {
    }

    private final BoardService boards;
    private final SceneRepository scenes;
    private final FileStorage storage;
    private final BoardsProperties properties;
    private final JsonMapper json;
    private final Clock clock;
    private final ApplicationEventPublisher events;

    public BoardBackupService(BoardService boards, SceneRepository scenes, FileStorage storage,
            BoardsProperties properties, JsonMapper json, Clock clock, ApplicationEventPublisher events) {
        this.boards = boards;
        this.scenes = scenes;
        this.storage = storage;
        this.properties = properties;
        this.json = json;
        this.clock = clock;
        this.events = events;
    }

    /** Newest first. */
    @Transactional(readOnly = true)
    public List<BackupView> list(UUID boardId) {
        return scenes.findBackups(excalidraw(boardId).id()).stream().map(BoardBackupService::view).toList();
    }

    @Transactional
    public BackupView create(UUID boardId) {
        Board board = excalidraw(boardId);
        if (scenes.countBackups(board.id(), BackupKind.MANUAL) >= MAX_MANUAL) {
            throw new BusinessRuleException("boards.too-many-backups",
                    "At most " + MAX_MANUAL + " copies of one board; delete an old one");
        }
        return view(copy(scene(board.id()), BackupKind.MANUAL));
    }

    /**
     * Saves the current scene as a copy, then puts the copy's elements back with versions above the
     * current ones (the open editors take them on their next poll).
     */
    @Transactional
    public BackupView restore(CurrentUser teacher, UUID boardId, UUID backupId) {
        Board board = excalidraw(boardId);
        BoardBackup backup = backup(board.id(), backupId);
        BoardScene current = scenes.lock(board.id()).orElseThrow(BoardService::notFound);
        BoardBackup safety = copy(current, BackupKind.MANUAL);
        List<ObjectNode> restored = SceneElements.restored(
                SceneElements.valid(json.readTree(current.elements())),
                SceneElements.valid(json.readTree(backup.elements())));
        scenes.update(new BoardScene(board.id(), json.writeValueAsString(restored), backup.appState(),
                current.version() + 1, clock.instant(), teacher.id()));
        events.publishEvent(new SceneSaved(board.id(), current.version() + 1));
        return view(safety);
    }

    @Transactional
    public void delete(UUID boardId, UUID backupId) {
        Board board = excalidraw(boardId);
        if (!scenes.deleteBackup(board.id(), backupId)) {
            throw notFound();
        }
        collectGarbage(board.id());
    }

    /**
     * A daily copy of every board changed since its last daily copy; keeps the newest
     * {@link BoardsProperties#backupKeep()} daily copies of each.
     *
     * @return number of copies made
     */
    @Transactional
    public int dailyCopies() {
        List<UUID> changed = scenes.findChangedSinceLastDailyCopy();
        for (UUID boardId : changed) {
            copy(scene(boardId), BackupKind.DAILY);
            List<BoardBackup> daily = scenes.findBackups(boardId).stream()
                    .filter(backup -> backup.kind() == BackupKind.DAILY).toList();
            daily.stream().skip(Math.max(properties.backupKeep(), 1))
                    .forEach(old -> scenes.deleteBackup(boardId, old.id()));
            collectGarbage(boardId);
        }
        if (!changed.isEmpty()) {
            log.info("Daily copies of {} boards made", changed.size());
        }
        return changed.size();
    }

    /** Deletes the images neither the scene nor any copy refers to (older than {@link #UPLOAD_GRACE}). */
    void collectGarbage(UUID boardId) {
        Set<String> used = new HashSet<>(SceneElements.fileIds(
                SceneElements.valid(json.readTree(scene(boardId).elements()))));
        scenes.findBackups(boardId).forEach(backup -> used.addAll(
                SceneElements.fileIds(SceneElements.valid(json.readTree(backup.elements())))));
        Instant before = clock.instant().minus(UPLOAD_GRACE);
        for (BoardFile file : scenes.findFiles(boardId)) {
            if (!used.contains(file.fileId()) && file.createdAt().isBefore(before)) {
                scenes.deleteFile(boardId, file.fileId());
                storage.delete(BoardService.NAMESPACE, file.fileKey());
            }
        }
    }

    private BoardBackup copy(BoardScene scene, BackupKind kind) {
        BoardBackup backup = new BoardBackup(Ids.newId(), scene.boardId(), kind, scene.elements(), scene.appState(),
                scene.version(), clock.instant());
        scenes.insert(backup);
        return backup;
    }

    private Board excalidraw(UUID boardId) {
        Board board = boards.find(boardId);
        if (!board.excalidraw()) {
            throw new ConflictException("boards.no-scene", "An external board has no scene");
        }
        return board;
    }

    private BoardScene scene(UUID boardId) {
        return scenes.find(boardId).orElseThrow(BoardService::notFound);
    }

    private BoardBackup backup(UUID boardId, UUID backupId) {
        return scenes.findBackup(boardId, backupId).orElseThrow(BoardBackupService::notFound);
    }

    private static BackupView view(BoardBackup backup) {
        return new BackupView(backup.id(), backup.kind(), backup.sceneVersion(), backup.createdAt());
    }

    private static NotFoundException notFound() {
        return new NotFoundException("boards.backup-not-found", "Copy not found");
    }
}
