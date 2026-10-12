package ru.teacherbox.schedule.chat;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatReply;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.i18n.Language;

/** A student: the upcoming lessons and the link to the nearest online lesson. */
@Component
class ScheduleChatAction implements ChatAction {

    static final int SHOWN = 10;

    private final StudentLessons lessons;

    ScheduleChatAction(StudentLessons lessons) {
        this.lessons = lessons;
    }

    @Override
    public String id() {
        return "schedule.lessons";
    }

    @Override
    public String title(Language language) {
        return ScheduleChatTexts.of(language).schedule();
    }

    @Override
    public String icon() {
        return ChatIcons.SCHEDULE;
    }

    @Override
    public int order() {
        return 10;
    }

    @Override
    public boolean availableTo(ChatUser user) {
        return user.isStudent();
    }

    @Override
    public ChatStep start(ChatUser user) {
        ScheduleChatTexts t = ScheduleChatTexts.of(user.language());
        List<LessonView> upcoming = lessons.upcoming(user.id());
        if (upcoming.isEmpty()) {
            return ChatStep.done(t.noPlannedLessons());
        }
        StringBuilder text = new StringBuilder(t.upcoming());
        upcoming.stream().limit(SHOWN).forEach(lesson -> {
            text.append("\n• ").append(lessons.describe(lesson, user.language()));
            if (!StudentLessons.expected(lesson, user.id())) {
                text.append(t.youWontCome());
            } else if (!lesson.pendingRequests().isEmpty()) {
                text.append(t.requestPending());
            }
        });
        if (upcoming.size() > SHOWN) {
            text.append("\n").append(t.andMore(upcoming.size() - SHOWN));
        }
        ChatReply reply = ChatReply.of(text.toString());
        Optional<String> link = upcoming.stream()
                .filter(lesson -> StudentLessons.expected(lesson, user.id()))
                .map(LessonView::joinUrl)
                .filter(Objects::nonNull)
                .findFirst();
        return ChatStep.done(link
                .map(url -> reply.row(ChatButton.link(ChatIcons.with(ChatIcons.JOIN_LESSON, t.joinNearest()), url)))
                .orElse(reply));
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        return start(user);
    }
}
