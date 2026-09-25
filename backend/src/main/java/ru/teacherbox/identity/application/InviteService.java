package ru.teacherbox.identity.application;

import java.time.Clock;
import java.time.Instant;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.StudentActivated;
import ru.teacherbox.identity.domain.Invite;
import ru.teacherbox.identity.domain.InvitePurpose;
import ru.teacherbox.identity.domain.Logins;
import ru.teacherbox.identity.domain.PasswordPolicy;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.InviteRepository;
import ru.teacherbox.identity.persistence.RefreshTokenRepository;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;

/** Accepting invitation links: first sign-up or password reset. */
@Service
public class InviteService {

    /** What the invitation page shows before the student submits the form. */
    public record InviteInfo(InvitePurpose purpose, String displayName, @Nullable String login, Instant expiresAt) {
    }

    private final InviteRepository invites;
    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final SessionIssuer sessionIssuer;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public InviteService(InviteRepository invites, UserRepository users, RefreshTokenRepository refreshTokens,
            SessionIssuer sessionIssuer, PasswordEncoder passwordEncoder, ApplicationEventPublisher events,
            Clock clock) {
        this.invites = invites;
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.sessionIssuer = sessionIssuer;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public InviteInfo describe(String rawToken) {
        Invite invite = loadUsable(rawToken, clock.instant());
        User user = loadUser(invite);
        return new InviteInfo(invite.purpose(), user.profile().displayName(), user.login(), invite.expiresAt());
    }

    /**
     * Accepts the invitation and signs the student in.
     *
     * @param login required for {@link InvitePurpose#ACTIVATION}, ignored for a password reset
     */
    @Transactional
    public Session accept(String rawToken, @Nullable String login, String password) {
        Instant now = clock.instant();
        Invite invite = loadUsable(rawToken, now);
        User user = loadUser(invite);
        PasswordPolicy.validate(password);
        String passwordHash = passwordEncoder.encode(password);

        switch (invite.purpose()) {
            case ACTIVATION -> {
                if (login == null || login.isBlank()) {
                    throw new BusinessRuleException("login.required", "Login is required");
                }
                String normalized = Logins.normalize(login);
                if (users.existsByLogin(normalized)) {
                    throw new ConflictException("login.taken", "This login is already taken");
                }
                user.activate(normalized, passwordHash, now);
                users.update(user);
                events.publishEvent(new StudentActivated(user.id(), user.profile().displayName(), now));
            }
            case PASSWORD_RESET -> {
                user.changePassword(passwordHash, now);
                users.update(user);
                refreshTokens.revokeAllOfUser(user.id(), now);
            }
        }
        invite.markUsed(now);
        invites.update(invite);
        return sessionIssuer.startSession(user);
    }

    private Invite loadUsable(String rawToken, Instant now) {
        return invites.findByTokenHash(SecureTokens.hash(rawToken))
                .filter(invite -> invite.isUsable(now))
                .orElseThrow(() -> new NotFoundException("invite.invalid",
                        "The invitation link is invalid or expired. Ask the teacher for a new one"));
    }

    private User loadUser(Invite invite) {
        return users.findById(invite.userId())
                .orElseThrow(() -> new IllegalStateException("Invite " + invite.id() + " has no user"));
    }
}
