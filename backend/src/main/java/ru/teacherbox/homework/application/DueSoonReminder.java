package ru.teacherbox.homework.application;

import java.time.Clock;
import java.time.Instant;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.homework.api.HomeworkDueSoon;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.homework.persistence.TaskRepository;

/** Announces unfinished tasks whose deadline is near (once per task). */
@Component
public class DueSoonReminder {

    private final TaskRepository tasks;
    private final AssignmentRepository assignments;
    private final ApplicationEventPublisher events;
    private final HomeworkProperties properties;
    private final Clock clock;

    public DueSoonReminder(TaskRepository tasks, AssignmentRepository assignments, ApplicationEventPublisher events,
            HomeworkProperties properties, Clock clock) {
        this.tasks = tasks;
        this.assignments = assignments;
        this.events = events;
        this.properties = properties;
        this.clock = clock;
    }

    /** @return number of reminders sent */
    @Scheduled(fixedDelayString = "${teacherbox.homework.reminder-interval:PT15M}", initialDelayString = "PT1M")
    @Transactional
    public int sendReminders() {
        Instant now = clock.instant();
        int sent = 0;
        for (HomeworkTask task : tasks.findDueWithoutReminder(now, now.plus(properties.dueSoonWindow()))) {
            Assignment assignment = assignments.findById(task.assignmentId()).orElse(null);
            if (assignment == null || assignment.dueAt() == null) {
                continue;
            }
            task.markDueReminderSent(now);
            tasks.update(task);
            events.publishEvent(new HomeworkDueSoon(task.id(), assignment.id(), task.studentId(), assignment.title(),
                    assignment.dueAt(), now));
            sent++;
        }
        return sent;
    }
}
