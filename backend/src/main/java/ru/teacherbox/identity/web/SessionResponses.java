package ru.teacherbox.identity.web;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import ru.teacherbox.identity.application.Session;

/** HTTP response for a new session: access token in the body, refresh token in the cookie. */
final class SessionResponses {

    private SessionResponses() {
    }

    static ResponseEntity<AuthResponse> ok(Session session, Instant now, HttpServletRequest request) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, RefreshCookies
                        .issue(session.refreshToken(), session.refreshTokenExpiresAt(), now, request).toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(AuthResponse.of(session, now));
    }
}
