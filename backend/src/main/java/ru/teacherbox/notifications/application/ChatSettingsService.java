package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.persistence.ChatRepository;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.security.Role;

/** What the bots can do and whether the teacher manages the portal through them. */
@Service
public class ChatSettingsService {

    /** Stands for any student when listing the actions of students. */
    static final UUID ANY_STUDENT = new UUID(0, 0);

    /**
     * @param teacherActions the teacher may manage the portal through the bot
     * @param teacherMenu    the teacher's menu in the bot
     * @param studentMenu    a student's menu in the bot
     */
    public record BotView(boolean teacherActions, List<String> teacherMenu, List<String> studentMenu) {
    }

    private final ChatRepository chat;
    private final ChatActions actions;
    private final UserDirectory users;
    private final Clock clock;

    public ChatSettingsService(ChatRepository chat, ChatActions actions, UserDirectory users, Clock clock) {
        this.chat = chat;
        this.actions = actions;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public BotView view() {
        return new BotView(chat.teacherActions(), titles(new ChatUser(users.teacherId(), Role.TEACHER)),
                titles(new ChatUser(ANY_STUDENT, Role.STUDENT)));
    }

    @Transactional
    public BotView setTeacherActions(boolean enabled) {
        chat.setTeacherActions(enabled, clock.instant());
        return view();
    }

    private List<String> titles(ChatUser user) {
        return actions.availableTo(user).stream().map(ChatAction::title).toList();
    }
}
