package ru.teacherbox.schedule.chat;

import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.application.ChangeRequestService;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.i18n.Language;

/** A student proposes another time for a lesson. */
@Component
class MoveLessonChatAction extends LessonChangeChatAction {

    MoveLessonChatAction(StudentLessons lessons, ChangeRequestService requests) {
        super(lessons, requests, ChangeKind.RESCHEDULE);
    }

    @Override
    public String id() {
        return "schedule.move";
    }

    @Override
    public String title(Language language) {
        return ScheduleChatTexts.of(language).moveLesson();
    }

    @Override
    public String icon() {
        return ChatIcons.MOVE_LESSON;
    }

    @Override
    public int order() {
        return 30;
    }
}
