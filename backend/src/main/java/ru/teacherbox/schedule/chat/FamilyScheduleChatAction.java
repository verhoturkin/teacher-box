package ru.teacherbox.schedule.chat;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.i18n.Language;

/**
 * A guardian (ADR-0069): the upcoming lessons of every child, under the child's name, read-only. No join
 * button: the room is the child's.
 */
@Component
class FamilyScheduleChatAction implements ChatAction {

    /** Lessons shown per child. */
    static final int SHOWN = 5;

    private final StudentLessons lessons;

    FamilyScheduleChatAction(StudentLessons lessons) {
        this.lessons = lessons;
    }

    @Override
    public String id() {
        return "schedule.family";
    }

    @Override
    public String title(Language language) {
        return ScheduleChatTexts.of(language).familySchedule();
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
        return user.isGuardian();
    }

    @Override
    public ChatStep start(ChatUser user) {
        ScheduleChatTexts t = ScheduleChatTexts.of(user.language());
        List<StudentSummary> children = lessons.children(user.id());
        if (children.isEmpty()) {
            return ChatStep.done(t.noPlannedLessons());
        }
        StringBuilder text = new StringBuilder();
        for (StudentSummary child : children) {
            if (!text.isEmpty()) {
                text.append("\n\n");
            }
            List<LessonView> upcoming = lessons.upcoming(child.id());
            if (upcoming.isEmpty()) {
                text.append(t.childNoLessons(child.displayName()));
                continue;
            }
            text.append(t.childLessons(child.displayName()));
            upcoming.stream().limit(SHOWN).forEach(lesson -> {
                text.append("\n• ").append(lessons.describe(lesson, user.language()));
                if (!StudentLessons.expected(lesson, child.id())) {
                    text.append(t.childWontCome());
                } else if (!lesson.pendingRequests().isEmpty()) {
                    text.append(t.childRequestPending());
                }
            });
            if (upcoming.size() > SHOWN) {
                text.append("\n").append(t.andMore(upcoming.size() - SHOWN));
            }
        }
        return ChatStep.done(text.toString());
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        return start(user);
    }
}
