package ru.teacherbox.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.domain.RefreshToken;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.RefreshTokenRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.security.JwtClaims;

/** Issues access tokens (JWT) together with a stored refresh token. */
@Component
class SessionIssuer {

    static final String ISSUER = "teacher-box";

    /** A session plus the id of its stored refresh token (used to link rotated tokens). */
    record IssuedSession(Session session, UUID refreshTokenId) {
    }

    private final JwtEncoder jwtEncoder;
    private final RefreshTokenRepository refreshTokens;
    private final IdentityProperties properties;
    private final Clock clock;

    SessionIssuer(JwtEncoder jwtEncoder, RefreshTokenRepository refreshTokens, IdentityProperties properties,
            Clock clock) {
        this.jwtEncoder = jwtEncoder;
        this.refreshTokens = refreshTokens;
        this.properties = properties;
        this.clock = clock;
    }

    /** Sign-in: a new refresh token family. */
    Session startSession(User user) {
        return issue(user, Ids.newId()).session();
    }

    /** Refresh: the next token of an existing family. */
    IssuedSession continueSession(User user, UUID familyId) {
        return issue(user, familyId);
    }

    private IssuedSession issue(User user, UUID familyId) {
        Instant now = clock.instant();
        Instant accessExpiresAt = now.plus(properties.accessTokenTtl());
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(user.id().toString())
                .issuedAt(now)
                .expiresAt(accessExpiresAt)
                .claim(JwtClaims.ROLE, user.role().name())
                .claim(JwtClaims.NAME, user.profile().displayName())
                .build();
        String accessToken = jwtEncoder
                .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();

        String rawRefreshToken = SecureTokens.generate();
        RefreshToken refreshToken = RefreshToken.issue(Ids.newId(), user.id(), familyId,
                SecureTokens.hash(rawRefreshToken), now, properties.refreshTokenTtl());
        refreshTokens.insert(refreshToken);

        Session session = new Session(accessToken, accessExpiresAt, rawRefreshToken, refreshToken.expiresAt(),
                new Session.SessionUser(user.id(), user.role(), user.profile().displayName()));
        return new IssuedSession(session, refreshToken.id());
    }
}
