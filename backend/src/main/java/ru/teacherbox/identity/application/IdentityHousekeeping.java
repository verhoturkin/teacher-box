package ru.teacherbox.identity.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.persistence.InviteRepository;
import ru.teacherbox.identity.persistence.RefreshTokenRepository;

/** Nightly removal of expired refresh tokens and old invitations. */
@Component
public class IdentityHousekeeping {

    /** Expired tokens are kept a little longer so that a late reuse is still reported as such. */
    static final Duration TOKEN_RETENTION = Duration.ofDays(1);
    static final Duration INVITE_RETENTION = Duration.ofDays(30);
    private static final Logger log = LoggerFactory.getLogger(IdentityHousekeeping.class);

    private final RefreshTokenRepository refreshTokens;
    private final InviteRepository invites;
    private final Clock clock;

    public IdentityHousekeeping(RefreshTokenRepository refreshTokens, InviteRepository invites, Clock clock) {
        this.refreshTokens = refreshTokens;
        this.invites = invites;
        this.clock = clock;
    }

    @Scheduled(cron = "${teacherbox.identity.housekeeping-cron:0 15 4 * * *}",
            zone = "${teacherbox.timezone:Europe/Moscow}")
    void run() {
        purge(clock.instant());
    }

    /** @return number of removed records */
    @Transactional
    public int purge(Instant now) {
        int tokens = refreshTokens.deleteExpiredBefore(now.minus(TOKEN_RETENTION));
        int oldInvites = invites.deleteExpiredBefore(now.minus(INVITE_RETENTION));
        if (tokens + oldInvites > 0) {
            log.info("Housekeeping: removed {} refresh tokens and {} invitations", tokens, oldInvites);
        }
        return tokens + oldInvites;
    }
}
