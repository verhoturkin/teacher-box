package ru.teacherbox.textbooks.application;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.textbooks.api.LessonPlanView;
import ru.teacherbox.textbooks.api.LessonPlans;

/** Lesson plans for other modules: read only (ADR-0071). */
@Service
class LessonPlansFacade implements LessonPlans {

    private final LessonPlanService plans;

    LessonPlansFacade(LessonPlanService plans) {
        this.plans = plans;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LessonPlanView> find(Collection<UUID> planIds) {
        return plans.views(List.copyOf(planIds));
    }

    @Override
    @Transactional(readOnly = true)
    public void checkLinkable(UUID planId) {
        if (plans.find(planId).bank()) {
            throw new ConflictException("textbooks.plan-in-bank", "A bank item goes on no lesson");
        }
    }
}
