package ru.teacherbox.identity.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.identity.application.AccountService;
import ru.teacherbox.shared.security.CurrentUser;

/** The teacher's name as the students see it (first setup, ADR-0014). */
@RestController
@RequestMapping("/api/teacher/profile")
class TeacherProfileController {

    record RenameRequest(@NotBlank @Size(max = 100) String displayName) {
    }

    private final AccountService accounts;

    TeacherProfileController(AccountService accounts) {
        this.accounts = accounts;
    }

    @PutMapping
    AccountService.AccountView rename(CurrentUser user, @Valid @RequestBody RenameRequest request) {
        return accounts.rename(user.id(), request.displayName());
    }
}
