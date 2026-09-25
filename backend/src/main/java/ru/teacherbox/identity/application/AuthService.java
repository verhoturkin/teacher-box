package ru.teacherbox.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.domain.AccountStatus;
import ru.teacherbox.identity.domain.RefreshToken;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.RefreshTokenRepository;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.error.UnauthorizedException;

/** Sign-in, token refresh and sign-out (ADR-0003). */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final SessionIssuer sessionIssuer;
    private final PasswordEncoder passwordEncoder;
    private final IdentityProperties properties;
    private final Clock clock;
    /** Hash compared against when the login is unknown, so that response time does not reveal it. */
    private final String dummyHash;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, SessionIssuer sessionIssuer,
            PasswordEncoder passwordEncoder, IdentityProperties properties, Clock clock) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.sessionIssuer = sessionIssuer;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
        this.clock = clock;
        this.dummyHash = passwordEncoder.encode("dummy-password-for-timing");
    }

    /**
     * Signs a user in.
     *
     * @throws UnauthorizedException {@code auth.invalid-credentials}, {@code auth.locked} or
     *                               {@code auth.deactivated}
     */
    @Transactional(noRollbackFor = UnauthorizedException.class)
    public Session login(String login, String password) {
        Instant now = clock.instant();
        Optional<User> found = users.findByLogin(login.trim().toLowerCase(Locale.ROOT));
        if (found.isEmpty()) {
            passwordEncoder.matches(password, dummyHash);
            throw invalidCredentials();
        }
        User user = found.get();
        if (user.isLocked(now)) {
            throw new UnauthorizedException("auth.locked", "Too many failed attempts. Try again later");
        }
        String hash = user.passwordHash();
        if (hash == null || !passwordEncoder.matches(password, hash)) {
            user.recordFailedLogin(properties.loginPolicy(), now);
            users.update(user);
            throw invalidCredentials();
        }
        if (user.status() == AccountStatus.DEACTIVATED) {
            throw new UnauthorizedException("auth.deactivated", "Account is deactivated");
        }
        user.recordSuccessfulLogin(now);
        users.update(user);
        log.info("User {} signed in", user.id());
        return sessionIssuer.startSession(user);
    }

    /**
     * Exchanges a refresh token for new tokens (rotation).
     *
     * @throws UnauthorizedException {@code auth.refresh-invalid} when the token is unknown, expired,
     *                               reused or the account is no longer active
     */
    @Transactional(noRollbackFor = UnauthorizedException.class)
    public Session refresh(@Nullable String rawRefreshToken) {
        Instant now = clock.instant();
        RefreshToken token = findRefreshToken(rawRefreshToken).orElseThrow(AuthService::invalidRefresh);
        if (token.isExpired(now)) {
            throw invalidRefresh();
        }
        if (token.isRevoked() && !token.wasJustRotated(properties.refreshReuseGrace(), now)) {
            if (token.replacedBy() != null) {
                log.warn("Reuse of rotated refresh token detected, revoking session family {}", token.familyId());
                refreshTokens.revokeFamily(token.familyId(), now);
            }
            throw invalidRefresh();
        }
        User user = users.findById(token.userId())
                .filter(u -> u.status() == AccountStatus.ACTIVE)
                .orElseThrow(AuthService::invalidRefresh);
        SessionIssuer.IssuedSession issued = sessionIssuer.continueSession(user, token.familyId());
        if (!token.isRevoked()) {
            token.rotate(issued.refreshTokenId(), now);
            refreshTokens.update(token);
        }
        return issued.session();
    }

    /** Ends the session of the given refresh token (all tokens of its family). Unknown tokens are ignored. */
    @Transactional
    public void logout(@Nullable String rawRefreshToken) {
        findRefreshToken(rawRefreshToken)
                .ifPresent(token -> refreshTokens.revokeFamily(token.familyId(), clock.instant()));
    }

    Optional<RefreshToken> findRefreshToken(@Nullable String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return Optional.empty();
        }
        return refreshTokens.findByTokenHash(SecureTokens.hash(rawRefreshToken));
    }

    private static UnauthorizedException invalidCredentials() {
        return new UnauthorizedException("auth.invalid-credentials", "Invalid login or password");
    }

    private static UnauthorizedException invalidRefresh() {
        return new UnauthorizedException("auth.refresh-invalid", "Session expired. Sign in again");
    }
}
