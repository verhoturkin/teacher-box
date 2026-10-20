package ru.teacherbox.boards.application;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.boards.domain.Board;
import ru.teacherbox.boards.domain.BoardPreviews;
import ru.teacherbox.boards.persistence.PreviewRepository;
import ru.teacherbox.boards.persistence.PreviewRepository.Preview;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.files.StoredFile;
import ru.teacherbox.shared.security.CurrentUser;

/** The preview picture of a board: the editor exports a PNG on save, the board's readers get it. */
@Service
public class PreviewService {

    private final BoardService boards;
    private final PreviewRepository previews;
    private final FileStorage storage;
    private final Clock clock;

    public PreviewService(BoardService boards, PreviewRepository previews, FileStorage storage, Clock clock) {
        this.boards = boards;
        this.previews = previews;
        this.storage = storage;
        this.clock = clock;
    }

    /** Replaces the preview; the old file is deleted. Only an Excalidraw board has one. */
    @Transactional
    public void save(UUID boardId, String contentType, long size, InputStream content) {
        Board board = boards.find(boardId);
        if (!board.excalidraw()) {
            throw new ConflictException("boards.no-scene", "An external board has no preview");
        }
        BoardPreviews.checkSize(size);
        try (BufferedInputStream input = new BufferedInputStream(content)) {
            input.mark(16);
            BoardPreviews.checkType(contentType, input.readNBytes(12));
            input.reset();
            StoredFile stored = storage.store(BoardService.NAMESPACE, input);
            if (stored.size() > BoardPreviews.MAX_SIZE) {
                storage.delete(BoardService.NAMESPACE, stored.key());
                BoardPreviews.checkSize(stored.size());
            }
            String old = previews.find(boardId).map(Preview::key).orElse(null);
            previews.save(boardId, new Preview(stored.key(), stored.size(), clock.instant()));
            if (old != null) {
                storage.delete(BoardService.NAMESPACE, old);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read the preview of board " + boardId, e);
        }
    }

    /** The teacher and the board's students; anyone else gets 404 like for the board itself. */
    @Transactional(readOnly = true)
    public Resource read(CurrentUser user, UUID boardId) {
        boards.requireAccess(user, boardId);
        Preview preview = previews.find(boardId)
                .orElseThrow(() -> new NotFoundException("boards.preview-not-found", "The board has no preview"));
        return storage.load(BoardService.NAMESPACE, preview.key());
    }
}
