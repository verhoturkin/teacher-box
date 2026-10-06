package ru.teacherbox.identity.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.time.Clock;
import org.jspecify.annotations.Nullable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.identity.application.AccountService;
import ru.teacherbox.identity.application.Session;
import ru.teacherbox.identity.domain.Avatar;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.security.CurrentUser;

/** Account of the signed-in user (teacher or student). */
@RestController
@RequestMapping("/api/me")
class AccountController {

    record ChangePasswordRequest(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotBlank @Size(max = 128) String newPassword) {
    }

    /** @param displayName blank: the name the teacher gave */
    record RenameSelfRequest(@Nullable @Size(max = 100) String displayName) {
    }

    private final AccountService accounts;
    private final Clock clock;

    AccountController(AccountService accounts, Clock clock) {
        this.accounts = accounts;
        this.clock = clock;
    }

    @GetMapping
    AccountService.AccountView me(CurrentUser user) {
        return accounts.get(user.id());
    }

    /** Ends all sessions and returns a new one for this browser (new access token and refresh cookie). */
    @PostMapping("/password")
    ResponseEntity<AuthResponse> changePassword(CurrentUser user, @Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest http) {
        Session session = accounts.changePassword(user.id(), request.currentPassword(), request.newPassword());
        return SessionResponses.ok(session, clock.instant(), http);
    }

    /** A student's own name in the cabinet (the teacher renames themselves at {@code /api/teacher/profile}). */
    @PutMapping("/profile")
    AccountService.AccountView renameSelf(CurrentUser user, @Valid @RequestBody RenameSelfRequest request) {
        return accounts.renameSelf(user.id(), request.displayName());
    }

    @PutMapping(path = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    AccountService.AccountView changeAvatar(CurrentUser user, @RequestParam("file") MultipartFile file)
            throws IOException {
        if (file.getSize() > Avatar.MAX_SIZE) {
            throw new BusinessRuleException("avatar.too-large", "The photo must be at most 1 MB");
        }
        return accounts.changeAvatar(user.id(), file.getBytes());
    }

    @DeleteMapping("/avatar")
    AccountService.AccountView removeAvatar(CurrentUser user) {
        return accounts.removeAvatar(user.id());
    }
}
