package ru.teacherbox.schedule.chat;

import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.application.ChangeRequestService;

/** A student asks to cancel a lesson; in a group lesson — says they will not come. */
@Component
class CancelLessonChatAction extends LessonChangeChatAction {

    CancelLessonChatAction(StudentLessons lessons, ChangeRequestService requests) {
        super(lessons, requests, ChangeKind.CANCEL);
    }

    @Override
    public String id() {
        return "schedule.cancel";
    }

    @Override
    public String title() {
        return "Отменить занятие";
    }

    @Override
    public int order() {
        return 20;
    }
}
