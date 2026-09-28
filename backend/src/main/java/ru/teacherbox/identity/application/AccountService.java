package ru.teacherbox.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.domain.PasswordPolicy;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.RefreshTokenRepository;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.security.Role;

/** The signed-in user's own account. */
@Service
public class AccountService {

    /**
     * Own account data. The teacher's private note about a student is never included.
     *
     * @param passwordChangeRequired the password was generated on the first start and must be replaced
     */
    public record AccountView(UUID id, Role role, String displayName, @Nullable String login,
            @Nullable String email, @Nullable String phone, boolean passwordChangeRequired) {
    }

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final SessionIssuer sessionIssuer;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public AccountService(UserRepository users, RefreshTokenRepository refreshTokens, SessionIssuer sessionIssuer,
            PasswordEncoder passwordEncoder, Clock clock) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.sessionIssuer = sessionIssuer;
        this.passwordEncoder = passwordEncoder;
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

    private static AccountView view(User user) {
        return new AccountView(user.id(), user.role(), user.profile().displayName(), user.login(),
                user.profile().email(), user.profile().phone(), user.passwordChangeRequired());
    }

    private User load(UUID userId) {
        return users.findById(userId).orElseThrow(() -> new NotFoundException("user.not-found", "User not found"));
    }
}
