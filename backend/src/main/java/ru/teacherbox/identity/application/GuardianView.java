package ru.teacherbox.identity.application;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.identity.application.StudentView.PendingInvite;
import ru.teacherbox.identity.domain.AccountStatus;
import ru.teacherbox.identity.domain.Invite;
import ru.teacherbox.identity.domain.User;

/**
 * A guardian (a parent) as the teacher sees them on a student's card (ADR-0069).
 *
 * @param studentIds the guardian's children in the order they were linked, deactivated ones included
 */
public record GuardianView(
        UUID id,
        String displayName,
        AccountStatus status,
        @Nullable String login,
        @Nullable PendingInvite pendingInvite,
        List<UUID> studentIds) {

    static GuardianView of(User guardian, @Nullable Invite pendingInvite, List<UUID> studentIds) {
        return new GuardianView(guardian.id(), guardian.profile().displayName(), guardian.status(), guardian.login(),
                pendingInvite == null ? null : new PendingInvite(pendingInvite.purpose(), pendingInvite.expiresAt()),
                List.copyOf(studentIds));
    }
}
