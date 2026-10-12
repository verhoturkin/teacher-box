package ru.teacherbox.schedule.chat;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.application.ScheduleService;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.i18n.Language;

/** The teacher: today's lessons; the ones that have started can be marked. */
@Component
class TodayChatAction extends MarkLessonsChatAction {

    TodayChatAction(TeacherLessons lessons, ScheduleService schedule) {
        super(lessons, schedule);
    }

    @Override
    public String id() {
        return "schedule.today";
    }

    @Override
    public String title(Language language) {
        return ScheduleChatTexts.of(language).today();
    }

    @Override
    public String icon() {
        return ChatIcons.TODAY;
    }

    @Override
    public int order() {
        return 10;
    }

    @Override
    List<LessonView> lessons() {
        return teacherLessons().today();
    }

    @Override
    String heading(ScheduleChatTexts t) {
        return t.todayHeading();
    }

    @Override
    String nothing(ScheduleChatTexts t) {
        return t.noLessonsToday();
    }
}
