package ru.teacherbox.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.StudentDeactivated;
import ru.teacherbox.identity.api.StudentReactivated;
import ru.teacherbox.identity.api.StudentRegistered;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.identity.domain.AccountStatus;
import ru.teacherbox.identity.domain.Invite;
import ru.teacherbox.identity.domain.InvitePurpose;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.InviteRepository;
import ru.teacherbox.identity.persistence.RefreshTokenRepository;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/** Student management by the teacher. */
@Service
public class StudentAdminService {

    /** A new student together with the invitation to send. */
    public record CreatedStudent(StudentView student, IssuedInvite invite) {
    }

    private final UserRepository users;
    private final InviteRepository invites;
    private final RefreshTokenRepository refreshTokens;
    private final ApplicationEventPublisher events;
    private final IdentityProperties properties;
    private final Clock clock;

    public StudentAdminService(UserRepository users, InviteRepository invites, RefreshTokenRepository refreshTokens,
            ApplicationEventPublisher events, IdentityProperties properties, Clock clock) {
        this.users = users;
        this.invites = invites;
        this.refreshTokens = refreshTokens;
        this.events = events;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    public CreatedStudent create(Profile profile) {
        Instant now = clock.instant();
        User student = User.newStudent(Ids.newId(), profile, now);
        users.insert(student);
        IssuedInvite invite = issueInvite(student, InvitePurpose.ACTIVATION, now);
        events.publishEvent(new StudentRegistered(student.id(), profile.displayName(), now));
        return new CreatedStudent(view(student, now), invite);
    }

    @Transactional(readOnly = true)
    public List<StudentView> list() {
        Instant now = clock.instant();
        return users.findStudents().stream().map(student -> view(student, now)).toList();
    }

    @Transactional(readOnly = true)
    public StudentView get(UUID studentId) {
        return view(load(studentId), clock.instant());
    }

    /**
     * @throws OptimisticLockingFailureException if the student was changed after {@code expectedVersion}
     */
    @Transactional
    public StudentView update(UUID studentId, Profile profile, long expectedVersion) {
        User student = load(studentId);
        if (student.version() != expectedVersion) {
            throw new OptimisticLockingFailureException("Student " + studentId + " was modified");
        }
        Instant now = clock.instant();
        student.updateProfile(profile, now);
        users.update(student);
        return view(student, now);
    }

    /**
     * Issues a new invitation link: activation for a student who has not signed up yet, password reset
     * for an active student. Previous links stop working.
     */
    @Transactional
    public IssuedInvite reissueInvite(UUID studentId) {
        User student = load(studentId);
        InvitePurpose purpose = switch (student.status()) {
            case INVITED -> InvitePurpose.ACTIVATION;
            case ACTIVE -> InvitePurpose.PASSWORD_RESET;
            case DEACTIVATED -> throw new BusinessRuleException("account.deactivated",
                    "Reactivate the student before issuing an invitation");
        };
        return issueInvite(student, purpose, clock.instant());
    }

    @Transactional
    public StudentView deactivate(UUID studentId) {
        Instant now = clock.instant();
        User student = load(studentId);
        student.deactivate(now);
        users.update(student);
        invites.revokeUnusedByUser(studentId, now);
        refreshTokens.revokeAllOfUser(studentId, now);
        events.publishEvent(new StudentDeactivated(studentId, now));
        return view(student, now);
    }

    @Transactional
    public StudentView reactivate(UUID studentId) {
        Instant now = clock.instant();
        User student = load(studentId);
        student.reactivate(now);
        users.update(student);
        StudentStatus status = student.status() == AccountStatus.ACTIVE ? StudentStatus.ACTIVE : StudentStatus.INVITED;
        events.publishEvent(new StudentReactivated(studentId, status, now));
        return view(student, now);
    }

    private IssuedInvite issueInvite(User student, InvitePurpose purpose, Instant now) {
        invites.revokeUnusedByUser(student.id(), now);
        String token = SecureTokens.generate();
        Invite invite = Invite.issue(Ids.newId(), student.id(), purpose, SecureTokens.hash(token), now,
                properties.inviteTtl());
        invites.insert(invite);
        return new IssuedInvite(token, purpose, invite.expiresAt());
    }

    private User load(UUID studentId) {
        return users.findStudent(studentId)
                .orElseThrow(() -> new NotFoundException("student.not-found", "Student not found"));
    }

    private StudentView view(User student, Instant now) {
        return StudentView.of(student, invites.findUsableByUser(student.id(), now).orElse(null));
    }
}
