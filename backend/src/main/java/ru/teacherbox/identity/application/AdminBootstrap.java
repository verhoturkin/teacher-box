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
import ru.teacherbox.identity.domain.AccountStatus;
import ru.teacherbox.identity.domain.Logins;
import ru.teacherbox.identity.domain.PasswordPolicy;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.Ids;

/**
 * The administrator account follows {@code TEACHERBOX_IDENTITY_ADMIN_PASSWORD} (ADR-0010): it is created or
 * enabled with that password, and disabled when the password is not set. A password changed in the
 * interface is kept while the account stays enabled.
 */
@Component
class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final IdentityProperties properties;
    private final Clock clock;

    AdminBootstrap(UserRepository users, PasswordEncoder passwordEncoder, IdentityProperties properties,
            Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        IdentityProperties.Admin config = properties.admin();
        Optional<User> existing = users.findAdministrator();
        Instant now = clock.instant();
        if (!config.enabled()) {
            existing.filter(admin -> admin.status() == AccountStatus.ACTIVE).ifPresent(admin -> {
                admin.disableAdministrator(now);
                users.update(admin);
                log.warn("Administrator account is disabled: TEACHERBOX_IDENTITY_ADMIN_PASSWORD is not set");
            });
            return;
        }
        String password = String.valueOf(config.password());
        PasswordPolicy.validate(password);
        if (existing.isPresent()) {
            User admin = existing.get();
            if (admin.status() != AccountStatus.ACTIVE) {
                admin.enableAdministrator(passwordEncoder.encode(password), now);
                users.update(admin);
                log.info("Administrator account '{}' is enabled", admin.login());
            }
            return;
        }
        String login = Logins.normalize(config.login());
        if (users.existsByLogin(login)) {
            log.error("Administrator account is not created: login '{}' is taken. "
                    + "Choose another one in TEACHERBOX_IDENTITY_ADMIN_LOGIN", login);
            return;
        }
        users.insert(User.newAdministrator(Ids.newId(), login, passwordEncoder.encode(password), now));
        log.info("Administrator account '{}' created", login);
    }
}
