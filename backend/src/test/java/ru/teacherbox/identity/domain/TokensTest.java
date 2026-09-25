package ru.teacherbox.identity.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Invitations and refresh tokens. */
class TokensTest {

    private static final Instant NOW = Instant.parse("2026-09-01T10:00:00Z");

    @Test
    void inviteIsUsableUntilExpiredUsedOrRevoked() {
        Invite invite = Invite.issue(UUID.randomUUID(), UUID.randomUUID(), InvitePurpose.ACTIVATION, "hash", NOW,
                Duration.ofDays(7));

        assertThat(invite.isUsable(NOW)).isTrue();
        assertThat(invite.isUsable(NOW.plus(Duration.ofDays(7)))).isFalse();
        assertThat(invite.expiresAt()).isEqualTo(NOW.plus(Duration.ofDays(7)));

        invite.markUsed(NOW);
        assertThat(invite.isUsable(NOW)).isFalse();
        assertThat(invite.usedAt()).isEqualTo(NOW);
    }

    @Test
    void revokingAffectsOnlyUnusedInvites() {
        Invite unused = Invite.issue(UUID.randomUUID(), UUID.randomUUID(), InvitePurpose.PASSWORD_RESET, "h", NOW,
                Duration.ofDays(1));
        unused.revoke(NOW);
        assertThat(unused.isUsable(NOW)).isFalse();
        assertThat(unused.revokedAt()).isEqualTo(NOW);

        Invite used = Invite.restore(UUID.randomUUID(), UUID.randomUUID(), InvitePurpose.ACTIVATION, "h2", NOW,
                NOW.plusSeconds(60), NOW, null);
        used.revoke(NOW.plusSeconds(1));
        assertThat(used.revokedAt()).isNull();
        assertThat(used.purpose()).isEqualTo(InvitePurpose.ACTIVATION);
        assertThat(used.tokenHash()).isEqualTo("h2");
        assertThat(used.createdAt()).isEqualTo(NOW);
    }

    @Test
    void refreshTokenRotation() {
        UUID familyId = UUID.randomUUID();
        RefreshToken token = RefreshToken.issue(UUID.randomUUID(), UUID.randomUUID(), familyId, "hash", NOW,
                Duration.ofDays(30));
        assertThat(token.isRevoked()).isFalse();
        assertThat(token.isExpired(NOW)).isFalse();
        assertThat(token.isExpired(NOW.plus(Duration.ofDays(30)))).isTrue();
        assertThat(token.wasJustRotated(Duration.ofSeconds(20), NOW)).isFalse();

        UUID replacement = UUID.randomUUID();
        token.rotate(replacement, NOW);

        assertThat(token.isRevoked()).isTrue();
        assertThat(token.replacedBy()).isEqualTo(replacement);
        assertThat(token.wasJustRotated(Duration.ofSeconds(20), NOW.plusSeconds(19))).isTrue();
        assertThat(token.wasJustRotated(Duration.ofSeconds(20), NOW.plusSeconds(20))).isFalse();
        assertThat(token.familyId()).isEqualTo(familyId);
    }

    @Test
    void revokedWithoutReplacementIsNotJustRotated() {
        RefreshToken token = RefreshToken.restore(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "h", NOW,
                NOW.plusSeconds(60), NOW, null);

        assertThat(token.wasJustRotated(Duration.ofMinutes(1), NOW)).isFalse();
        assertThat(token.createdAt()).isEqualTo(NOW);
        assertThat(token.tokenHash()).isEqualTo("h");
    }
}
