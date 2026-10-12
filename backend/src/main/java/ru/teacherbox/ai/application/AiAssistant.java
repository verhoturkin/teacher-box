package ru.teacherbox.ai.application;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import ru.teacherbox.ai.application.AiViews.HomeworkBrief;
import ru.teacherbox.ai.application.AiViews.HomeworkDraft;
import ru.teacherbox.ai.application.AiViews.PageLook;
import ru.teacherbox.ai.application.AiViews.ReviewBrief;
import ru.teacherbox.ai.application.AiViews.ReviewDraft;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.HomeworkKind;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.shared.error.BusinessRuleException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * The teacher's assistant: drafts of homework and of reviews. Answers are always drafts that the
 * teacher edits. No transaction is held while the model is working; every call is logged.
 */
@Service
public class AiAssistant {

    static final String HOMEWORK_PROMPT = "homework-draft.%s.v2";
    static final String HOMEWORK_KIND_PROMPT = "homework-kind.%s.v1";
    static final String REVIEW_PROMPT = "review-draft.%s.v1";
    static final int MAX_TITLE = 200;
    /** As much as an interactive assignment keeps. */
    static final int MAX_HTML = 200_000;

    static final Map<String, Object> HOMEWORK_SCHEMA = object(
            "title", property("string", "Короткое название задания"),
            "description", property("string", "Текст задания в Markdown"));
    static final Map<String, Object> INTERACTIVE_SCHEMA = object(
            "title", property("string", "Короткое название задания"),
            "description", property("string", "Одна-две фразы для ученика: что сделать на странице"),
            "html", property("string", "Вся HTML-страница задания с проверкой ответов"));

    /** Anything a sandboxed page could not load anyway, or that would reach outside it. */
    private static final Pattern EXTERNAL = Pattern.compile(
            "<script[^>]*\\ssrc\\s*=|<(?:link|iframe|object|embed|base)\\b"
                    + "|\\b(?:src|href|action|poster)\\s*=\\s*[\"']?\\s*(?:https?:)?//"
                    + "|url\\(\\s*[\"']?\\s*(?:https?:)?//|@import",
            Pattern.CASE_INSENSITIVE);
    static final Map<String, Object> REVIEW_SCHEMA = object(
            "comment", property("string", "Черновик отзыва для ученика"),
            "grade", property("string", "Оценка «2»–«5» или пустая строка"),
            "accept", property("boolean", "true — принять работу, false — вернуть на доработку"));

    private record HomeworkAnswer(@Nullable String title, @Nullable String description, @Nullable String html) {
    }

    private static final Map<HomeworkKind, String> KIND_NAMES = Map.of(
            HomeworkKind.WRITTEN, "письменное",
            HomeworkKind.BOARD, "на доске",
            HomeworkKind.INTERACTIVE, "интерактивное");

    private record ReviewAnswer(@Nullable String comment, @Nullable String grade, @Nullable Boolean accept) {
    }

    private final ObjectProvider<LlmClient> llm;
    private final PromptTemplates prompts;
    private final AiUsage usage;
    private final DraftSources sources;
    private final JsonMapper json;

    public AiAssistant(ObjectProvider<LlmClient> llm, PromptTemplates prompts, AiUsage usage, DraftSources sources,
            JsonMapper json) {
        this.llm = llm;
        this.prompts = prompts;
        this.usage = usage;
        this.sources = sources;
        this.json = json;
    }

    /**
     * A draft of homework of the brief's kind from the teacher's request; an interactive one comes with its page,
     * which must stay inside the sandbox (ADR-0040).
     */
    public HomeworkDraft homeworkDraft(HomeworkBrief brief) {
        boolean interactive = brief.kind() == HomeworkKind.INTERACTIVE;
        PageLook look = brief.look();
        String kindRules = prompts.render(HOMEWORK_KIND_PROMPT.formatted(brief.kind().name().toLowerCase(Locale.ROOT)),
                Map.of("font", look.font(), "primary", look.primary(), "surface", look.surface(),
                        "text", look.text()));
        List<LlmSource> materials = sources.read(brief.sources());
        Map<String, String> values = Map.of(
                "kind", KIND_NAMES.get(brief.kind()),
                "title", orDash(brief.title()),
                "sources", materials.isEmpty() ? "—"
                        : materials.stream().map(LlmSource::name).collect(Collectors.joining("; ")),
                "prompt", brief.prompt().strip());
        LlmRequest request = new LlmRequest(
                prompts.render(HOMEWORK_PROMPT.formatted("system"), Map.of("kindRules", kindRules)),
                prompts.render(HOMEWORK_PROMPT.formatted("user"), values),
                interactive ? "interactive_homework_draft" : "homework_draft",
                interactive ? INTERACTIVE_SCHEMA : HOMEWORK_SCHEMA,
                materials);
        return call(AiFeature.HOMEWORK_DRAFT, request, HomeworkAnswer.class, answer -> {
            String title = answer.title() == null ? "" : answer.title().strip();
            String description = answer.description() == null ? "" : answer.description().strip();
            String html = answer.html() == null ? "" : answer.html().strip();
            if (title.isEmpty() || description.isEmpty() || interactive && !sandboxed(html)) {
                return null;
            }
            return new HomeworkDraft(title.length() > MAX_TITLE ? title.substring(0, MAX_TITLE) : title,
                    description, interactive ? html : null);
        });
    }

    /** A whole page that loads nothing from outside; anything else is an unusable answer. */
    static boolean sandboxed(String html) {
        return !html.isEmpty() && html.length() <= MAX_HTML && !EXTERNAL.matcher(html).find();
    }

    public ReviewDraft reviewDraft(ReviewBrief brief) {
        Map<String, String> values = Map.of(
                "title", brief.title().strip(),
                "description", orDash(brief.description()),
                "answer", brief.answer().strip());
        LlmRequest request = new LlmRequest(prompts.render(REVIEW_PROMPT.formatted("system"), Map.of()),
                prompts.render(REVIEW_PROMPT.formatted("user"), values), "review_draft", REVIEW_SCHEMA);
        return call(AiFeature.REVIEW_DRAFT, request, ReviewAnswer.class, answer -> {
            String comment = answer.comment() == null ? "" : answer.comment().strip();
            if (comment.isEmpty() || answer.accept() == null) {
                return null;
            }
            String grade = answer.grade() == null || answer.grade().isBlank() ? null : answer.grade().strip();
            return new ReviewDraft(comment, grade, answer.accept());
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
