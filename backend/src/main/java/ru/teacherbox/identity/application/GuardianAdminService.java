package ru.teacherbox.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.GuardianLinked;
import ru.teacherbox.identity.api.GuardianRegistered;
import ru.teacherbox.identity.api.GuardianUnlinked;
import ru.teacherbox.identity.domain.AccountStatus;
import ru.teacherbox.identity.domain.InvitePurpose;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.GuardianshipRepository;
import ru.teacherbox.identity.persistence.InviteRepository;
import ru.teacherbox.identity.persistence.RefreshTokenRepository;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;

/**
 * Guardians (parents) of a student, managed by the teacher from the student's card (ADR-0069): a new guardian
 * gets an invitation, an existing one (a sibling's parent) is linked without it; a student has at most
 * {@value #MAX_PER_STUDENT} guardians. Removing the last link deactivates the guardian.
 */
@Service
public class GuardianAdminService {

    /** At most this many guardians per student. */
    public static final int MAX_PER_STUDENT = 2;

    /** A new guardian together with the invitation to send. */
    public record CreatedGuardian(GuardianView guardian, IssuedInvite invite) {
    }

    private final UserRepository users;
    private final GuardianshipRepository guardianships;
    private final InviteRepository invites;
    private final RefreshTokenRepository refreshTokens;
    private final InviteIssuer inviteIssuer;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    GuardianAdminService(UserRepository users, GuardianshipRepository guardianships, InviteRepository invites,
            RefreshTokenRepository refreshTokens, InviteIssuer inviteIssuer, ApplicationEventPublisher events,
            Clock clock) {
        this.users = users;
        this.guardianships = guardianships;
        this.invites = invites;
        this.refreshTokens = refreshTokens;
        this.inviteIssuer = inviteIssuer;
        this.events = events;
        this.clock = clock;
    }

    /** The student's guardians in the order they were linked. */
    @Transactional(readOnly = true)
    public List<GuardianView> list(UUID studentId) {
        loadStudent(studentId);
        List<UUID> ids = guardianships.guardiansOf(studentId);
        return views(users.findGuardiansByIds(ids), ids);
    }

    /** Every guardian of the instance, by name: the teacher picks one to link to a sibling. */
    @Transactional(readOnly = true)
    public List<GuardianView> all() {
        List<User> all = users.findGuardians();
        return views(all, all.stream().map(User::id).toList());
    }

    /**
     * Adds a new guardian to the student and issues the activation link.
     *
     * @throws BusinessRuleException {@code guardian.limit} when the student has two guardians already,
     *                               {@code account.deactivated} when the student is deactivated
     */
    @Transactional
    public CreatedGuardian create(UUID studentId, Profile profile) {
        Instant now = clock.instant();
        requireRoom(loadCurrentStudent(studentId));
        User guardian = User.newGuardian(Ids.newId(), profile, now);
        users.insert(guardian);
        guardianships.insert(guardian.id(), studentId, now);
        IssuedInvite invite = inviteIssuer.issue(guardian, InvitePurpose.ACTIVATION, now);
        events.publishEvent(new GuardianRegistered(guardian.id(), profile.displayName(), now));
        events.publishEvent(new GuardianLinked(guardian.id(), studentId, now));
        return new CreatedGuardian(view(guardian, now), invite);
    }

    /**
     * Makes an existing guardian (a parent of another student) a guardian of this student too, without an
     * invitation; a guardian deactivated after losing their last child is reactivated.
     *
     * @throws ConflictException {@code guardian.already-linked} when the guardian is linked already
     */
    @Transactional
    public GuardianView link(UUID studentId, UUID guardianId) {
        Instant now = clock.instant();
        User student = loadCurrentStudent(studentId);
        User guardian = loadGuardian(guardianId);
        if (guardianships.exists(guardianId, studentId)) {
            throw new ConflictException("guardian.already-linked", "The parent is already linked to the student");
        }
        requireRoom(student);
        if (guardian.status() == AccountStatus.DEACTIVATED) {
            guardian.reactivate(now);
            users.update(guardian);
        }
        guardianships.insert(guardianId, studentId, now);
        events.publishEvent(new GuardianLinked(guardianId, studentId, now));
        return view(guardian, now);
    }

    /**
     * Issues a new link to the student's guardian: activation until they sign up, password reset afterwards.
     * Previous links stop working.
     */
    @Transactional
    public IssuedInvite reissueInvite(UUID studentId, UUID guardianId) {
        loadStudent(studentId);
        User guardian = loadLinked(studentId, guardianId);
        return inviteIssuer.issue(guardian, InviteIssuer.purposeFor(guardian), clock.instant());
    }

    /**
     * Removes the guardian from the student. When it was the guardian's last child, the guardian is deactivated:
     * unused invitations and sessions are revoked.
     */
    @Transactional
    public void unlink(UUID studentId, UUID guardianId) {
        Instant now = clock.instant();
        loadStudent(studentId);
        User guardian = loadLinked(studentId, guardianId);
        guardianships.delete(guardianId, studentId);
        boolean last = guardianships.studentsOf(guardianId).isEmpty();
        if (last) {
            guardian.deactivate(now);
            users.update(guardian);
            invites.revokeUnusedByUser(guardianId, now);
            refreshTokens.revokeAllOfUser(guardianId, now);
        }
        events.publishEvent(new GuardianUnlinked(guardianId, studentId, last, now));
    }

    private void requireRoom(User student) {
        if (guardianships.guardiansOf(student.id()).size() >= MAX_PER_STUDENT) {
            throw new BusinessRuleException("guardian.limit", "A student has at most two parents");
        }
    }

    private User loadStudent(UUID studentId) {
        return users.findStudent(studentId)
                .orElseThrow(() -> new NotFoundException("student.not-found", "Student not found"));
    }

    private User loadCurrentStudent(UUID studentId) {
        User student = loadStudent(studentId);
        if (student.status() == AccountStatus.DEACTIVATED) {
            throw new BusinessRuleException("account.deactivated", "Reactivate the student before adding a parent");
        }
        return student;
    }

    private User loadGuardian(UUID guardianId) {
        return users.findGuardian(guardianId)
                .orElseThrow(() -> new NotFoundException("guardian.not-found", "Parent not found"));
    }

    private User loadLinked(UUID studentId, UUID guardianId) {
        if (!guardianships.exists(guardianId, studentId)) {
            throw new NotFoundException("guardian.not-found", "Parent not found");
        }
        return loadGuardian(guardianId);
    }

    private GuardianView view(User guardian, Instant now) {
        return GuardianView.of(guardian, invites.findUsableByUser(guardian.id(), now).orElse(null),
                guardianships.studentsOf(guardian.id()));
    }

    /** Views of the guardians in the order of {@code order}. */
    private List<GuardianView> views(List<User> guardians, List<UUID> order) {
        Instant now = clock.instant();
        Map<UUID, List<UUID>> children = guardianships.studentsOf(guardians.stream().map(User::id).toList());
        return order.stream()
                .flatMap(id -> guardians.stream().filter(guardian -> guardian.id().equals(id)))
                .map(guardian -> GuardianView.of(guardian, invites.findUsableByUser(guardian.id(), now).orElse(null),
                        children.getOrDefault(guardian.id(), List.of())))
                .toList();
    }
}
