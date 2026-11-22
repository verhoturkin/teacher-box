package ru.teacherbox.textbooks.application;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.textbooks.api.LessonPlanView;
import ru.teacherbox.textbooks.api.PageRanges;
import ru.teacherbox.textbooks.api.TextbookFormat;
import ru.teacherbox.textbooks.api.TextbookKind;
import ru.teacherbox.textbooks.api.TextbookSummary;
import ru.teacherbox.textbooks.api.Textbooks;
import ru.teacherbox.textbooks.api.VideoLink;
import ru.teacherbox.textbooks.domain.LessonPlan;
import ru.teacherbox.textbooks.domain.PlanTextbook;
import ru.teacherbox.textbooks.domain.PlanVideo;
import ru.teacherbox.textbooks.persistence.LessonPlanRepository;

/**
 * Lesson plans and the bank of plans (roadmap 11, «Bank»). A bank item is an original kept for reuse; a working plan
 * is a plan of one lesson. The first «Готово» of a working plan without a source saves its original into the bank;
 * «Использовать» makes a working copy and never adds to the bank; deleting an original keeps its copies.
 */
@Service
public class LessonPlanService {

    /** A textbook of a plan as the teacher sets it; blank pages — the whole textbook. */
    public record TextbookInput(UUID textbookId, @Nullable String pages) {
    }

    public record VideoInput(String url, @Nullable String title, @Nullable String transcript,
            boolean transcriptShown) {
    }

    /** The content of a plan: saved at once, the textbooks and videos in the teacher's order. */
    public record PlanInput(String title, @Nullable String body, @Nullable UUID courseId,
            List<TextbookInput> textbooks, List<VideoInput> videos) {
    }

    /** @param pageCount the textbook's pages; {@code null} when unknown */
    public record PlanTextbookView(UUID id, String title, TextbookKind kind, TextbookFormat format,
            @Nullable Integer pageCount, @Nullable String pages) {
    }

    /**
     * A plan as the teacher edits it.
     *
     * @param sourceId the bank item it came from or was saved as; {@code null} — none
     * @param uses     a bank item: how many working plans came from it; a working plan — 0
     */
    public record PlanView(UUID id, String title, String body, @Nullable UUID courseId, boolean bank,
            @Nullable UUID sourceId, int uses, List<PlanTextbookView> textbooks, List<LessonPlanView.Video> videos,
            Instant createdAt, Instant updatedAt, long version) {
    }

    /** A row of the teacher's list of plans. */
    public record PlanSummary(UUID id, String title, @Nullable UUID courseId, boolean bank, @Nullable UUID sourceId,
            int uses, Instant updatedAt, long version) {
    }

    /**
     * A working copy made for a lesson; the link to the lesson is kept by {@code schedule}.
     *
     * @param lessonId the lesson the copy is for, as asked
     */
    public record UsedPlan(UUID lessonId, PlanView plan) {
    }

    private static final Logger log = LoggerFactory.getLogger(LessonPlanService.class);

    private final LessonPlanRepository plans;
    private final CourseService courses;
    private final Textbooks textbooks;
    private final Clock clock;

    public LessonPlanService(LessonPlanRepository plans, CourseService courses, Textbooks textbooks, Clock clock) {
        this.plans = plans;
        this.courses = courses;
        this.textbooks = textbooks;
        this.clock = clock;
    }

    /** Bank items or working plans, the last changed first. */
    @Transactional(readOnly = true)
    public List<PlanSummary> list(boolean bank) {
        Map<UUID, Integer> uses = bank ? plans.uses() : Map.of();
        return plans.findAll(bank).stream()
                .map(plan -> new PlanSummary(plan.id(), plan.title(), plan.courseId(), plan.bank(), plan.sourceId(),
                        uses.getOrDefault(plan.id(), 0), plan.updatedAt(), plan.version()))
                .toList();
    }

    @Transactional(readOnly = true)
    public PlanView get(UUID planId) {
        return view(find(planId));
    }

    /**
     * @param bank a bank item («Материалы» → «Создать»), else a working plan
     * @throws NotFoundException {@code textbooks.course-not-found}, {@code textbooks.textbook-not-found}
     * @throws BusinessRuleException {@code textbooks.plan-*}, {@code textbooks.pages-*}, {@code video.*}
     */
    @Transactional
    public PlanView create(PlanInput input, boolean bank) {
        Instant now = clock.instant();
        LessonPlan plan = new LessonPlan(Ids.newId(), input.title(), body(input), course(input), bank, null, now,
                now, 0);
        plans.insert(plan);
        saveMaterials(plan.id(), input);
        log.info("Lesson plan {} created, bank {}", plan.id(), bank);
        return view(plan);
    }

