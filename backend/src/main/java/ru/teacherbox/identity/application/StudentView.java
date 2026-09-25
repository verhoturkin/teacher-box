package ru.teacherbox.identity.application;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.identity.domain.AccountStatus;
import ru.teacherbox.identity.domain.Invite;
import ru.teacherbox.identity.domain.InvitePurpose;
import ru.teacherbox.identity.domain.User;

/** Student card as seen by the teacher. */
public record StudentView(
        UUID id,
        String displayName,
        @Nullable String email,
        @Nullable String phone,
        @Nullable String note,
        AccountStatus status,
        @Nullable String login,
        Instant createdAt,
        long version,
        @Nullable PendingInvite pendingInvite) {

    /** Invitation that has been issued and can still be used. */
    public record PendingInvite(InvitePurpose purpose, Instant expiresAt) {
    }

    static StudentView of(User user, @Nullable Invite pendingInvite) {
        return new StudentView(user.id(), user.profile().displayName(), user.profile().email(),
                user.profile().phone(), user.profile().note(), user.status(), user.login(), user.createdAt(),
                user.version(),
                pendingInvite == null ? null : new PendingInvite(pendingInvite.purpose(), pendingInvite.expiresAt()));
    }
}
