package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.schedule.application.ScheduleViews.FeedView;
import ru.teacherbox.schedule.domain.FeedTokens;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.persistence.FeedRepository;
import ru.teacherbox.schedule.persistence.LessonRepository;

/**
 * Secret links to subscribe to the schedule from Google, Apple or Yandex Calendar: the teacher's
 * feed has all lessons, a student's feed only their own. The link is shown once when it is created.
 */
@Service
public class FeedService {

    /** Path of a feed; the token follows. */
    public static final String PATH = "/api/public/schedule/";
    private static final Duration PAST = Duration.ofDays(60);
    private static final Duration FUTURE_MARGIN = Duration.ofDays(7);

    private final FeedRepository feeds;
    private final LessonRepository lessons;
    private final ScheduleDirectory directory;
    private final ScheduleProperties properties;
    private final Clock clock;

    public FeedService(FeedRepository feeds, LessonRepository lessons, ScheduleDirectory directory,
            ScheduleProperties properties, Clock clock) {
        this.feeds = feeds;
        this.lessons = lessons;
        this.directory = directory;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public FeedView status(UUID ownerId) {
        return feeds.createdAt(ownerId)
                .map(createdAt -> new FeedView(true, createdAt, null))
                .orElse(new FeedView(false, null, null));
    }

    /** Creates a new link; the previous one stops working. */
    @Transactional
    public FeedView create(UUID ownerId) {
        String token = FeedTokens.generate();
        Instant now = clock.instant();
        feeds.replace(ownerId, FeedTokens.hash(token), now);
        return new FeedView(true, now, PATH + token + ".ics");
    }

    @Transactional
    public void disable(UUID ownerId) {
        feeds.delete(ownerId);
    }

    /**
     * @return the calendar of the link's owner, or empty for an unknown link or a deactivated student
     */
    @Transactional(readOnly = true)
    public Optional<String> calendar(String token) {
        if (!FeedTokens.isWellFormed(token)) {
            return Optional.empty();
        }
        Optional<UUID> owner = feeds.findOwner(FeedTokens.hash(token));
        if (owner.isEmpty()) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        Instant from = now.minus(PAST);
        Instant to = now.plus(properties.horizon()).plus(FUTURE_MARGIN);
        UUID ownerId = owner.get();
        if (ownerId.equals(directory.teacherId())) {
            List<Lesson> all = lessons.findStartingBetween(from, to);
            ScheduleNames names = directory.namesOf(all);
            return Optional.of(IcsWriter.calendar("Teacher Box — занятия", all,
                    lesson -> "Урок: " + Objects.requireNonNullElse(names.title(lesson),
                            lesson.isGroup() ? "группа" : "ученик")
                            + (lesson.topic() == null ? "" : " — " + lesson.topic()),
                    now));
        }
        if (!directory.isCurrentStudent(ownerId)) {
            return Optional.empty();
        }
        List<Lesson> own = lessons.findStartingBetween(ownerId, from, to);
        ScheduleNames names = directory.namesOf(own);
        return Optional.of(IcsWriter.calendar("Занятия — Teacher Box", own,
                lesson -> (lesson.isGroup() ? "Занятие группы «" + names.group(lesson.groupId()) + "»" : "Занятие")
                        + (lesson.topic() == null ? "" : ": " + lesson.topic()),
                now));
    }
}
