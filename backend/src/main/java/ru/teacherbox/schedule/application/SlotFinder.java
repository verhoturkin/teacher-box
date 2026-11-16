package ru.teacherbox.schedule.application;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import ru.teacherbox.schedule.application.TeacherAvailability.BusyTime;

/**
 * Free start times for a lesson: every {@code step} from the start of a period, a start whose whole
 * lesson misses every busy interval. Pure, so working windows can later be given as the busy time
 * around them.
 */
public final class SlotFinder {

    private SlotFinder() {
    }

    /**
     * Starts in {@code [from, to)} that are not before {@code notBefore} and where a lesson of
     * {@code length} overlaps no busy interval; the lesson may end after {@code to}.
     */
    public static List<Instant> freeStarts(Instant from, Instant to, Instant notBefore, List<BusyTime> busy,
            Duration length, Duration step) {
        if (!step.isPositive() || !length.isPositive()) {
            throw new IllegalArgumentException("The step and the length must be positive");
        }
        List<Instant> starts = new ArrayList<>();
        for (Instant next = from; next.isBefore(to); next = next.plus(step)) {
            Instant start = next;
            Instant end = start.plus(length);
            if (!start.isBefore(notBefore) && busy.stream().noneMatch(
                    time -> time.start().isBefore(end) && time.end().isAfter(start))) {
                starts.add(start);
            }
        }
        return List.copyOf(starts);
    }
}
