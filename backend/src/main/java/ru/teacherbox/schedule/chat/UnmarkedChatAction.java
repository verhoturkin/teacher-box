package ru.teacherbox.schedule.chat;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.application.ScheduleService;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.i18n.Language;

/** The teacher: lessons that have ended without an outcome. */
@Component
class UnmarkedChatAction extends MarkLessonsChatAction {

    UnmarkedChatAction(TeacherLessons lessons, ScheduleService schedule) {
        super(lessons, schedule);
    }

    @Override
    public String id() {
        return "schedule.unmarked";
    }

    @Override
    public String title(Language language) {
        return ScheduleChatTexts.of(language).unmarked();
    }

    @Override
    public String icon() {
        return ChatIcons.UNMARKED;
    }

    @Override
    public int order() {
        return 20;
    }

    @Override
    List<LessonView> lessons() {
        return teacherLessons().unmarked();
    }

    @Override
    String heading(ScheduleChatTexts t) {
        return t.unmarkedHeading();
    }

    @Override
    String nothing(ScheduleChatTexts t) {
        return t.allMarked();
    }
}
