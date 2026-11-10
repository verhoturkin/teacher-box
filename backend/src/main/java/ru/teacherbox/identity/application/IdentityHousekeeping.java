package ru.teacherbox.identity.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.persistence.InviteRepository;
import ru.teacherbox.identity.persistence.RefreshTokenRepository;
import ru.teacherbox.shared.time.ZonedJob;

/** Nightly removal of expired refresh tokens and old invitations. */
@Component
public class IdentityHousekeeping implements ZonedJob {

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

    @Override
    public String name() {
        return "identity-housekeeping";
    }

    @Override
    public String cronProperty() {
        return "teacherbox.identity.housekeeping-cron";
    }

    @Override
    public String defaultCron() {
        return "0 15 4 * * *";
    }

    @Override
    public void run() {
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
