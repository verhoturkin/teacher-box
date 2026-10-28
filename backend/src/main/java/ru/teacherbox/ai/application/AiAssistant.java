package ru.teacherbox.ai.application;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import ru.teacherbox.ai.application.AiViews.HomeworkBrief;
import ru.teacherbox.ai.application.AiViews.HomeworkDraft;
import ru.teacherbox.ai.application.AiViews.LessonSummaryBrief;
import ru.teacherbox.ai.application.AiViews.LessonSummaryDraft;
import ru.teacherbox.ai.application.AiViews.ReviewBrief;
import ru.teacherbox.ai.application.AiViews.QuizDraft;
import ru.teacherbox.ai.application.AiViews.ReviewDraft;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.homework.api.QuizDrafts;
import ru.teacherbox.shared.error.BusinessRuleException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * The teacher's assistant: drafts of homework and of reviews. Answers are always drafts that the
 * teacher edits. No transaction is held while the model is working; every call is logged.
 */
@Service
public class AiAssistant {

    static final String HOMEWORK_PROMPT = "homework-draft.user.v3";
    static final String REVIEW_PROMPT = "review-draft.user.v1";
    static final String LESSON_SUMMARY_PROMPT = "lesson-summary.user.v1";
    static final String QUIZ_PROMPT = "quiz-draft.user.v1";
    static final int MAX_TITLE = 200;

    static final Map<String, Object> HOMEWORK_SCHEMA = object(
            "title", property("string", "Короткое название задания"),
            "description", property("string", "Текст задания в Markdown"));
    static final Map<String, Object> REVIEW_SCHEMA = object(
            "comment", property("string", "Черновик отзыва для ученика"),
            "grade", property("string", "Оценка «2»–«5» или пустая строка"),
            "accept", property("boolean", "true — принять работу, false — вернуть на доработку"));

    static final Map<String, Object> QUIZ_SCHEMA = object(
            "questions", array(object(
                    "type", enumeration("SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_TEXT", "NUMBER", "MATCHING",
                            "ORDERING"),
                    "text", property("string", "Текст вопроса в Markdown"),
                    "points", nullable(Map.of("type", "integer"), "Баллы, 1–5"),
                    "explanation", nullable(Map.of("type", "string"), "Почему ответ верный"),
                    "options", nullable(array(property("string", "Вариант или элемент")),
                            "Варианты выбора или элементы упорядочивания в верном порядке"),
                    "correct", nullable(array(property("integer", "Индекс варианта с нуля")),
                            "Индексы верных вариантов"),
                    "accepted", nullable(array(property("string", "Допустимый ответ")), "Допустимые ответы"),
                    "value", nullable(Map.of("type", "number"), "Верное число"),
                    "tolerance", nullable(Map.of("type", "number"), "Допустимое отклонение"),
                    "pairs", nullable(array(object(
                            "left", property("string", "Слева"),
                            "right", property("string", "Справа"))), "Пары соответствия"))));

    static final Map<String, Object> LESSON_SUMMARY_SCHEMA = object(
            "summary", property("string", "Итоги урока в Markdown: что прошли"));

    private record QuizAnswer(@Nullable List<QuizDrafts.Draft> questions) {
    }

    private record LessonSummaryAnswer(@Nullable String summary) {
    }

    private record HomeworkAnswer(@Nullable String title, @Nullable String description) {
    }

    private record ReviewAnswer(@Nullable String comment, @Nullable String grade, @Nullable Boolean accept) {
    }

    private final ObjectProvider<LlmClient> llm;
    private final QuizDrafts quizDrafts;
    private final PromptTemplates prompts;
    private final SystemPrompts systemPrompts;
    private final AiUsage usage;
    private final DraftSources sources;
    private final JsonMapper json;

    public AiAssistant(ObjectProvider<LlmClient> llm, PromptTemplates prompts, SystemPrompts systemPrompts,
            AiUsage usage, DraftSources sources, JsonMapper json, QuizDrafts quizDrafts) {
        this.quizDrafts = quizDrafts;
        this.llm = llm;
        this.prompts = prompts;
        this.systemPrompts = systemPrompts;
        this.usage = usage;
        this.sources = sources;
        this.json = json;
    }

