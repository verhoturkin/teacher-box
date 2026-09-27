package ru.teacherbox.schedule.chat;

import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.application.ChangeRequestService;

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
    public String title() {
        return "Перенести занятие";
    }

    @Override
    public int order() {
        return 30;
    }
}
