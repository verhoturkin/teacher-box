package ru.teacherbox.identity.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.security.Role;

/**
 * User account: the teacher (exactly one per instance) or a student.
 *
 * <p>Student lifecycle: {@code INVITED --activate--> ACTIVE --deactivate--> DEACTIVATED --reactivate-->
 * ACTIVE} (or back to {@code INVITED} if the invitation was never accepted).
 */
public final class User {

    /** Display name of the administrator account. */
    public static final String ADMINISTRATOR_NAME = "Администратор";

    private final UUID id;
    private final Role role;
    private @Nullable String login;
    private @Nullable String passwordHash;
    private Profile profile;
    private @Nullable String ownName;
    private @Nullable Avatar avatar;
    private AccountStatus status;
    private int failedLogins;
    private @Nullable Instant lockedUntil;
    private boolean passwordChangeRequired;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;

    private User(UUID id, Role role, @Nullable String login, @Nullable String passwordHash, Profile profile,
            @Nullable String ownName, @Nullable Avatar avatar, AccountStatus status, int failedLogins,
            @Nullable Instant lockedUntil, boolean passwordChangeRequired, Instant createdAt, Instant updatedAt,
            long version) {
        this.id = Objects.requireNonNull(id);
        this.role = Objects.requireNonNull(role);
        this.login = login;
        this.passwordHash = passwordHash;
        this.profile = Objects.requireNonNull(profile);
        this.ownName = ownName;
        this.avatar = avatar;
        this.status = Objects.requireNonNull(status);
        this.failedLogins = failedLogins;
        this.lockedUntil = lockedUntil;
        this.passwordChangeRequired = passwordChangeRequired;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
    }

    public static User newTeacher(UUID id, String login, String passwordHash, Profile profile, Instant now) {
        return new User(id, Role.TEACHER, Logins.normalize(login), passwordHash, profile, null, null,
                AccountStatus.ACTIVE, 0, null, false, now, now, 0);
    }

    /** The administrator account (ADR-0010). */
    public static User newAdministrator(UUID id, String login, String passwordHash, Instant now) {
        return new User(id, Role.ADMIN, Logins.normalize(login), passwordHash, Profile.named(ADMINISTRATOR_NAME),
                null, null, AccountStatus.ACTIVE, 0, null, false, now, now, 0);
    }

    public static User newStudent(UUID id, Profile profile, Instant now) {
        return new User(id, Role.STUDENT, null, null, profile, null, null, AccountStatus.INVITED, 0, null, false, now,
                now, 0);
    }

    /** Restores a persisted user. */
    public static User restore(UUID id, Role role, @Nullable String login, @Nullable String passwordHash,
            Profile profile, @Nullable String ownName, @Nullable Avatar avatar, AccountStatus status,
            int failedLogins, @Nullable Instant lockedUntil, boolean passwordChangeRequired, Instant createdAt,
            Instant updatedAt, long version) {
        return new User(id, role, login, passwordHash, profile, ownName, avatar, status, failedLogins, lockedUntil,
                passwordChangeRequired, createdAt, updatedAt, version);
    }

    /** Student accepted the invitation: sets credentials. */
    public void activate(String normalizedLogin, String newPasswordHash, Instant now) {
        requireStudent();
        if (status != AccountStatus.INVITED) {
            throw new BusinessRuleException("account.not-invited", "Account is not waiting for activation");
        }
        this.login = normalizedLogin;
        this.passwordHash = newPasswordHash;
        this.status = AccountStatus.ACTIVE;
        resetFailures();
        touch(now);
    }

    /** Sets a new password (password change or reset via invitation). */
    public void changePassword(String newPasswordHash, Instant now) {
        if (status != AccountStatus.ACTIVE) {
            throw new BusinessRuleException("account.not-active", "Account is not active");
        }
        this.passwordHash = newPasswordHash;
        this.passwordChangeRequired = false;
        resetFailures();
        touch(now);
    }

    /** The password was generated and written to the server log: it has to be replaced after signing in. */
    public void requirePasswordChange() {
        this.passwordChangeRequired = true;
    }

    public void updateProfile(Profile newProfile, Instant now) {
        this.profile = Objects.requireNonNull(newProfile);
        touch(now);
    }

