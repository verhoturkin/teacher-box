package ru.teacherbox.boards.web;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.boards.application.BoardService;
import ru.teacherbox.boards.application.BoardService.MyBoardView;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.Role;

/** A student's boards: their own and those of their groups. */
@RestController
class MyBoardsController {

    private final BoardService boards;

    MyBoardsController(BoardService boards) {
        this.boards = boards;
    }

    @GetMapping("/api/me/boards")
    List<MyBoardView> boards(CurrentUser user) {
        if (user.role() != Role.STUDENT) {
            throw new ForbiddenException("boards.students-only", "Only students have boards");
        }
        return boards.studentBoards(user.id());
    }
}
