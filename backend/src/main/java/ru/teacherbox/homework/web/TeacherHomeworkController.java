package ru.teacherbox.homework.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.homework.application.AssignmentService;
import ru.teacherbox.homework.application.HomeworkSummaryService;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentDetails;
import ru.teacherbox.homework.application.HomeworkViews.Journal;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentSummary;
import ru.teacherbox.homework.application.HomeworkViews.AttachmentView;
import ru.teacherbox.homework.application.HomeworkViews.HomeworkSummary;
import ru.teacherbox.homework.application.HomeworkViews.MyTask;
import ru.teacherbox.homework.application.HomeworkViews.ReviewQueueItem;
import ru.teacherbox.homework.application.HomeworkViews.TaskDetails;
import ru.teacherbox.homework.application.HomeworkViews.VideoInput;
import ru.teacherbox.homework.application.QuizViews;
import ru.teacherbox.homework.application.ReviewService;
import ru.teacherbox.homework.application.StudentHomeworkService;
import ru.teacherbox.homework.application.VideoCaptions;
import ru.teacherbox.homework.application.VideoTranscripts;
import ru.teacherbox.homework.domain.AssignmentVideo;
import ru.teacherbox.homework.domain.VideoLink;
import ru.teacherbox.homework.domain.quiz.Matching;
import ru.teacherbox.homework.domain.quiz.MultipleChoice;
import ru.teacherbox.homework.domain.quiz.Numeric;
import ru.teacherbox.homework.domain.quiz.Option;
import ru.teacherbox.homework.domain.quiz.Ordering;
import ru.teacherbox.homework.domain.quiz.Pair;
import ru.teacherbox.homework.domain.quiz.Question;
import ru.teacherbox.homework.domain.quiz.QuestionType;
import ru.teacherbox.homework.domain.quiz.Quiz;
import ru.teacherbox.homework.domain.quiz.RevealRule;
import ru.teacherbox.homework.domain.quiz.ShortText;
import ru.teacherbox.homework.domain.quiz.SingleChoice;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.textbooks.api.PageRanges;

/** The teacher's homework API. */
@RestController
@RequestMapping("/api/teacher/homework")
class TeacherHomeworkController {

    /**
     * A video of the assignment by link (ADR-0047).
     *
     * @param transcript      lines {@code [m:ss] text}
     * @param transcriptShown the student sees the transcript
     */
    record VideoRequest(
            @NotBlank @Size(max = VideoLink.MAX_URL) String url,
            @Size(max = AssignmentVideo.MAX_TITLE) @Nullable String title,
            @Size(max = AssignmentVideo.MAX_TRANSCRIPT) @Nullable String transcript,
            boolean transcriptShown) {

        VideoInput toInput() {
            return new VideoInput(url, title, transcript, transcriptShown);
        }
    }

    record OptionRequest(@Nullable UUID id, @Nullable String text) {

        Option toOption() {
            return new Option(id == null ? Ids.newId() : id, text == null ? "" : text);
        }
    }

    record PairRequest(@Nullable UUID id, @Nullable String left, @Nullable String right) {

        Pair toPair() {
            return new Pair(id == null ? Ids.newId() : id, left == null ? "" : left, right == null ? "" : right);
        }
    }

