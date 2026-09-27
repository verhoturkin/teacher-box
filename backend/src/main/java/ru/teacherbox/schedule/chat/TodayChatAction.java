package ru.teacherbox.schedule.chat;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.application.ScheduleService;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;

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
    public String title() {
        return "Сегодня";
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
    String heading() {
        return "Занятия сегодня:";
    }

    @Override
    String nothing() {
        return "Сегодня занятий нет.";
    }
}
