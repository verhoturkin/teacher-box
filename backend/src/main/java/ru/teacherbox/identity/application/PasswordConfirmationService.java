package ru.teacherbox.identity.application;

import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.domain.AccountStatus;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.security.PasswordConfirmation;

/** The password of an active user confirms a dangerous action of the platform (ADR-0014). */
@Service
class PasswordConfirmationService implements PasswordConfirmation {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    PasswordConfirmationService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean matches(UUID userId, String password) {
        return users.findById(userId)
                .filter(user -> user.status() == AccountStatus.ACTIVE)
                .map(user -> user.passwordHash() != null && passwordEncoder.matches(password, user.passwordHash()))
                .orElse(false);
    }
}
