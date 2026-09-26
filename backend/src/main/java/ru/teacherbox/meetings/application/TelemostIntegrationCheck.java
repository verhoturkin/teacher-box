package ru.teacherbox.meetings.application;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Checks the Telemost token for the administrator without creating a meeting. */
@Component
class TelemostIntegrationCheck implements IntegrationCheck {

    static final String NAME = "Яндекс Телемост";

    private final YandexService yandex;
    private final TelemostApi api;

    TelemostIntegrationCheck(YandexService yandex, TelemostApi api) {
        this.yandex = yandex;
        this.api = api;
    }

    @Override
    public List<IntegrationStatus> check() {
        if (!yandex.canCreateMeetings()) {
            return List.of(IntegrationStatus.notConfigured(NAME, "Яндекс не подключён: ссылки комнат вводятся вручную"));
        }
        long started = System.nanoTime();
        try {
            api.checkToken(yandex.accessToken());
            return List.of(new IntegrationStatus(NAME, State.OK, "Токен принят", elapsed(started)));
        } catch (TelemostAuthException e) {
            yandex.lost(e);
            return List.of(new IntegrationStatus(NAME, State.FAILED, String.valueOf(e.getMessage()), elapsed(started)));
        } catch (TelemostException | BusinessRuleException e) {
            return List.of(new IntegrationStatus(NAME, State.FAILED, String.valueOf(e.getMessage()), elapsed(started)));
        }
    }

    private static long elapsed(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