    /**
     * Replaces the content of the plan; a bank item's copies keep theirs.
     *
     * @throws OptimisticLockingFailureException if the plan was changed after {@code expectedVersion}
     */
    @Transactional
    public PlanView update(UUID planId, PlanInput input, long expectedVersion) {
        LessonPlan plan = find(planId);
        if (plan.version() != expectedVersion) {
            throw new OptimisticLockingFailureException("LessonPlan " + planId + " was modified");
        }
        LessonPlan saved = plans.update(plan.withContent(input.title(), body(input), course(input), clock.instant()));
        saveMaterials(planId, input);
        return view(saved);
    }

    /** Deletes the plan; the copies of a bank item stay without a source. */
    @Transactional
    public void remove(UUID planId) {
        if (!plans.delete(planId)) {
            throw notFound();
        }
        log.info("Lesson plan {} deleted", planId);
    }

    /**
     * «Готово»: the first time a working plan without a source is finished, its original is saved into the bank and
     * becomes its source. A plan from the bank, an already saved one and a bank item stay as they are.
     */
    @Transactional
    public PlanView finish(UUID planId) {
        LessonPlan plan = find(planId);
        if (plan.bank() || plan.sourceId() != null) {
            return view(plan);
        }
        return view(saveOriginal(plan));
    }

    /**
     * «Сохранить в банк» / «Обновить в банке»: a working plan without an original (never saved, or the original was
     * deleted) gets a new one; else the original's content is replaced by this plan's.
     *
     * @throws ConflictException {@code textbooks.plan-in-bank} for a bank item
     */
    @Transactional
    public PlanView bank(UUID planId) {
        LessonPlan plan = find(planId);
        if (plan.bank()) {
            throw new ConflictException("textbooks.plan-in-bank", "The plan is in the bank already");
        }
        if (plan.sourceId() == null) {
            return view(saveOriginal(plan));
        }
        LessonPlan original = find(plan.sourceId());
        plans.update(original.withContent(plan.title(), plan.body(), plan.courseId(), clock.instant()));
        copyMaterials(plan.id(), original.id());
        log.info("Lesson plan {} updated bank item {}", plan.id(), original.id());
        return view(plan);
    }

    /**
     * «Использовать»: a working copy of a bank item for a lesson; nothing is added to the bank.
     *
     * @throws ConflictException {@code textbooks.plan-not-in-bank} unless the plan is a bank item
     */
    @Transactional
    public UsedPlan use(UUID planId, UUID lessonId) {
        LessonPlan original = find(planId);
        if (!original.bank()) {
            throw new ConflictException("textbooks.plan-not-in-bank", "Only a bank item can be used");
        }
        LessonPlan copy = original.copy(Ids.newId(), false, original.id(), clock.instant());
        plans.insert(copy);
        copyMaterials(original.id(), copy.id());
        log.info("Lesson plan {} used as {} for lesson {}", original.id(), copy.id(), lessonId);
        return new UsedPlan(lessonId, view(copy));
    }

    /** The plans as other modules see them; deleted ones are skipped. */
    @Transactional(readOnly = true)
    public List<LessonPlanView> views(List<UUID> planIds) {
        return plans.findByIds(new HashSet<>(planIds)).stream()
                .map(plan -> {
                    PlanView view = view(plan);
                    return new LessonPlanView(view.id(), view.title(), view.body(), view.courseId(), view.bank(),
                            view.textbooks().stream().map(textbook -> new LessonPlanView.Textbook(textbook.id(),
                                    textbook.title(), textbook.kind(), textbook.format(), textbook.pages())).toList(),
                            view.videos());
                })
                .toList();
    }

    /** The plan, or 404 {@code textbooks.plan-not-found}. */
    LessonPlan find(UUID planId) {
        return plans.findById(planId).orElseThrow(LessonPlanService::notFound);
    }

    static NotFoundException notFound() {
        return new NotFoundException("textbooks.plan-not-found", "Lesson plan not found");
    }

    private LessonPlan saveOriginal(LessonPlan plan) {
        Instant now = clock.instant();
        LessonPlan original = plan.copy(Ids.newId(), true, null, now);
        plans.insert(original);
        copyMaterials(plan.id(), original.id());
        LessonPlan saved = plans.update(new LessonPlan(plan.id(), plan.title(), plan.body(), plan.courseId(), false,
                original.id(), plan.createdAt(), now, plan.version()));
        log.info("Lesson plan {} saved as bank item {}", plan.id(), original.id());
        return saved;
    }

