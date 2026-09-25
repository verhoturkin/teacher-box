package ru.teacherbox.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.domain.PasswordPolicy;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.Ids;

/**
 * Creates the teacher account on first start ("one instance = one teacher"). If no password is
 * configured, a random one is generated and written to the log once.
 */
@Component
class TeacherBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(TeacherBootstrap.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final IdentityProperties properties;
    private final Clock clock;

    TeacherBootstrap(UserRepository users, PasswordEncoder passwordEncoder, IdentityProperties properties,
            Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        IdentityProperties.Teacher config = properties.teacher();
        Optional<User> existing = users.findTeacher();
        if (existing.isPresent()) {
            resetPasswordIfRequested(existing.get(), config);
            return;
        }
        String password = config.password();
        boolean generated = password == null || password.isBlank();
        if (generated) {
            password = SecureTokens.generatePassword();
        } else {
            PasswordPolicy.validate(password);
        }
        Instant now = clock.instant();
        User teacher = User.newTeacher(Ids.newId(), config.login(), passwordEncoder.encode(password),
                Profile.named(config.name()), now);
        users.insert(teacher);
        if (generated) {
            log.warn("""

                    ============================================================
                    Teacher account created. Login: {}  Password: {}
                    Change the password after the first sign-in.
                    ============================================================""",
                    teacher.login(), password);
        } else {
            log.info("Teacher account '{}' created", teacher.login());
        }
    }

    private void resetPasswordIfRequested(User teacher, IdentityProperties.Teacher config) {
        String password = config.password();
        if (!config.resetPassword() || password == null || password.isBlank()) {
            return;
        }
        PasswordPolicy.validate(password);
        teacher.changePassword(passwordEncoder.encode(password), clock.instant());
        users.update(teacher);
        log.warn("Teacher password was reset from configuration. Remove TEACHERBOX_IDENTITY_TEACHER_RESET_PASSWORD");
    }
}
