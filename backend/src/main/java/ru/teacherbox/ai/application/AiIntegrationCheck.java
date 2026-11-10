package ru.teacherbox.ai.application;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import ru.teacherbox.ai.application.AiProviders.Diagnosis;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;
import ru.teacherbox.shared.i18n.Language;

/**
 * Checks every AI connection of the teacher (ADR-0057), no tokens spent: one line per connection, named by its
 * provider and numbered when several share it; names, keys and addresses stay hidden from the administrator.
 */
@Component
class AiIntegrationCheck implements IntegrationCheck {

    private final AiProviders providers;

    AiIntegrationCheck(AiProviders providers) {
        this.providers = providers;
    }

    @Override
    public List<IntegrationStatus> check() {
        // in the language of the administrator's page (ADR-0036)
        Language language = Language.current();
        String title = language == Language.RU ? "ИИ" : "AI";
        List<Diagnosis> diagnoses = providers.diagnose(language);
        if (diagnoses.isEmpty()) {
            return List.of(IntegrationStatus.notConfigured(title, language == Language.RU
                    ? "Нет подключения: учитель добавляет его в «Настройках» → «ИИ-помощник»"
                    : "No connection: the teacher adds one in Settings → AI assistant"));
        }
        Map<String, Integer> seen = new HashMap<>();
        return diagnoses.stream().map(diagnosis -> {
            int number = seen.merge(diagnosis.provider(), 1, Integer::sum);
            String name = title + " (" + diagnosis.provider() + (number > 1 ? ", " + number : "") + ")";
            String detail = diagnosis.state() == AiProviders.State.OK && diagnosis.noModels()
                    ? (language == Language.RU ? "Подключение отвечает, моделей в нём пока нет"
                            : "The connection responds but has no models yet")
                    : String.valueOf(diagnosis.detail());
            return new IntegrationStatus(name, diagnosis.state() == AiProviders.State.OK ? State.OK : State.FAILED,
                    detail, diagnosis.durationMs());
        }).toList();
    }
}
