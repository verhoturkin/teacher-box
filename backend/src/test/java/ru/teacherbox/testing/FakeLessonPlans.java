package ru.teacherbox.testing;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.textbooks.api.LessonPlanView;
import ru.teacherbox.textbooks.api.LessonPlans;

/** In-memory {@link LessonPlans} for module tests that do not bootstrap textbooks. */
public class FakeLessonPlans implements LessonPlans {

    private final Map<UUID, LessonPlanView> plans = new ConcurrentHashMap<>();

    /** A working plan (not a bank item) with the given textbooks and videos. */
    public UUID add(String title, List<LessonPlanView.Textbook> textbooks, List<LessonPlanView.Video> videos) {
        return put(title, false, textbooks, videos);
    }

    /** An original of the bank: it never goes on a lesson. */
    public UUID addToBank(String title) {
        return put(title, true, List.of(), List.of());
    }

    public void remove(UUID id) {
        plans.remove(id);
    }

    @Override
    public List<LessonPlanView> find(Collection<UUID> planIds) {
        return planIds.stream().map(plans::get).filter(Objects::nonNull).toList();
    }

    @Override
    public void checkLinkable(UUID planId) {
        LessonPlanView plan = plans.get(planId);
        if (plan == null) {
            throw new NotFoundException("textbooks.plan-not-found", "Lesson plan not found");
        }
        if (plan.bank()) {
            throw new ConflictException("textbooks.plan-in-bank", "The plan is in the bank");
        }
    }

    private UUID put(String title, boolean bank, List<LessonPlanView.Textbook> textbooks,
            List<LessonPlanView.Video> videos) {
        UUID id = Ids.newId();
        plans.put(id, new LessonPlanView(id, title, "План: " + title, null, bank, List.copyOf(textbooks),
                List.copyOf(videos)));
        return id;
    }
}
