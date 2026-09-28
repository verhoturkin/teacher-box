package ru.teacherbox.identity.application;

import java.time.Instant;
import java.util.UUID;
import ru.teacherbox.shared.security.Role;

/**
 * Result of a successful sign-in or refresh.
 *
 * @param accessToken          signed JWT for the {@code Authorization} header
 * @param accessTokenExpiresAt expiry of the access token
 * @param refreshToken         raw refresh token for the HttpOnly cookie
 * @param refreshTokenExpiresAt expiry of the refresh token
 */
public record Session(
        String accessToken,
        Instant accessTokenExpiresAt,
        String refreshToken,
        Instant refreshTokenExpiresAt,
        SessionUser user) {

    /** @param passwordChangeRequired the password was generated on the first start and must be replaced */
    public record SessionUser(UUID id, Role role, String displayName, boolean passwordChangeRequired) {
    }
}
