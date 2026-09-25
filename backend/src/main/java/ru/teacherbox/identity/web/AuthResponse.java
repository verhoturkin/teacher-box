package ru.teacherbox.identity.web;

import java.time.Instant;
import ru.teacherbox.identity.application.Session;

/**
 * Body of sign-in/refresh responses. The refresh token is delivered only as an HttpOnly cookie.
 *
 * @param expiresIn access token lifetime in seconds
 */
record AuthResponse(String accessToken, long expiresIn, Session.SessionUser user) {

    static AuthResponse of(Session session, Instant now) {
        long expiresIn = Math.max(0, session.accessTokenExpiresAt().getEpochSecond() - now.getEpochSecond());
        return new AuthResponse(session.accessToken(), expiresIn, session.user());
    }
}
