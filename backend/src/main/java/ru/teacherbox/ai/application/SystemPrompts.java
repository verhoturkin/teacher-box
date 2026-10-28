package ru.teacherbox.ai.application;

import java.time.Clock;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.ai.application.AiViews.SystemPromptView;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.persistence.SystemPromptRepository;
import ru.teacherbox.ai.persistence.SystemPromptRepository.StoredPrompt;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * System prompts of the assistant (ADR-0043): the teacher's text of a feature or the default one from the module
 * resources. The teacher's text goes to the model as is, without placeholders.
 */
@Service
public class SystemPrompts {

    public static final int MAX_TEXT = 10_000;

    private final SystemPromptRepository prompts;
    private final PromptTemplates templates;
    private final Clock clock;

    public SystemPrompts(SystemPromptRepository prompts, PromptTemplates templates, Clock clock) {
        this.prompts = prompts;
        this.templates = templates;
        this.clock = clock;
    }

    /** The system prompt the model gets for a feature. */
    @Transactional(readOnly = true)
    public String text(AiFeature feature) {
        return prompts.find(feature).map(StoredPrompt::text).orElseGet(() -> defaultText(feature));
    }

    @Transactional(readOnly = true)
    public List<SystemPromptView> list() {
        return Arrays.stream(AiFeature.values()).map(this::view).toList();
    }

    /**
     * @param expectedVersion the version the teacher edited, {@code 0} for the default prompt
     * @throws OptimisticLockingFailureException if the prompt was changed after {@code expectedVersion}
     */
    @Transactional
    public SystemPromptView update(AiFeature feature, String text, long expectedVersion) {
        String stripped = text.strip();
        if (stripped.isEmpty() || stripped.length() > MAX_TEXT) {
            throw new BusinessRuleException("ai.system-prompt-invalid", "Must be 1-" + MAX_TEXT + " characters long");
        }
        long current = prompts.find(feature).map(StoredPrompt::version).orElse(0L);
        if (current != expectedVersion) {
            throw new OptimisticLockingFailureException("System prompt " + feature + " was modified");
        }
        StoredPrompt saved = prompts.save(feature, stripped, clock.instant(), expectedVersion);
        return new SystemPromptView(feature, saved.text(), defaultText(feature), true, saved.updatedAt(),
                saved.version());
    }

    /** Back to the default prompt. */
    @Transactional
    public SystemPromptView reset(AiFeature feature) {
        prompts.delete(feature);
        return view(feature);
    }

    private SystemPromptView view(AiFeature feature) {
        String defaultText = defaultText(feature);
        return prompts.find(feature)
                .map(stored -> new SystemPromptView(feature, stored.text(), defaultText, true, stored.updatedAt(),
                        stored.version()))
                .orElseGet(() -> new SystemPromptView(feature, defaultText, defaultText, false, null, 0));
    }

    private String defaultText(AiFeature feature) {
        return templates.render(resource(feature), Map.of());
    }

    /** The default prompt of a feature among the module resources. */
    static String resource(AiFeature feature) {
        return switch (feature) {
            case HOMEWORK_DRAFT -> "homework-draft.system.v4";
            case REVIEW_DRAFT -> "review-draft.system.v1";
            case LESSON_SUMMARY -> "lesson-summary.system.v1";
            case QUIZ_DRAFT -> "quiz-draft.system.v1";
        };
    }
}