    /**
     * A question of the assignment (ADR-0052); which fields count depends on the type. Limits are checked by the
     * domain (codes {@code homework.quiz-*}).
     *
     * @param id          {@code null} — a new question
     * @param points      {@code null} — 1
     * @param options     choices of a single / multiple choice, items of an ordering in the right order
     * @param correct     ids of the right options
     * @param accepted    accepted texts of a short text
     * @param value       the number, with {@code tolerance} (0 by default)
     * @param pairs       pairs of a matching
     */
    record QuestionRequest(
            @Nullable UUID id,
            @NotNull QuestionType type,
            @Nullable String text,
            @Nullable Integer points,
            @Nullable String explanation,
            @Size(max = 20) @Nullable List<@Valid @NotNull OptionRequest> options,
            @Size(max = 20) @Nullable List<@NotNull UUID> correct,
            @Size(max = 20) @Nullable List<@NotNull String> accepted,
            @Nullable BigDecimal value,
            @Nullable BigDecimal tolerance,
            @Size(max = 20) @Nullable List<@Valid @NotNull PairRequest> pairs) {

        Question toQuestion() {
            UUID questionId = id == null ? Ids.newId() : id;
            String questionText = text == null ? "" : text;
            int questionPoints = points == null ? 1 : points;
            List<Option> optionList = options == null ? List.of() : options.stream().map(OptionRequest::toOption).toList();
            return switch (type) {
                case SINGLE_CHOICE -> new SingleChoice(questionId, questionText, questionPoints, explanation,
                        optionList, correct != null && correct.size() == 1 ? correct.getFirst() : noCorrect());
                case MULTIPLE_CHOICE -> new MultipleChoice(questionId, questionText, questionPoints, explanation,
                        optionList, new LinkedHashSet<>(correct == null ? List.of() : correct));
                case SHORT_TEXT -> new ShortText(questionId, questionText, questionPoints, explanation,
                        accepted == null ? List.of() : accepted);
                case NUMBER -> new Numeric(questionId, questionText, questionPoints, explanation,
                        value == null ? noValue() : value, tolerance == null ? BigDecimal.ZERO : tolerance);
                case MATCHING -> new Matching(questionId, questionText, questionPoints, explanation,
                        pairs == null ? List.of() : pairs.stream().map(PairRequest::toPair).toList());
                case ORDERING -> new Ordering(questionId, questionText, questionPoints, explanation, optionList);
            };
        }

        private static UUID noCorrect() {
            throw new BusinessRuleException("homework.quiz-no-correct", "A single choice needs one correct option");
        }

        private static BigDecimal noValue() {
            throw new BusinessRuleException("homework.quiz-value-missing", "A number question needs a value");
        }
    }

