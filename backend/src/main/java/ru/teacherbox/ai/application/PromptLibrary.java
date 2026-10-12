package ru.teacherbox.ai.application;

import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.ai.application.AiViews.PromptView;
import ru.teacherbox.ai.domain.SavedPrompt;
import ru.teacherbox.ai.persistence.PromptRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.NotFoundException;

/** The teacher's library of prompts for drafts of homework. Kept whether the AI is configured or not. */
@Service
public class PromptLibrary {

    private final PromptRepository prompts;
    private final Clock clock;

    public PromptLibrary(PromptRepository prompts, Clock clock) {
        this.prompts = prompts;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<PromptView> list() {
        return prompts.findAll().stream().map(PromptView::of).toList();
    }

    @Transactional
    public PromptView create(String title, String text) {
        SavedPrompt prompt = SavedPrompt.create(Ids.newId(), title, text, clock.instant());
        prompts.insert(prompt);
        return PromptView.of(prompt);
    }

    /**
     * @throws OptimisticLockingFailureException if the prompt was changed after {@code expectedVersion}
     */
    @Transactional
    public PromptView update(UUID id, String title, String text, long expectedVersion) {
        SavedPrompt prompt = prompts.findById(id).orElseThrow(PromptLibrary::notFound);
        if (prompt.version() != expectedVersion) {
            throw new OptimisticLockingFailureException("Prompt " + id + " was modified");
        }
        prompt.update(title, text, clock.instant());
        prompts.update(prompt);
        return PromptView.of(prompt);
    }

    @Transactional
    public void delete(UUID id) {
        if (!prompts.delete(id)) {
            throw notFound();
        }
    }

    private static NotFoundException notFound() {
        return new NotFoundException("ai.prompt-not-found", "Prompt not found");
    }
}
