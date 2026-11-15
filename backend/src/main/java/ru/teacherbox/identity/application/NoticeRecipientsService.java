package ru.teacherbox.identity.application;

import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.notice.NoticeRecipients;

/** The teacher for the notices of the platform, which knows no users (ADR-0061). */
@Service
@Transactional(readOnly = true)
class NoticeRecipientsService implements NoticeRecipients {

    private final UserRepository users;

    NoticeRecipientsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public Optional<UUID> teacher() {
        return users.findTeacher().map(User::id);
    }
}