    private void copyMaterials(UUID fromPlanId, UUID toPlanId) {
        plans.replaceTextbooks(toPlanId, plans.findTextbooks(fromPlanId).stream()
                .map(textbook -> new PlanTextbook(toPlanId, textbook.textbookId(), textbook.position(),
                        textbook.pages()))
                .toList());
        plans.replaceVideos(toPlanId, plans.findVideos(fromPlanId).stream()
                .map(video -> video.in(Ids.newId(), toPlanId))
                .toList());
    }

    private void saveMaterials(UUID planId, PlanInput input) {
        plans.replaceTextbooks(planId, textbooks(planId, input.textbooks()));
        plans.replaceVideos(planId, videos(planId, input.videos()));
    }

    /**
     * @throws NotFoundException {@code textbooks.textbook-not-found} for a textbook that does not exist
     * @throws BusinessRuleException {@code textbooks.plan-textbook-twice}, {@code textbooks.pages-*}
     */
    private List<PlanTextbook> textbooks(UUID planId, List<TextbookInput> inputs) {
        Set<UUID> ids = new HashSet<>();
        for (TextbookInput input : inputs) {
            if (!ids.add(input.textbookId())) {
                throw new BusinessRuleException("textbooks.plan-textbook-twice", "A textbook is in the plan twice");
            }
        }
        Map<UUID, TextbookSummary> found = textbooks.find(ids).stream()
                .collect(Collectors.toMap(TextbookSummary::id, Function.identity()));
        List<PlanTextbook> result = new ArrayList<>();
        for (TextbookInput input : inputs) {
            TextbookSummary textbook = found.get(input.textbookId());
            if (textbook == null) {
                throw new NotFoundException("textbooks.textbook-not-found", "Textbook not found");
            }
            String pages = input.pages() == null || input.pages().isBlank() ? null
                    : PageRanges.parse(input.pages()).within(textbook.pageCount()).text();
            result.add(new PlanTextbook(planId, textbook.id(), result.size(), pages));
        }
        return result;
    }

    /** @throws BusinessRuleException {@code video.too-many} over 5 videos, {@code video.link-invalid} */
    private static List<PlanVideo> videos(UUID planId, List<VideoInput> inputs) {
        if (inputs.size() > PlanVideo.MAX_PER_PLAN) {
            throw new BusinessRuleException("video.too-many", "At most " + PlanVideo.MAX_PER_PLAN + " videos per plan");
        }
        List<PlanVideo> result = new ArrayList<>();
        for (VideoInput input : inputs) {
            result.add(new PlanVideo(Ids.newId(), planId, result.size(), VideoLink.parse(input.url()), input.title(),
                    input.transcript(), input.transcriptShown()));
        }
        return result;
    }

    private @Nullable UUID course(PlanInput input) {
        if (input.courseId() != null) {
            courses.find(input.courseId());
        }
        return input.courseId();
    }

    private static String body(PlanInput input) {
        return input.body() == null ? "" : input.body();
    }

    private PlanView view(LessonPlan plan) {
        List<PlanTextbook> bound = plans.findTextbooks(plan.id());
        Map<UUID, TextbookSummary> summaries = bound.isEmpty() ? Map.of()
                : textbooks.find(bound.stream().map(PlanTextbook::textbookId).toList()).stream()
                        .collect(Collectors.toMap(TextbookSummary::id, Function.identity()));
        List<PlanTextbookView> textbookViews = bound.stream()
                .filter(textbook -> summaries.containsKey(textbook.textbookId()))
                .map(textbook -> {
                    TextbookSummary summary = summaries.get(textbook.textbookId());
                    return new PlanTextbookView(summary.id(), summary.title(), summary.kind(), summary.format(),
                            summary.pageCount(), textbook.pages());
                })
                .toList();
        List<LessonPlanView.Video> videoViews = plans.findVideos(plan.id()).stream()
                .map(video -> new LessonPlanView.Video(video.link().url(), video.link().provider(),
                        video.link().videoId(), video.link().startSeconds(), video.title(), video.transcript(),
                        video.transcriptShown()))
                .toList();
        int uses = plan.bank() ? plans.countUses(plan.id()) : 0;
        return new PlanView(plan.id(), plan.title(), plan.body(), plan.courseId(), plan.bank(), plan.sourceId(), uses,
                textbookViews, videoViews, plan.createdAt(), plan.updatedAt(), plan.version());
    }
}
