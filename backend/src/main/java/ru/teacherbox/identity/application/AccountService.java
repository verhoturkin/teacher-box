package ru.teacherbox.identity.application;

import java.io.ByteArrayInputStream;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.domain.Avatar;
import ru.teacherbox.identity.domain.PasswordPolicy;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.RefreshTokenRepository;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.security.Role;

/** The signed-in user's own account. */
@Service
public class AccountService {

    /** Files of the module in the storage: the students' photos. */
    static final String NAMESPACE = "identity";
    /** Where the photos are served: the storage key is the secret part of the address. */
    public static final String AVATAR_PATH = "/api/public/avatars/";

    /**
     * Own account data. The teacher's private note about a student is never included.
     *
     * @param displayName            the name the user sees: a student's own name, if set
     * @param profileName            the name from the profile (for a student — the one the teacher gave)
     * @param avatar                 address of the student's photo; {@code null}: none
     * @param passwordChangeRequired the password was generated on the first start and must be replaced
     */
    public record AccountView(UUID id, Role role, String displayName, String profileName, @Nullable String avatar,
            @Nullable String login, @Nullable String email, @Nullable String phone,
            boolean passwordChangeRequired) {
    }

    /** A photo to send. */
    public record AvatarFile(Resource content, String contentType) {
    }

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final SessionIssuer sessionIssuer;
    private final PasswordEncoder passwordEncoder;
    private final FileStorage files;
    private final Clock clock;

    public AccountService(UserRepository users, RefreshTokenRepository refreshTokens, SessionIssuer sessionIssuer,
            PasswordEncoder passwordEncoder, FileStorage files, Clock clock) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.sessionIssuer = sessionIssuer;
        this.passwordEncoder = passwordEncoder;
        this.files = files;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AccountView get(UUID userId) {
        return view(load(userId));
    }

    /** The teacher's name as the students see it. */
    @Transactional
    public AccountView rename(UUID userId, String displayName) {
        User user = load(userId);
        Profile profile = user.profile();
        user.updateProfile(new Profile(displayName, profile.email(), profile.phone(), profile.note()), clock.instant());
        users.update(user);
        return view(user);
    }

    /**
     * The name a student sees in their cabinet; the teacher keeps the name from the profile.
     *
     * @param name blank: the teacher's name for the student again
     */
    @Transactional
    public AccountView renameSelf(UUID userId, @Nullable String name) {
        User user = load(userId);
        user.renameSelf(name, clock.instant());
        users.update(user);
        return view(user);
    }

    /**
     * Replaces the photo of a student or the teacher (0.9.2); the administrator has none.
     *
     * @throws BusinessRuleException {@code avatar.too-large} over 1 MB, {@code avatar.invalid} unless it is a
     *                               PNG, JPEG or WebP image
     */
    @Transactional
    public AccountView changeAvatar(UUID userId, byte[] content) {
        if (content.length > Avatar.MAX_SIZE) {
            throw new BusinessRuleException("avatar.too-large", "The photo must be at most 1 MB");
        }
        String contentType = Avatar.detectType(content).orElseThrow(() -> new BusinessRuleException(
                "avatar.invalid", "The photo must be a PNG, JPEG or WebP image"));
        User user = load(userId);
        if (user.role() == Role.ADMIN) {
            throw new BusinessRuleException("account.no-photo", "The administrator has no photo");
        }
        String key = files.store(NAMESPACE, new ByteArrayInputStream(content)).key();
        Avatar previous = user.changeAvatar(new Avatar(key, contentType), clock.instant());
        users.update(user);
        forget(previous);
        return view(user);
    }

    @Transactional
    public AccountView removeAvatar(UUID userId) {
        User user = load(userId);
        Avatar previous = user.changeAvatar(null, clock.instant());
        users.update(user);
        forget(previous);
        return view(user);
    }

    /** The photo with this key (the secret part of its address). */
    @Transactional(readOnly = true)
    public Optional<AvatarFile> avatar(String key) {
        return users.findAvatar(key)
                .map(avatar -> new AvatarFile(files.load(NAMESPACE, avatar.key()), avatar.contentType()));
    }

    /** The address of a photo; {@code null} for none. */
    public static @Nullable String avatarUrl(@Nullable Avatar avatar) {
        return avatar == null ? null : AVATAR_PATH + avatar.key();
    }

    /**
     * Changes the password and ends every session of the user. The caller receives a fresh session,
     * so only the current browser stays signed in.
     */
    @Transactional
    public Session changePassword(UUID userId, String currentPassword, String newPassword) {
        User user = load(userId);
        String hash = user.passwordHash();
        if (hash == null || !passwordEncoder.matches(currentPassword, hash)) {
            throw new BusinessRuleException("password.wrong-current", "Current password is incorrect");
        }
        PasswordPolicy.validate(newPassword);
        Instant now = clock.instant();
        user.changePassword(passwordEncoder.encode(newPassword), now);
        users.update(user);
        refreshTokens.revokeAllOfUser(userId, now);
        return sessionIssuer.startSession(user);
    }

    private void forget(@Nullable Avatar avatar) {
        if (avatar != null) {
            files.delete(NAMESPACE, avatar.key());
        }
    }

    private static AccountView view(User user) {
        return new AccountView(user.id(), user.role(), user.shownName(), user.profile().displayName(),
                avatarUrl(user.avatar()), user.login(), user.profile().email(), user.profile().phone(),
                user.passwordChangeRequired());
    }

    private User load(UUID userId) {
        return users.findById(userId).orElseThrow(() -> new NotFoundException("user.not-found", "User not found"));
    }
}
