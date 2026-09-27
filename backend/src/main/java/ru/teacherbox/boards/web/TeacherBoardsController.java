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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.boards.application.BoardService;
import ru.teacherbox.boards.application.BoardService.BoardView;
import ru.teacherbox.boards.domain.Board;
import ru.teacherbox.boards.domain.BoardOwner;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Boards of students and groups; {@code /api/teacher/**} requires the teacher role. */
@RestController
@RequestMapping("/api/teacher/boards")
class TeacherBoardsController {

    /** A board of a student or of a group: exactly one of the ids. */
    record AddRequest(@Nullable UUID studentId, @Nullable UUID groupId,
            @Size(max = Board.MAX_TITLE) @Nullable String title, @NotBlank @Size(max = Board.MAX_URL) String url) {
    }

    record ChangeRequest(@NotBlank @Size(max = Board.MAX_TITLE) String title,
            @NotBlank @Size(max = Board.MAX_URL) String url, @NotNull Long version) {
    }

    private final BoardService boards;

    TeacherBoardsController(BoardService boards) {
        this.boards = boards;
    }

    @GetMapping
    List<BoardView> list() {
        return boards.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    BoardView add(@Valid @RequestBody AddRequest request) {
        if (request.studentId() != null && request.groupId() == null) {
            return boards.add(BoardOwner.STUDENT, request.studentId(), request.title(), request.url());
        }
        if (request.groupId() != null && request.studentId() == null) {
            return boards.add(BoardOwner.GROUP, request.groupId(), request.title(), request.url());
        }
        throw new BusinessRuleException("boards.owner-invalid", "Choose either a student or a group");
    }

    @PutMapping("/{id}")
    BoardView change(@PathVariable UUID id, @Valid @RequestBody ChangeRequest request) {
        return boards.change(id, request.title(), request.url(), request.version());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(@PathVariable UUID id) {
        boards.remove(id);
    }
}
