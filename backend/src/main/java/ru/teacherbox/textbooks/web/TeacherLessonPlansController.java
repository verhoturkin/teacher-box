package ru.teacherbox.textbooks.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.textbooks.api.PageRanges;
import ru.teacherbox.textbooks.api.VideoLink;
import ru.teacherbox.textbooks.api.VideoTranscripts;
import ru.teacherbox.textbooks.application.LessonPlanService;
import ru.teacherbox.textbooks.application.LessonPlanService.PlanInput;
import ru.teacherbox.textbooks.application.LessonPlanService.PlanSummary;
import ru.teacherbox.textbooks.application.LessonPlanService.PlanView;
import ru.teacherbox.textbooks.application.LessonPlanService.TextbookInput;
import ru.teacherbox.textbooks.application.LessonPlanService.UsedPlan;
import ru.teacherbox.textbooks.application.LessonPlanService.VideoInput;
import ru.teacherbox.textbooks.domain.LessonPlan;
import ru.teacherbox.textbooks.domain.PlanVideo;

/** The teacher's lesson plans and the bank of plans (roadmap 11, «Bank»). */
@RestController
@RequestMapping("/api/teacher/textbooks/plans")
class TeacherLessonPlansController {

    /** The most textbooks of one plan. */
    static final int MAX_TEXTBOOKS = 20;

    /** @param pages blank — the whole textbook */
    record TextbookRequest(@NotNull UUID textbookId, @Size(max = PageRanges.MAX_TEXT) @Nullable String pages) {

        TextbookInput toInput() {
            return new TextbookInput(textbookId, pages);
        }
    }

    /** @param transcriptShown the student sees the transcript; off by default */
    record VideoRequest(
            @NotBlank @Size(max = VideoLink.MAX_URL) String url,
            @Size(max = PlanVideo.MAX_TITLE) @Nullable String title,
            @Size(max = VideoTranscripts.MAX_TRANSCRIPT) @Nullable String transcript,
            boolean transcriptShown) {

        VideoInput toInput() {
            return new VideoInput(url, title, transcript, transcriptShown);
        }
    }

    /**
     * @param bank a bank item («Материалы» → «Создать»); {@code null} — a working plan
     * @param textbooks the textbooks in the teacher's order; {@code null} — none
     * @param videos    the videos by link, at most 5; {@code null} — none
     */
    record CreateRequest(
            @NotBlank @Size(max = LessonPlan.MAX_TITLE) String title,
            @Size(max = LessonPlan.MAX_BODY) @Nullable String body,
            @Nullable UUID courseId,
            @Nullable Boolean bank,
            @Size(max = MAX_TEXTBOOKS) @Nullable List<@Valid @NotNull TextbookRequest> textbooks,
            @Size(max = PlanVideo.MAX_PER_PLAN) @Nullable List<@Valid @NotNull VideoRequest> videos) {

        PlanInput toInput() {
            return input(title, body, courseId, textbooks, videos);
        }
    }

    /** The whole content in place of the plan's; {@code null} lists — none. */
    record UpdateRequest(
            @NotBlank @Size(max = LessonPlan.MAX_TITLE) String title,
            @Size(max = LessonPlan.MAX_BODY) @Nullable String body,
            @Nullable UUID courseId,
            @Size(max = MAX_TEXTBOOKS) @Nullable List<@Valid @NotNull TextbookRequest> textbooks,
            @Size(max = PlanVideo.MAX_PER_PLAN) @Nullable List<@Valid @NotNull VideoRequest> videos,
            @NotNull Long version) {

        PlanInput toInput() {
            return input(title, body, courseId, textbooks, videos);
        }
    }

    record UseRequest(@NotNull UUID lessonId) {
    }

    private final LessonPlanService plans;

    TeacherLessonPlansController(LessonPlanService plans) {
        this.plans = plans;
    }

    /** {@code ?bank=true} — the bank with «Использовано N раз», else the working plans; the last changed first. */
    @GetMapping
    List<PlanSummary> list(@RequestParam(defaultValue = "false") boolean bank) {
        return plans.list(bank);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    PlanView create(@Valid @RequestBody CreateRequest request) {
        return plans.create(request.toInput(), Boolean.TRUE.equals(request.bank()));
    }

    @GetMapping("/{id}")
    PlanView get(@PathVariable UUID id) {
        return plans.get(id);
    }

    @PutMapping("/{id}")
    PlanView update(@PathVariable UUID id, @Valid @RequestBody UpdateRequest request) {
        return plans.update(id, request.toInput(), request.version());
    }

    /** A bank item's copies stay, without a source. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(@PathVariable UUID id) {
        plans.remove(id);
    }

    /** «Готово»: the first time saves the original of a new working plan into the bank. */
    @PostMapping("/{id}/finish")
    PlanView finish(@PathVariable UUID id) {
        return plans.finish(id);
    }

    /** «Сохранить в банк» / «Обновить в банке» of a working plan; a bank item — 409 {@code textbooks.plan-in-bank}. */
    @PostMapping("/{id}/bank")
    PlanView bank(@PathVariable UUID id) {
        return plans.bank(id);
    }

    /** «Использовать»: a working copy of a bank item; a working plan — 409 {@code textbooks.plan-not-in-bank}. */
    @PostMapping("/{id}/use")
    @ResponseStatus(HttpStatus.CREATED)
    UsedPlan use(@PathVariable UUID id, @Valid @RequestBody UseRequest request) {
        return plans.use(id, request.lessonId());
    }

    private static PlanInput input(String title, @Nullable String body, @Nullable UUID courseId,
            @Nullable List<TextbookRequest> textbooks, @Nullable List<VideoRequest> videos) {
        return new PlanInput(title, body, courseId,
                textbooks == null ? List.of() : textbooks.stream().map(TextbookRequest::toInput).toList(),
                videos == null ? List.of() : videos.stream().map(VideoRequest::toInput).toList());
    }
}
