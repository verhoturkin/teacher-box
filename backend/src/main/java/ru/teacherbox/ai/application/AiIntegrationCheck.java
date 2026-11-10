package ru.teacherbox.ai.application;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;
import ru.teacherbox.shared.i18n.Language;

/** Asks the provider of the default model about it (ADR-0057); no tokens are spent. */
@Component
class AiIntegrationCheck implements IntegrationCheck {

    private final LlmClients llm;

    AiIntegrationCheck(LlmClients llm) {
        this.llm = llm;
    }

    @Override
    public List<IntegrationStatus> check() {
        // in the language of the administrator's page (ADR-0036)
        Language language = Language.current();
        String title = language == Language.RU ? "ИИ" : "AI";
        LlmClient client = llm.forDefault().map(LlmClients.ModelClient::client).orElse(null);
        if (client == null) {
            return List.of(IntegrationStatus.notConfigured(title, language == Language.RU
                    ? "Нет подключения: учитель добавляет его в «Настройках» → «ИИ-помощник»"
                    : "No connection: the teacher adds one in Settings → AI assistant"));
        }
        String name = title + " (" + client.provider() + ")";
        long started = System.nanoTime();
        try {
            String answer = client.ping(language);
            return List.of(new IntegrationStatus(name, State.OK, answer, elapsed(started)));
        } catch (LlmException e) {
            return List.of(new IntegrationStatus(name, State.FAILED, String.valueOf(e.getMessage()), elapsed(started)));
        }
    }

    private static long elapsed(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
