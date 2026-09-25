package ru.teacherbox.shared.security;

/**
 * Contract of access token claims between the token issuer ({@code identity}) and the token consumer
 * ({@code platform}). The subject ({@code sub}) is the user id.
 */
public final class JwtClaims {

    /** {@link Role} name. */
    public static final String ROLE = "role";

    /** User display name. */
    public static final String NAME = "name";

    private JwtClaims() {
    }
}
