package ru.teacherbox.identity.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.identity.application.AuthService;
import ru.teacherbox.identity.application.InviteService;
import ru.teacherbox.identity.application.Session;

/** Public authentication endpoints (see ADR-0003). */
@RestController
@RequestMapping("/api/auth")
class AuthController {

    record LoginRequest(@NotBlank @Size(max = 64) String login, @NotBlank @Size(max = 128) String password) {
    }

    record AcceptInviteRequest(@Size(max = 64) @Nullable String login, @NotBlank @Size(max = 128) String password) {
    }

    private final AuthService authService;
    private final InviteService inviteService;
    private final Clock clock;

    AuthController(AuthService authService, InviteService inviteService, Clock clock) {
        this.authService = authService;
        this.inviteService = inviteService;
        this.clock = clock;
    }

    @PostMapping("/login")
    ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return withSession(authService.login(request.login(), request.password()), http);
    }

    @PostMapping("/refresh")
    ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = RefreshCookies.NAME, required = false) @Nullable String refreshToken,
            HttpServletRequest http) {
        return withSession(authService.refresh(refreshToken), http);
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(
            @CookieValue(name = RefreshCookies.NAME, required = false) @Nullable String refreshToken,
            HttpServletRequest http) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, RefreshCookies.clear(http).toString())
                .build();
    }

    @GetMapping("/invites/{token}")
    InviteService.InviteInfo invite(@PathVariable String token) {
        return inviteService.describe(token);
    }

    @PostMapping("/invites/{token}/accept")
    ResponseEntity<AuthResponse> acceptInvite(@PathVariable String token,
            @Valid @RequestBody AcceptInviteRequest request, HttpServletRequest http) {
        return withSession(inviteService.accept(token, request.login(), request.password()), http);
    }

    private ResponseEntity<AuthResponse> withSession(Session session, HttpServletRequest http) {
        return SessionResponses.ok(session, clock.instant(), http);
    }
}
