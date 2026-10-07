package ru.teacherbox.boards.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.boards.application.BoardBackupService;
import ru.teacherbox.boards.application.BoardBackupService.BackupView;
import ru.teacherbox.boards.application.BoardService;
import ru.teacherbox.boards.application.BoardService.BoardView;
import ru.teacherbox.boards.domain.Board;
import ru.teacherbox.boards.domain.BoardKind;
import ru.teacherbox.shared.security.CurrentUser;

/** The teacher's boards and their copies; {@code /api/teacher/**} requires the teacher role. */
@RestController
@RequestMapping("/api/teacher/boards")
class TeacherBoardsController {

    /** @param url the link of an external board ({@code LINK}); ignored for an Excalidraw board */
    record CreateRequest(@NotNull BoardKind kind, @NotBlank @Size(max = Board.MAX_TITLE) String title,
            @Size(max = Board.MAX_URL) @Nullable String url, @Size(max = 200) @Nullable List<UUID> studentIds,
            @Size(max = 100) @Nullable List<UUID> groupIds) {
    }

    record ChangeRequest(@NotBlank @Size(max = Board.MAX_TITLE) String title,
            @Size(max = Board.MAX_URL) @Nullable String url, @Size(max = 200) @Nullable List<UUID> studentIds,
            @Size(max = 100) @Nullable List<UUID> groupIds, @NotNull Long version) {
    }

    private final BoardService boards;
    private final BoardBackupService backups;

    TeacherBoardsController(BoardService boards, BoardBackupService backups) {
        this.boards = boards;
        this.backups = backups;
    }

    /**
     * All boards, or those of some students (with their groups' boards; {@code studentId} may repeat) or of a
     * group.
     */
    @GetMapping
    List<BoardView> list(@RequestParam(required = false) @Size(max = 200) @Nullable List<UUID> studentId,
            @RequestParam(required = false) @Nullable UUID groupId) {
        return boards.list(orEmpty(studentId), groupId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    BoardView create(@Valid @RequestBody CreateRequest request) {
        return boards.create(request.kind(), request.title(), request.url(), orEmpty(request.studentIds()),
                orEmpty(request.groupIds()));
    }

    @PutMapping("/{id}")
    BoardView change(@PathVariable UUID id, @Valid @RequestBody ChangeRequest request) {
        return boards.change(id, request.title(), request.url(), orEmpty(request.studentIds()),
                orEmpty(request.groupIds()), request.version());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(@PathVariable UUID id) {
        boards.remove(id);
    }

    @GetMapping("/{id}/backups")
    List<BackupView> backups(@PathVariable UUID id) {
        return backups.list(id);
    }

    @PostMapping("/{id}/backups")
    @ResponseStatus(HttpStatus.CREATED)
    BackupView backUp(@PathVariable UUID id) {
        return backups.create(id);
    }

    /** @return the copy of the scene made before the restore */
    @PostMapping("/{id}/backups/{backupId}/restore")
    BackupView restore(CurrentUser user, @PathVariable UUID id, @PathVariable UUID backupId) {
        return backups.restore(user, id, backupId);
    }

    @DeleteMapping("/{id}/backups/{backupId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteBackup(@PathVariable UUID id, @PathVariable UUID backupId) {
        backups.delete(id, backupId);
    }

    private static List<UUID> orEmpty(@Nullable List<UUID> ids) {
        return ids == null ? List.of() : ids;
    }
}
