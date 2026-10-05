package ru.teacherbox.boards.application;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.boards.domain.Board;
import ru.teacherbox.boards.domain.BoardFile;
import ru.teacherbox.boards.domain.BoardImages;
import ru.teacherbox.boards.domain.BoardKind;
import ru.teacherbox.boards.domain.BoardScene;
import ru.teacherbox.boards.domain.SceneElements;
import ru.teacherbox.boards.persistence.SceneRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.files.StoredFile;
import ru.teacherbox.shared.security.CurrentUser;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * The scene of an Excalidraw board: opening, saving with a merge per element, polling for the
 * changes of the others, and images (ADR-0028).
 */
@Service
public class SceneService {

    /** Most characters of the stored elements of one board (images are files, not counted). */
    static final int MAX_SCENE_CHARS = 5_000_000;

    /**
     * What the editor needs to open a board.
     *
     * @param url the link of an external board (it has no scene)
     */
    public record BoardContent(UUID id, BoardKind kind, String title, @Nullable String url, long sceneVersion,
            JsonNode elements, JsonNode appState) {
    }

    /** The scene after a save or a change by someone else. */
    public record SceneView(long sceneVersion, JsonNode elements, JsonNode appState) {
    }

    /** An image of a board with its content. */
    public record FileDownload(BoardFile file, Resource content) {
    }

    private final BoardService boards;
    private final SceneRepository scenes;
    private final FileStorage storage;
    private final JsonMapper json;
    private final Clock clock;
    private final ApplicationEventPublisher events;

    public SceneService(BoardService boards, SceneRepository scenes, FileStorage storage, JsonMapper json,
            Clock clock, ApplicationEventPublisher events) {
        this.boards = boards;
        this.scenes = scenes;
        this.storage = storage;
        this.json = json;
        this.clock = clock;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public BoardContent open(CurrentUser user, UUID boardId) {
        Board board = boards.requireAccess(user, boardId);
        if (!board.excalidraw()) {
            return new BoardContent(board.id(), board.kind(), board.title(), board.url(), 0,
                    json.createArrayNode(), json.createObjectNode());
        }
        SceneView scene = view(scene(board));
        return new BoardContent(board.id(), board.kind(), board.title(), null, scene.sceneVersion(),
                scene.elements(), scene.appState());
    }

    /**
     * Merges the elements into the stored scene by element (the newer version wins) and keeps the
     * whitelisted appState. Saves of one board run one after another.
     *
     * @param baseVersion the scene version the editor had; when the scene is unchanged by others and the
     *                    elements change nothing, the version stays
     * @return the merged scene
     */
    @Transactional
    public SceneView save(CurrentUser user, UUID boardId, JsonNode elements, @Nullable JsonNode appState,
            long baseVersion) {
        Board board = boards.requireAccess(user, boardId);
        List<ObjectNode> incoming = SceneElements.valid(elements);
        BoardScene stored = scenes.lock(requireScene(board).id()).orElseThrow(BoardService::notFound);
        SceneElements.Merge merge = SceneElements.merge(elements(stored.elements()), incoming);
        ObjectNode state = (ObjectNode) json.readTree(stored.appState());
        boolean stateChanged = false;
        if (appState != null && !appState.isNull()) {
            ObjectNode kept = SceneElements.appState(appState);
            stateChanged = !kept.equals(state);
            state = kept;
        }
        if (!merge.changed() && !stateChanged) {
            return view(stored);
        }
        String text = json.writeValueAsString(merge.elements());
        if (text.length() > MAX_SCENE_CHARS) {
            throw new BusinessRuleException("boards.scene-too-large", "The board is too large to save");
        }
        BoardScene saved = new BoardScene(boardId, text, json.writeValueAsString(state), stored.version() + 1,
                clock.instant(), user.id());
        scenes.update(saved);
        events.publishEvent(new SceneSaved(boardId, saved.version()));
        return view(saved);
    }

    /** @return the scene when its version differs from {@code since}; empty when nothing changed */
    @Transactional(readOnly = true)
    public Optional<SceneView> changesSince(CurrentUser user, UUID boardId, long since) {
        Board board = requireScene(boards.requireAccess(user, boardId));
        long version = scenes.findVersion(board.id()).orElseThrow(BoardService::notFound);
        return version == since ? Optional.empty() : Optional.of(view(scene(board)));
    }

    /**
     * Stores an image once: the same {@code fileId} again changes nothing (Excalidraw's file ids are
     * content hashes).
     */
    @Transactional
    public void upload(CurrentUser user, UUID boardId, String fileId, @Nullable String contentType, long size,
            InputStream content) {
        Board board = requireScene(boards.requireAccess(user, boardId));
        BoardImages.validFileId(fileId);
        if (scenes.findFile(board.id(), fileId).isPresent()) {
            return;
        }
        BoardImages.checkSize(size);
        try (BufferedInputStream input = new BufferedInputStream(content)) {
            input.mark(16);
            String type = BoardImages.contentType(contentType, input.readNBytes(12));
            input.reset();
            StoredFile stored = storage.store(BoardService.NAMESPACE, input);
            if (stored.size() > BoardImages.MAX_SIZE) {
                storage.delete(BoardService.NAMESPACE, stored.key());
                BoardImages.checkSize(stored.size());
            }
            scenes.insert(new BoardFile(board.id(), fileId, stored.key(), type, stored.size(), clock.instant()));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read the image of board " + boardId, e);
        }
    }

    @Transactional(readOnly = true)
    public FileDownload download(CurrentUser user, UUID boardId, String fileId) {
        Board board = boards.requireAccess(user, boardId);
        BoardFile file = scenes.findFile(board.id(), BoardImages.validFileId(fileId))
                .orElseThrow(() -> new NotFoundException("boards.file-not-found", "Image not found"));
        return new FileDownload(file, storage.load(BoardService.NAMESPACE, file.fileKey()));
    }

    private static Board requireScene(Board board) {
        if (!board.excalidraw()) {
            throw new ConflictException("boards.no-scene", "An external board has no scene");
        }
        return board;
    }

    private BoardScene scene(Board board) {
        return scenes.find(board.id()).orElseThrow(BoardService::notFound);
    }

    List<ObjectNode> elements(String text) {
        return SceneElements.valid(json.readTree(text));
    }

    private SceneView view(BoardScene scene) {
        return new SceneView(scene.version(), json.readTree(scene.elements()), json.readTree(scene.appState()));
    }
}