    /** @param videos the videos by link, at most 5 */
    record CreateAssignmentRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 20_000) @Nullable String description,
            @Nullable Instant dueAt,
            @Nullable List<UUID> studentIds,
            @Size(max = AssignmentVideo.MAX_PER_ASSIGNMENT) @Nullable List<@Valid @NotNull VideoRequest> videos,
            @Size(max = Quiz.MAX_QUESTIONS) @Nullable List<@Valid @NotNull QuestionRequest> questions,
            @Nullable RevealRule quizReveal,
            @Nullable Integer quizAttempts) {
    }

    /**
     * @param videos       the videos in place of the assignment's ones; {@code null} — keep them
     * @param questions    the questions in place of the assignment's ones; {@code null} — keep them
     * @param quizReveal   {@code null} — keep
     * @param quizAttempts 0 — unlimited; {@code null} — keep
     */
    record UpdateAssignmentRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 20_000) @Nullable String description,
            @Nullable Instant dueAt,
            @NotNull Long version,
            @Size(max = AssignmentVideo.MAX_PER_ASSIGNMENT) @Nullable List<@Valid @NotNull VideoRequest> videos,
            @Size(max = Quiz.MAX_QUESTIONS) @Nullable List<@Valid @NotNull QuestionRequest> questions,
            @Nullable RevealRule quizReveal,
            @Nullable Integer quizAttempts) {
    }

    record CaptionsRequest(@NotBlank @Size(max = VideoLink.MAX_URL) String url) {
    }

    /**
     * @param language  the code of the chosen caption track; {@code null} — the suggested track
     * @param automatic the chosen track is recognized by YouTube
     */
    record TranscriptRequest(@NotBlank @Size(max = VideoLink.MAX_URL) String url,
            @Size(max = 35) @Nullable String language, @Nullable Boolean automatic) {

        VideoCaptions.@Nullable Track track() {
            return language == null || language.isBlank() ? null
                    : new VideoCaptions.Track(language, Boolean.TRUE.equals(automatic));
        }
    }

    /** @param boardId the board the assignment was put on; {@code null} — none */
    record PlaceOnBoardRequest(@Nullable UUID boardId) {
    }

    record DraftStudentsRequest(@NotNull @Size(max = 500) List<UUID> studentIds) {
    }

    record AssignStudentsRequest(@NotNull @Size(min = 1) List<UUID> studentIds) {
    }

    /** @param pages {@code 1-3, 7}; blank — the whole textbook */
    record BindTextbookRequest(@NotNull UUID textbookId, @Size(max = PageRanges.MAX_TEXT) @Nullable String pages) {
    }

    record ReviewRequest(
            @NotNull ReviewService.Decision decision,
            @Size(max = 20) @Nullable String grade,
            @Size(max = 5_000) @Nullable String comment) {
    }

    record OverrideRequest(@NotNull Boolean correct) {
    }

    private final AssignmentService assignments;
    private final ReviewService reviews;
    private final HomeworkSummaryService summaries;
    private final VideoTranscripts transcripts;
    private final StudentHomeworkService students;

    TeacherHomeworkController(AssignmentService assignments, ReviewService reviews,
            HomeworkSummaryService summaries, VideoTranscripts transcripts, StudentHomeworkService students) {
        this.assignments = assignments;
        this.reviews = reviews;
        this.summaries = summaries;
        this.transcripts = transcripts;
        this.students = students;
    }

    /** «Взять субтитры с YouTube» (ADR-0047): the caption tracks of the video to choose from. */
    @PostMapping("/videos/captions")
    VideoCaptions.Tracks captions(@Valid @RequestBody CaptionsRequest request) {
        return transcripts.youtubeTracks(request.url());
    }

    /** «Взять субтитры с YouTube» (ADR-0047): the captions of the video as a transcript; nothing is saved. */
    @PostMapping("/videos/transcript")
    VideoTranscripts.Transcript transcript(@Valid @RequestBody TranscriptRequest request) {
        return transcripts.youtube(request.url(), request.track());
    }

    @GetMapping("/summary")
    HomeworkSummary summary() {
        return summaries.teacherSummary();
    }

    /** The journal: students by the assignments due from {@code from} to {@code to}; {@code who}: a group or a student. */
    @GetMapping("/journal")
    Journal journal(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) @Nullable UUID who) {
        return summaries.journal(from, to, who);
    }

    @GetMapping("/assignments")
    List<AssignmentSummary> list() {
        return assignments.list();
    }

    /** The tasks of one student, as the student's own list shows them; an unknown student has none. */
    @GetMapping("/students/{studentId}/tasks")
    List<MyTask> studentTasks(@PathVariable UUID studentId) {
        return students.tasks(studentId);
    }

    @PostMapping("/assignments")
    @ResponseStatus(HttpStatus.CREATED)
    AssignmentDetails create(@Valid @RequestBody CreateAssignmentRequest request) {
        return assignments.create(request.title(), request.description(), request.dueAt(),
                inputs(request.videos()), questions(request.questions()), request.quizReveal(),
                request.quizAttempts(), request.studentIds() == null ? List.of() : request.studentIds());
    }

    /** A draft copy of the assignment with its materials; no students, deadline or board. */
    @PostMapping("/assignments/{assignmentId}/copy")
    @ResponseStatus(HttpStatus.CREATED)
    AssignmentDetails copy(@PathVariable UUID assignmentId) {
        return assignments.copy(assignmentId);
    }

    @GetMapping("/assignments/{assignmentId}")
    AssignmentDetails get(@PathVariable UUID assignmentId) {
        return assignments.get(assignmentId);
    }

    @PutMapping("/assignments/{assignmentId}")
    AssignmentDetails update(@PathVariable UUID assignmentId, @Valid @RequestBody UpdateAssignmentRequest request) {
        return assignments.update(assignmentId, request.title(), request.description(), request.dueAt(),
                request.videos() == null ? null : inputs(request.videos()),
                request.questions() == null ? null : questions(request.questions()), request.quizReveal(),
                request.quizAttempts(), request.version());
    }

    /** Deletes the assignment with the tasks, the answers and every file of them. */
    @DeleteMapping("/assignments/{assignmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID assignmentId) {
        assignments.delete(assignmentId);
    }

    @PutMapping("/assignments/{assignmentId}/board")
    AssignmentDetails placeOnBoard(@PathVariable UUID assignmentId, @RequestBody PlaceOnBoardRequest request) {
        return assignments.placeOnBoard(assignmentId, request.boardId());
    }

    @PostMapping("/assignments/{assignmentId}/students")
    AssignmentDetails assign(@PathVariable UUID assignmentId, @Valid @RequestBody AssignStudentsRequest request) {
        return assignments.assign(assignmentId, request.studentIds());
    }

    /** Whom a draft is for: kept for «Выдать» later, nobody sees it until then. */
    @PutMapping("/assignments/{assignmentId}/draft-students")
    AssignmentDetails saveDraftStudents(@PathVariable UUID assignmentId,
            @Valid @RequestBody DraftStudentsRequest request) {
        return assignments.saveDraftStudents(assignmentId, request.studentIds());
    }

    @PostMapping(path = "/assignments/{assignmentId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    List<AttachmentView> addAttachments(@PathVariable UUID assignmentId,
            @RequestParam("files") List<MultipartFile> files) {
        return assignments.addAttachments(assignmentId, FileResponses.uploaded(files));
    }

    @DeleteMapping("/assignments/{assignmentId}/attachments/{attachmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeAttachment(@PathVariable UUID assignmentId, @PathVariable UUID attachmentId) {
        assignments.removeAttachment(assignmentId, attachmentId);
    }

    /** Binds a textbook to the assignment or changes its pages (ADR-0033). */
    @PostMapping("/assignments/{assignmentId}/textbooks")
    AssignmentDetails bindTextbook(@PathVariable UUID assignmentId, @Valid @RequestBody BindTextbookRequest request) {
        return assignments.bindTextbook(assignmentId, request.textbookId(), request.pages());
    }

    @DeleteMapping("/assignments/{assignmentId}/textbooks/{textbookId}")
    AssignmentDetails unbindTextbook(@PathVariable UUID assignmentId, @PathVariable UUID textbookId) {
        return assignments.unbindTextbook(assignmentId, textbookId);
    }

    @GetMapping("/attachments/{attachmentId}")
    ResponseEntity<Resource> download(@PathVariable UUID attachmentId) {
        return FileResponses.download(assignments.download(attachmentId));
    }

    @GetMapping("/review-queue")
    List<ReviewQueueItem> reviewQueue() {
        return reviews.queue();
    }

    @GetMapping("/tasks/{taskId}")
    TaskDetails task(@PathVariable UUID taskId) {
        return reviews.task(taskId);
    }

    @PostMapping("/tasks/{taskId}/review")
    TaskDetails review(@PathVariable UUID taskId, @Valid @RequestBody ReviewRequest request) {
        return reviews.review(taskId, request.decision(), request.grade(), request.comment());
    }

    /** The teacher's verdict on one answer of the best attempt; recomputes the score. */
    @PutMapping("/tasks/{taskId}/quiz/answers/{questionId}")
    TaskDetails overrideAnswer(@PathVariable UUID taskId, @PathVariable UUID questionId,
            @Valid @RequestBody OverrideRequest request) {
        return reviews.overrideAnswer(taskId, questionId, request.correct());
    }

    @GetMapping("/assignments/{assignmentId}/quiz/stats")
    QuizViews.QuizStats quizStats(@PathVariable UUID assignmentId) {
        return reviews.quizStats(assignmentId);
    }

    private static List<VideoInput> inputs(@Nullable List<VideoRequest> videos) {
        return videos == null ? List.of() : videos.stream().map(VideoRequest::toInput).toList();
    }

    private static List<Question> questions(@Nullable List<QuestionRequest> questions) {
        return questions == null ? List.of() : questions.stream().map(QuestionRequest::toQuestion).toList();
    }
}
