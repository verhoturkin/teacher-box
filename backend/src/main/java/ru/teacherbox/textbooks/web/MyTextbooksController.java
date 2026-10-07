package ru.teacherbox.textbooks.web;

import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.textbooks.application.TextbookService;
import ru.teacherbox.textbooks.application.TextbookService.MyTextbookView;

/** A student's textbooks: their own and those of their groups. */
@RestController
class MyTextbooksController {

    private final TextbookService textbooks;

    MyTextbooksController(TextbookService textbooks) {
        this.textbooks = textbooks;
    }

    @GetMapping("/api/me/textbooks")
    List<MyTextbookView> textbooks(CurrentUser user) {
        return textbooks.studentTextbooks(requireStudent(user).id());
    }

    @GetMapping("/api/me/textbooks/{id}/file")
    ResponseEntity<Resource> download(CurrentUser user, @PathVariable UUID id) {
        return TextbookResponses.download(textbooks.download(requireStudent(user), id));
    }

    private static CurrentUser requireStudent(CurrentUser user) {
        if (user.role() != Role.STUDENT) {
            throw new ForbiddenException("textbooks.students-only", "Only students have their textbooks here");
        }
        return user;
    }
}
