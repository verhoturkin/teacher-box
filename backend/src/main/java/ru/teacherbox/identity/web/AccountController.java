package ru.teacherbox.identity.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.identity.application.AccountService;
import ru.teacherbox.identity.application.Session;
import ru.teacherbox.shared.security.CurrentUser;

/** Account of the signed-in user (teacher or student). */
@RestController
@RequestMapping("/api/me")
class AccountController {

    record ChangePasswordRequest(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotBlank @Size(max = 128) String newPassword) {
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
}
