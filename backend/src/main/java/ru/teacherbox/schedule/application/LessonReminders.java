package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.schedule.api.LessonStartingSoon;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.persistence.LessonRepository;

/**
 * Announces planned lessons that start soon, once per configured advance time. When several
 * advance times have come at once (a lesson planned an hour before it starts), only the nearest
 * one is sent.
 */
@Component
public class LessonReminders {

    private final LessonRepository lessons;
    private final ApplicationEventPublisher events;
    private final ScheduleProperties properties;
    private final Clock clock;

    public LessonReminders(LessonRepository lessons, ApplicationEventPublisher events, ScheduleProperties properties,
            Clock clock) {
        this.lessons = lessons;
        this.events = events;
        this.properties = properties;
        this.clock = clock;
    }

    /** @return number of reminders sent */
    @Scheduled(fixedDelayString = "${teacherbox.schedule.reminder-interval:PT5M}", initialDelayString = "PT1M")
    @Transactional
    public int sendReminders() {
        List<Duration> advances = properties.reminders();
        if (advances.isEmpty()) {
            return 0;
        }
        Instant now = clock.instant();
        int sent = 0;
        for (Lesson lesson : lessons.findScheduledStarting(now, now.plus(advances.getLast()))) {
            Duration left = Duration.between(now, lesson.startsAt());
            List<Integer> due = advances.stream()
                    .filter(advance -> advance.compareTo(left) >= 0)
                    .map(advance -> (int) advance.toMinutes())
                    .toList();
            List<Integer> already = lessons.remindersSent(lesson.id());
            int nearest = due.getFirst();
            if (!already.contains(nearest)) {
                events.publishEvent(new LessonStartingSoon(lesson.id(), lesson.studentId(), lesson.startsAt(),
                        lesson.durationMinutes(), lesson.topic(), lesson.meetingUrl(), Duration.ofMinutes(nearest),
                        nearest == advances.getFirst().toMinutes(), now));
                sent++;
            }
            lessons.markRemindersSent(lesson.id(), due.stream().filter(minutes -> !already.contains(minutes)).toList(),
                    now);
        }
        return sent;
    }
}
