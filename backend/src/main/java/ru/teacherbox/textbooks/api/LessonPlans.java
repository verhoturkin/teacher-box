package ru.teacherbox.textbooks.api;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;

/** Read-only access to lesson plans for other modules (ADR-0071); the link of a plan to a lesson is theirs. */
public interface LessonPlans {

    /** The given plans; deleted ones are skipped. */
    List<LessonPlanView> find(Collection<UUID> planIds);

    /**
     * Checks that the plan can go on a lesson: it exists and is a working plan, not a bank item.
     *
     * @throws NotFoundException {@code textbooks.plan-not-found} if there is no such plan
     * @throws ConflictException {@code textbooks.plan-in-bank} if it is a bank item
     */
    void checkLinkable(UUID planId);
}