    /**
     * The name the student wants to see in their cabinet; the teacher keeps seeing the name from the
     * profile.
     *
     * @param name blank: the name from the profile again
     */
    public void renameSelf(@Nullable String name, Instant now) {
        requireStudent();
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.length() > Profile.MAX_NAME_LENGTH) {
            throw new BusinessRuleException("profile.name-invalid", "Name must be 1-100 characters long");
        }
        this.ownName = trimmed.isEmpty() ? null : trimmed;
        touch(now);
    }

    /**
     * Replaces the student's photo.
     *
     * @param newAvatar {@code null}: no photo
     * @return the previous photo, whose file the caller deletes
     */
    public @Nullable Avatar changeAvatar(@Nullable Avatar newAvatar, Instant now) {
        requireStudent();
        Avatar previous = avatar;
        this.avatar = newAvatar;
        touch(now);
        return previous;
    }

    /** The name the user sees for themselves: the student's own name, if set, otherwise the profile's. */
    public String shownName() {
        return ownName == null ? profile.displayName() : ownName;
    }

    public void deactivate(Instant now) {
        requireStudent();
        if (status == AccountStatus.DEACTIVATED) {
            throw new BusinessRuleException("account.already-deactivated", "Account is already deactivated");
        }
        this.status = AccountStatus.DEACTIVATED;
        touch(now);
    }

    public void reactivate(Instant now) {
        requireStudent();
        if (status != AccountStatus.DEACTIVATED) {
            throw new BusinessRuleException("account.not-deactivated", "Account is not deactivated");
        }
        this.status = passwordHash == null ? AccountStatus.INVITED : AccountStatus.ACTIVE;
        resetFailures();
        touch(now);
    }

    /** Nobody can sign in as the administrator until it is enabled again with a new password. */
    public void disableAdministrator(Instant now) {
        requireAdministrator();
        this.status = AccountStatus.DEACTIVATED;
        this.passwordHash = null;
        resetFailures();
        touch(now);
    }

    public void enableAdministrator(String newPasswordHash, Instant now) {
        requireAdministrator();
        this.status = AccountStatus.ACTIVE;
        this.passwordHash = newPasswordHash;
        resetFailures();
        touch(now);
    }

    public boolean isLocked(Instant now) {
        return lockedUntil != null && now.isBefore(lockedUntil);
    }

    public void recordFailedLogin(LoginPolicy policy, Instant now) {
        failedLogins++;
        if (failedLogins >= policy.maxFailedAttempts()) {
            lockedUntil = now.plus(policy.lockDuration());
            failedLogins = 0;
        }
        touch(now);
    }

    public void recordSuccessfulLogin(Instant now) {
        if (failedLogins != 0 || lockedUntil != null) {
            resetFailures();
            touch(now);
        }
    }

    /** Called by the repository after the user has been saved with a new version. */
    public void markSaved(long newVersion) {
        this.version = newVersion;
    }

    public boolean isTeacher() {
        return role == Role.TEACHER;
    }

    private void requireAdministrator() {
        if (role != Role.ADMIN) {
            throw new BusinessRuleException("account.not-administrator", "Operation is only allowed for the administrator");
        }
    }

    private void requireStudent() {
        if (role != Role.STUDENT) {
            throw new BusinessRuleException("account.not-student", "Operation is only allowed for students");
        }
    }

    private void resetFailures() {
        failedLogins = 0;
        lockedUntil = null;
    }

    private void touch(Instant now) {
        updatedAt = now;
    }

    public UUID id() {
        return id;
    }

    public Role role() {
        return role;
    }

    public @Nullable String login() {
        return login;
    }

    public @Nullable String passwordHash() {
        return passwordHash;
    }

    public boolean passwordChangeRequired() {
        return passwordChangeRequired;
    }

    public Profile profile() {
        return profile;
    }

    public @Nullable String ownName() {
        return ownName;
    }

    public @Nullable Avatar avatar() {
        return avatar;
    }

    public AccountStatus status() {
        return status;
    }

    public int failedLogins() {
        return failedLogins;
    }

    public @Nullable Instant lockedUntil() {
        return lockedUntil;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public long version() {
        return version;
    }
}
