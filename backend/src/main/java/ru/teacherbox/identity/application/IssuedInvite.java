package ru.teacherbox.identity.application;

import java.time.Instant;
import ru.teacherbox.identity.domain.InvitePurpose;

/**
 * Freshly issued invitation. The raw {@code token} is returned only once; the frontend builds the
 * link {@code <origin>/invite/<token>} for the teacher to send.
 */
public record IssuedInvite(String token, InvitePurpose purpose, Instant expiresAt) {
}
