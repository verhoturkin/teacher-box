package ru.teacherbox.identity.web;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.Instant;
import org.springframework.http.ResponseCookie;

/**
 * Refresh token cookie: HttpOnly, SameSite=Strict, limited to {@code /api/auth}. The {@code Secure}
 * flag follows the request scheme (HTTPS behind a reverse proxy is detected via X-Forwarded-Proto).
 */
final class RefreshCookies {

    static final String NAME = "tb_refresh";
    static final String PATH = "/api/auth";

    private RefreshCookies() {
    }

    static ResponseCookie issue(String token, Instant expiresAt, Instant now, HttpServletRequest request) {
        return base(token, request).maxAge(Duration.between(now, expiresAt)).build();
    }

    static ResponseCookie clear(HttpServletRequest request) {
        return base("", request).maxAge(Duration.ZERO).build();
    }

    private static ResponseCookie.ResponseCookieBuilder base(String value, HttpServletRequest request) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(request.isSecure())
                .sameSite("Strict")
                .path(PATH);
    }
}
