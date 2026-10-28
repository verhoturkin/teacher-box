package ru.teacherbox.ai.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.ai.application.AiAssistant;
import ru.teacherbox.ai.application.AiUsage;
import ru.teacherbox.ai.application.AiViews.AiStatus;
import ru.teacherbox.ai.application.AiViews.RequestPage;
import ru.teacherbox.ai.application.AiViews.HomeworkBrief;
import ru.teacherbox.ai.application.AiViews.HomeworkDraft;
import ru.teacherbox.ai.application.AiViews.LessonSummaryBrief;
import ru.teacherbox.ai.application.AiViews.LessonSummaryDraft;
import ru.teacherbox.ai.application.AiViews.ReviewBrief;
import ru.teacherbox.ai.application.AiViews.ReviewDraft;
import ru.teacherbox.ai.application.AiViews.UsageReport;
import ru.teacherbox.ai.application.DraftSources;
import ru.teacherbox.ai.domain.SavedPrompt;
import ru.teacherbox.textbooks.api.PageRanges;

/**
 * The teacher's AI assistant. Texts are sent by the frontend; the sources of a draft are named by their IDs and read
 * through their modules (ADR-0039), files picked for an assignment not saved yet come with the request (ADR-0042).
 */
@RestController
@RequestMapping("/api/teacher/ai")
class TeacherAiController {

    enum SourceType { TEXTBOOK, FILE, VIDEO }

    /**
     * A material of the draft: a textbook ({@code id}, {@code pages} — blank for the whole one), a file of an
     * assignment ({@code assignmentId}, {@code id}) or a video by its transcript ({@code url}, {@code transcript},
     * {@code title}; ADR-0047).
     */
    record SourceRequest(
            @NotNull SourceType type,
            @Nullable UUID id,
            @Nullable UUID assignmentId,
            @Size(max = PageRanges.MAX_TEXT) @Nullable String pages,
            @Size(max = 200) @Nullable String title,
            @Size(max = 500) @Nullable String url,
            @Size(max = 100_000) @Nullable String transcript) {

        @AssertTrue
        boolean isComplete() {
            return switch (type) {
                case TEXTBOOK -> id != null;
                case FILE -> id != null && assignmentId != null;
                case VIDEO -> url != null && !url.isBlank() && transcript != null && !transcript.isBlank();
            };
        }

        DraftSources.Source toSource() {
            return switch (type) {
                case TEXTBOOK -> new DraftSources.TextbookPages(Objects.requireNonNull(id), pages);
                case FILE -> new DraftSources.AssignmentFileRef(Objects.requireNonNull(assignmentId),
                        Objects.requireNonNull(id));
                case VIDEO -> new DraftSources.VideoTranscript(title, Objects.requireNonNull(url),
                        Objects.requireNonNull(transcript));
            };
        }
    }

    /**
     * @param title   what the teacher already called the assignment
     * @param sources textbook pages, files and video transcripts of the assignment to base the draft on
     */
    record HomeworkDraftRequest(
            @NotBlank @Size(max = SavedPrompt.MAX_TEXT) String prompt,
            @Size(max = 200) @Nullable String title,
            @Size(max = DraftSources.MAX_SOURCES) @Nullable List<@Valid @NotNull SourceRequest> sources) {
    }

    record ReviewDraftRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 20_000) @Nullable String description,
            @NotBlank @Size(max = 20_000) String answer) {
    }

    /** At least one of the topic and the words must say something; the titles are those of the lesson's assignments. */
    record LessonSummaryRequest(
            @Size(max = 200) @Nullable String topic,
            @Size(max = 2_000) @Nullable String words,
            @Size(max = 20) @Nullable List<@NotBlank @Size(max = 200) String> assignmentTitles) {

        @AssertTrue
        boolean isNotEmpty() {
            return (topic != null && !topic.isBlank()) || (words != null && !words.isBlank());
        }
    }

    private final AiAssistant assistant;
    private final AiUsage usage;

    TeacherAiController(AiAssistant assistant, AiUsage usage) {
        this.assistant = assistant;
        this.usage = usage;
    }

    @GetMapping("/status")
    AiStatus status() {
        return usage.status();
    }

    @PostMapping(path = "/homework-draft", consumes = MediaType.APPLICATION_JSON_VALUE)
    HomeworkDraft homeworkDraft(@Valid @RequestBody HomeworkDraftRequest request) {
        return homeworkDraft(request, List.of());
    }

    /**
     * The same request with files of an assignment not saved yet (ADR-0042): part {@code brief} — the JSON request,
     * parts {@code files} — the files; they count among the 5 sources.
     */
    @PostMapping(path = "/homework-draft", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    HomeworkDraft homeworkDraftWithFiles(@Valid @RequestPart("brief") HomeworkDraftRequest request,
            @RequestPart(name = "files", required = false) @Nullable List<MultipartFile> files) {
        return homeworkDraft(request, files == null ? List.of() : files.stream()
                .map(TeacherAiController::upload)
                .toList());
    }

    private HomeworkDraft homeworkDraft(HomeworkDraftRequest request, List<DraftSources.Source> uploads) {
        List<SourceRequest> sources = request.sources();
        List<DraftSources.Source> all = new ArrayList<>();
        if (sources != null) {
            sources.stream().map(SourceRequest::toSource).forEach(all::add);
        }
        all.addAll(uploads);
        return assistant.homeworkDraft(new HomeworkBrief(request.prompt(), request.title(), all));
    }

    private static DraftSources.Source upload(MultipartFile file) {
        String filename = file.getOriginalFilename();
        String contentType = file.getContentType();
        return new DraftSources.Upload(filename == null || filename.isBlank() ? "file" : filename,
                contentType == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : contentType,
                file.getSize(), file.getResource());
    }

    @PostMapping("/review-draft")
    ReviewDraft reviewDraft(@Valid @RequestBody ReviewDraftRequest request) {
        return assistant.reviewDraft(new ReviewBrief(request.title(), request.description(), request.answer()));
    }

    @PostMapping("/lesson-summary")
    LessonSummaryDraft lessonSummary(@Valid @RequestBody LessonSummaryRequest request) {
        return assistant.lessonSummary(new LessonSummaryBrief(request.topic(), request.words(),
                request.assignmentTitles() == null ? List.of() : request.assignmentTitles()));
    }

    /** @param month {@code yyyy-MM}, the current month by default */
    @GetMapping("/usage")
    UsageReport usage(@RequestParam(required = false) @Nullable YearMonth month) {
        return usage.report(month);
    }

    /**
     * The request log of a month by pages of 10.
     *
     * @param month  {@code yyyy-MM}, the current month by default
     * @param offset how many newer requests are already shown
     */
    @GetMapping("/requests")
    RequestPage requests(@RequestParam(required = false) @Nullable YearMonth month,
            @RequestParam(defaultValue = "0") @PositiveOrZero int offset) {
        return usage.requests(month, offset);
    }
}