    /** A draft of homework from the teacher's request and the materials it names. */
    public HomeworkDraft homeworkDraft(HomeworkBrief brief) {
        List<LlmSource> materials = sources.read(brief.sources());
        Map<String, String> values = Map.of(
                "title", orDash(brief.title()),
                "sources", materials.isEmpty() ? "—"
                        : materials.stream().map(LlmSource::name).collect(Collectors.joining("; ")),
                "prompt", brief.prompt().strip());
        LlmRequest request = new LlmRequest(
                systemPrompts.text(AiFeature.HOMEWORK_DRAFT),
                prompts.render(HOMEWORK_PROMPT, values),
                "homework_draft",
                HOMEWORK_SCHEMA,
                materials);
        return call(AiFeature.HOMEWORK_DRAFT, request, HomeworkAnswer.class, answer -> {
            String title = answer.title() == null ? "" : answer.title().strip();
            String description = answer.description() == null ? "" : answer.description().strip();
            if (title.isEmpty() || description.isEmpty()) {
                return null;
            }
            return new HomeworkDraft(title.length() > MAX_TITLE ? title.substring(0, MAX_TITLE) : title,
                    description);
        });
    }

    /** A draft of quiz questions from the teacher's request and the materials it names. */
    public QuizDraft quizDraft(HomeworkBrief brief) {
        List<LlmSource> materials = sources.read(brief.sources());
        Map<String, String> values = Map.of(
                "sources", materials.isEmpty() ? "—"
                        : materials.stream().map(LlmSource::name).collect(Collectors.joining("; ")),
                "prompt", brief.prompt().strip());
        LlmRequest request = new LlmRequest(systemPrompts.text(AiFeature.QUIZ_DRAFT),
                prompts.render(QUIZ_PROMPT, values), "quiz_draft", QUIZ_SCHEMA, materials);
        return call(AiFeature.QUIZ_DRAFT, request, QuizAnswer.class, answer -> {
            List<QuizDrafts.Drafted> questions = quizDrafts.validate(
                    answer.questions() == null ? List.of() : answer.questions());
            return questions.isEmpty() ? null : new QuizDraft(questions);
        });
    }

    public ReviewDraft reviewDraft(ReviewBrief brief) {
        Map<String, String> values = Map.of(
                "title", brief.title().strip(),
                "description", orDash(brief.description()),
                "answer", brief.answer().strip());
        LlmRequest request = new LlmRequest(systemPrompts.text(AiFeature.REVIEW_DRAFT),
                prompts.render(REVIEW_PROMPT, values), "review_draft", REVIEW_SCHEMA);
        return call(AiFeature.REVIEW_DRAFT, request, ReviewAnswer.class, answer -> {
            String comment = answer.comment() == null ? "" : answer.comment().strip();
            if (comment.isEmpty() || answer.accept() == null) {
                return null;
            }
            String grade = answer.grade() == null || answer.grade().isBlank() ? null : answer.grade().strip();
            return new ReviewDraft(comment, grade, answer.accept());
        });
    }

    /** A draft of «Что прошли» from the topic, the assignments and the teacher's short words. */
    public LessonSummaryDraft lessonSummary(LessonSummaryBrief brief) {
        Map<String, String> values = Map.of(
                "topic", orDash(brief.topic()),
                "assignments", brief.assignmentTitles().isEmpty() ? "—"
                        : brief.assignmentTitles().stream().map(title -> "— " + title.strip())
                                .collect(Collectors.joining("\n")),
                "words", orDash(brief.words()));
        LlmRequest request = new LlmRequest(systemPrompts.text(AiFeature.LESSON_SUMMARY),
                prompts.render(LESSON_SUMMARY_PROMPT, values), "lesson_summary", LESSON_SUMMARY_SCHEMA);
        return call(AiFeature.LESSON_SUMMARY, request, LessonSummaryAnswer.class, answer -> {
            String summary = answer.summary() == null ? "" : answer.summary().strip();
            return summary.isEmpty() ? null : new LessonSummaryDraft(summary);
        });
    }

    private interface Converter<A, T> {
        /** @return {@code null} if the answer is unusable */
        @Nullable T convert(A answer);
    }

