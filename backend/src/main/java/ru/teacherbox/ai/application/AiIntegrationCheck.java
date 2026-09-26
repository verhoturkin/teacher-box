package ru.teacherbox.ai.application;

import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;

/** Asks the AI provider about the configured model; no tokens are spent. */
@Component
class AiIntegrationCheck implements IntegrationCheck {

    static final String NAME = "ИИ";

    private final ObjectProvider<LlmClient> llm;

    AiIntegrationCheck(ObjectProvider<LlmClient> llm) {
        this.llm = llm;
    }

    @Override
    public List<IntegrationStatus> check() {
        LlmClient client = llm.getIfAvailable();
        if (client == null) {
            return List.of(IntegrationStatus.notConfigured(NAME, "Провайдер не выбран (TEACHERBOX_AI_PROVIDER)"));
        }
        String name = NAME + " (" + client.provider() + ")";
        long started = System.nanoTime();
        try {
            String answer = client.ping();
            return List.of(new IntegrationStatus(name, State.OK, answer, elapsed(started)));
        } catch (LlmException e) {
            return List.of(new IntegrationStatus(name, State.FAILED, String.valueOf(e.getMessage()), elapsed(started)));
        }
    }

    private static long elapsed(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
