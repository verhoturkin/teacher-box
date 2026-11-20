package ru.teacherbox.identity.application;

import java.time.Instant;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.domain.Invite;
import ru.teacherbox.identity.domain.InvitePurpose;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.InviteRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.settings.LiveProperties;

/** Issues the invitation link of a student or a guardian; previous links of the user stop working. */
@Component
class InviteIssuer {

    private final InviteRepository invites;
    /** Read on every use: the administrator changes the lifetime without a restart (ADR-0056). */
    private final LiveProperties<IdentityProperties> properties;

    InviteIssuer(InviteRepository invites, Environment environment) {
        this.invites = invites;
        this.properties = new LiveProperties<>(environment, IdentityProperties.class);
    }

    IssuedInvite issue(User user, InvitePurpose purpose, Instant now) {
        invites.revokeUnusedByUser(user.id(), now);
        String token = SecureTokens.generate();
        Invite invite = Invite.issue(Ids.newId(), user.id(), purpose, SecureTokens.hash(token), now,
                properties.get().inviteTtl());
        invites.insert(invite);
        return new IssuedInvite(token, purpose, invite.expiresAt());
    }

    /** Activation for a user who has not signed up yet, password reset for an active one. */
    static InvitePurpose purposeFor(User user) {
        return switch (user.status()) {
            case INVITED -> InvitePurpose.ACTIVATION;
            case ACTIVE -> InvitePurpose.PASSWORD_RESET;
            case DEACTIVATED -> throw new BusinessRuleException("account.deactivated",
                    "Reactivate the account before issuing an invitation");
        };
    }
}