    private <A, T> T call(AiFeature feature, LlmRequest request, Class<A> answerType, Converter<A, T> converter) {
        LlmClient client = llm.getIfAvailable();
        if (client == null) {
            throw new BusinessRuleException("ai.disabled", "AI is not configured on this instance");
        }
        if (usage.budget().isExhausted()) {
            throw new BusinessRuleException("ai.limit-exceeded", "The monthly AI token limit is reached");
        }
        long started = System.nanoTime();
        LlmResponse response;
        try {
            response = client.complete(request);
        } catch (LlmException e) {
            RequestStatus status = e.reason() == LlmException.Reason.REFUSED ? RequestStatus.REFUSED
                    : RequestStatus.FAILED;
            usage.record(feature, client, client.model(), status, e.inputTokens(), e.outputTokens(), elapsed(started),
                    e.getMessage());
            throw toDomain(e);
        }
        T result = parse(response.text(), answerType, converter);
        long duration = elapsed(started);
        if (result == null) {
            usage.record(feature, client, response.model(), RequestStatus.FAILED, response.inputTokens(),
                    response.outputTokens(), duration, "The answer does not match the requested format");
            throw toDomain(new LlmException(LlmException.Reason.INVALID_ANSWER, "Invalid answer"));
        }
        usage.record(feature, client, response.model(), RequestStatus.SUCCEEDED, response.inputTokens(),
                response.outputTokens(), duration, null);
        return result;
    }

    private <A, T> @Nullable T parse(String text, Class<A> answerType, Converter<A, T> converter) {
        try {
            A answer = json.readValue(extractJson(text), answerType);
            return answer == null ? null : converter.convert(answer);
        } catch (JacksonException e) {
            return null;
        }
    }

    /** Tolerates Markdown fences or text around the object (some OpenAI-compatible models add them). */
    static String extractJson(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        return start >= 0 && end > start ? text.substring(start, end + 1) : text;
    }

    private static BusinessRuleException toDomain(LlmException e) {
        return switch (e.reason()) {
            case REFUSED -> new BusinessRuleException("ai.refused", "The model declined the request");
            case TRUNCATED -> new BusinessRuleException("ai.truncated", "The answer was cut short");
            case INVALID_ANSWER -> new BusinessRuleException("ai.invalid-answer", "The model returned an unusable answer");
            case UNAVAILABLE -> new BusinessRuleException("ai.unavailable", "The AI provider is unavailable");
        };
    }

    private static String orDash(@Nullable String value) {
        return value == null || value.isBlank() ? "—" : value.strip();
    }

    private static long elapsed(long startedNanos) {
        return Math.max(0, (System.nanoTime() - startedNanos) / 1_000_000);
    }

    private static Map<String, Object> property(String type, String description) {
        Map<String, Object> property = new LinkedHashMap<>();
        property.put("type", type);
        property.put("description", description);
        return Collections.unmodifiableMap(property);
    }

    private static Map<String, Object> array(Map<String, Object> items) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "array");
        schema.put("items", items);
        return Collections.unmodifiableMap(schema);
    }

    private static Map<String, Object> enumeration(String... values) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "string");
        schema.put("enum", List.of(values));
        return Collections.unmodifiableMap(schema);
    }

    /** A property every object must list but may leave {@code null}. */
    private static Map<String, Object> nullable(Map<String, Object> schema, String description) {
        Map<String, Object> property = new LinkedHashMap<>();
        property.put("anyOf", List.of(schema, Map.of("type", "null")));
        property.put("description", description);
        return Collections.unmodifiableMap(property);
    }

    /** An object schema whose properties are all required and no others are allowed. */
    private static Map<String, Object> object(Object... namesAndProperties) {
        Map<String, Object> properties = new LinkedHashMap<>();
        for (int i = 0; i < namesAndProperties.length; i += 2) {
            properties.put((String) namesAndProperties[i], namesAndProperties[i + 1]);
        }
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", Collections.unmodifiableMap(properties));
        schema.put("required", List.copyOf(properties.keySet()));
        schema.put("additionalProperties", false);
        return Collections.unmodifiableMap(schema);
    }
}
