package ru.teacherbox.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.Guardians;
import ru.teacherbox.identity.api.StudentActivated;
import ru.teacherbox.identity.api.StudentSummary;
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
import ru.teacherbox.shared.security.Role;

/** Accepting invitation links of students and guardians: first sign-up or password reset. */
@Service
public class InviteService {

    /**
     * What the invitation page shows before the student or the guardian submits the form.
     *
     * @param role     {@code STUDENT} or {@code GUARDIAN}: the page greets a parent with their children's names
     * @param children first names of a guardian's current children in the order they were linked; empty for a
     *                 student
     */
    public record InviteInfo(InvitePurpose purpose, Role role, String displayName, @Nullable String login,
            Instant expiresAt, List<String> children) {
    }

    private final InviteRepository invites;
    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final SessionIssuer sessionIssuer;
    private final PasswordEncoder passwordEncoder;
    private final Guardians guardians;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    InviteService(InviteRepository invites, UserRepository users, RefreshTokenRepository refreshTokens,
            SessionIssuer sessionIssuer, PasswordEncoder passwordEncoder, Guardians guardians,
            ApplicationEventPublisher events, Clock clock) {
        this.invites = invites;
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.sessionIssuer = sessionIssuer;
        this.passwordEncoder = passwordEncoder;
        this.guardians = guardians;
        this.events = events;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public InviteInfo describe(String rawToken) {
        Invite invite = loadUsable(rawToken, clock.instant());
        User user = loadUser(invite);
        List<String> children = user.isGuardian() ? currentChildren(user).stream()
                .map(child -> firstName(child.displayName())).toList() : List.of();
        return new InviteInfo(invite.purpose(), user.role(), user.profile().displayName(), user.login(),
                invite.expiresAt(), children);
    }

    /**
     * Accepts the invitation and signs the student or the guardian in.
     *
     * @param login required for {@link InvitePurpose#ACTIVATION}, ignored for a password reset
     */
    @Transactional
    public Session accept(String rawToken, @Nullable String login, String password) {
        Instant now = clock.instant();
        Invite invite = loadUsable(rawToken, now);
        User user = loadUser(invite);
        if (user.isGuardian()) {
            currentChildren(user);
        }
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
                if (!user.isGuardian()) {
                    events.publishEvent(new StudentActivated(user.id(), user.profile().displayName(), now));
                }
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

    /**
     * @throws BusinessRuleException {@code identity.guardian-no-students} when every child of the guardian is
     *                               deactivated
     */
    private List<StudentSummary> currentChildren(User guardian) {
        List<StudentSummary> children = guardians.childrenOf(guardian.id());
        if (children.isEmpty()) {
            throw new BusinessRuleException("identity.guardian-no-students",
                    "The parent has no students in the portal. Ask the teacher");
        }
        return children;
    }

    /** The first word of the name the teacher gave: «Петя» of «Петя Иванов». */
    static String firstName(String displayName) {
        return displayName.strip().split("\\s+", 2)[0];
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
