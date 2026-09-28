package ru.teacherbox.platform.settings;

import static ru.teacherbox.platform.settings.SettingDefinition.Access.ACCOUNT;
import static ru.teacherbox.platform.settings.SettingDefinition.Access.DOCKER;
import static ru.teacherbox.platform.settings.SettingDefinition.Access.EDITABLE;
import static ru.teacherbox.platform.settings.SettingKind.ADDRESS;
import static ru.teacherbox.platform.settings.SettingKind.BOOLEAN;
import static ru.teacherbox.platform.settings.SettingKind.CHOICE;
import static ru.teacherbox.platform.settings.SettingKind.CRON;
import static ru.teacherbox.platform.settings.SettingKind.CURRENCY;
import static ru.teacherbox.platform.settings.SettingKind.DATA_SIZE;
import static ru.teacherbox.platform.settings.SettingKind.DURATION;
import static ru.teacherbox.platform.settings.SettingKind.DURATIONS;
import static ru.teacherbox.platform.settings.SettingKind.NUMBER;
import static ru.teacherbox.platform.settings.SettingKind.PROXY;
import static ru.teacherbox.platform.settings.SettingKind.TEXT;
import static ru.teacherbox.platform.settings.SettingKind.TIME_ZONE;
import static ru.teacherbox.platform.settings.SettingKind.URL;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import ru.teacherbox.platform.settings.SettingDefinition.Access;

/** Every variable of {@code .env.example} with its section and description (ADR-0016). */
public final class SettingsCatalog {

    private static final List<SettingDefinition> ALL = build();

    private SettingsCatalog() {
    }

    /** By section as in {@code .env.example}; what cannot be changed here comes last. */
    public static List<SettingDefinition> all() {
        return ALL;
    }

    public static Optional<SettingDefinition> find(String name) {
        return ALL.stream().filter(setting -> setting.name().equals(name)).findFirst();
    }

    private static List<SettingDefinition> build() {
        Builder b = new Builder();

        b.group("Портал")
                .add("TEACHERBOX_PUBLIC_URL", "Адрес портала", ADDRESS,
                        "Все ссылки портала начинаются с него. Если задан, важнее адреса из «Настройки» → «Портал».")
                .add("TEACHERBOX_TIMEZONE", "Часовой пояс учителя", TIME_ZONE,
                        "По нему считаются даты занятий и отчёты за месяц, например Europe/Moscow.");

        b.group("Оплаты")
                .add("TEACHERBOX_BILLING_CURRENCY", "Валюта", CURRENCY, "Код ISO 4217, например RUB.")
                .add("TEACHERBOX_BILLING_DEFAULT_LESSON_DURATION", "Длительность занятия, минут", NUMBER, "");

        b.group("Домашние задания")
                .add("TEACHERBOX_HOMEWORK_MAX_FILE_SIZE", "Наибольший размер файла", DATA_SIZE,
                        "Например 20MB; больше 25MB сервер не примет.")
                .add("TEACHERBOX_HOMEWORK_MAX_FILES_PER_UPLOAD", "Файлов за одну отправку", NUMBER, "")
                .add("TEACHERBOX_HOMEWORK_DUE_SOON_WINDOW", "Напоминание о сроке сдачи за", DURATION, "Например 24h.");

        b.group("Расписание")
                .add("TEACHERBOX_SCHEDULE_DEFAULT_DURATION", "Длительность занятия по умолчанию, минут", NUMBER, "")
                .add("TEACHERBOX_SCHEDULE_HORIZON", "Регулярные занятия создаются вперёд на", DURATION,
                        "Например 84d.")
                .add("TEACHERBOX_SCHEDULE_LATE_CANCELLATION", "Поздняя отмена — позже чем за", DURATION,
                        "Позднюю отмену учитель может засчитать как пропуск.")
                .add("TEACHERBOX_SCHEDULE_REMINDERS", "Напоминания о занятии за", DURATIONS,
                        "Через запятую, например 24h,1h; пусто — без напоминаний.")
                .add("TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_ID", "Google: идентификатор клиента OAuth", TEXT,
                        "Можно ввести и в «Настройках» учителя; эта переменная важнее.")
                .secret("TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_SECRET", "Google: секрет клиента OAuth")
                .add("TEACHERBOX_SCHEDULE_GOOGLE_PROXY", "Google: прокси", PROXY, "Если Google недоступен напрямую.");

        b.group("Видеовстречи")
                .add("TEACHERBOX_MEETINGS_YANDEX_CLIENT_ID", "Яндекс: идентификатор приложения", TEXT,
                        "Приложение в Яндекс ID с правами Телемоста.")
                .secret("TEACHERBOX_MEETINGS_YANDEX_CLIENT_SECRET", "Яндекс: секрет приложения")
                .secret("TEACHERBOX_MEETINGS_TELEMOST_TOKEN", "Готовый токен Телемоста")
                .add("TEACHERBOX_MEETINGS_TELEMOST_API_URL", "Адрес API Телемоста", URL, "Только для проверок.");

        b.group("Уведомления и боты")
                .secret("TEACHERBOX_NOTIFICATIONS_TELEGRAM_BOT_TOKEN", "Telegram: токен бота")
                .add("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY", "Telegram: прокси", PROXY,
                        "Если Telegram заблокирован в сети сервера.")
                .add("TEACHERBOX_NOTIFICATIONS_TELEGRAM_API_URL", "Telegram: адрес Bot API", URL,
                        "Свой сервер Bot API вместо api.telegram.org.")
                .secret("TEACHERBOX_NOTIFICATIONS_VK_TOKEN", "ВКонтакте: токен сообщества")
                .add("TEACHERBOX_NOTIFICATIONS_VK_GROUP_ID", "ВКонтакте: номер сообщества", NUMBER,
                        "Число из адреса club<номер>.")
                .secret("TEACHERBOX_NOTIFICATIONS_MAX_TOKEN", "MAX: токен бота")
                .add("TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS", "Попыток доставки сообщения", NUMBER, "")
                .add("TEACHERBOX_NOTIFICATIONS_LINK_CODE_TTL", "Код подключения мессенджера действует", DURATION,
                        "Например 15m.");

        b.group("ИИ-помощник")
                .choice("TEACHERBOX_AI_PROVIDER", "Сервис ИИ", "Пусто — ИИ выключен.",
                        List.of("anthropic", "gemini", "openai-compatible"))
                .secret("TEACHERBOX_AI_API_KEY", "Ключ API")
                .add("TEACHERBOX_AI_MODEL", "Модель", TEXT, "Пусто — модель сервиса по умолчанию.")
                .add("TEACHERBOX_AI_BASE_URL", "Адрес API", URL, "Для OpenAI-совместимых сервисов обязателен.")
                .add("TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT", "Токенов в месяц", NUMBER, "0 — без ограничения.")
                .add("TEACHERBOX_AI_PROXY", "Прокси", PROXY, "Сервисы ИИ недоступны из России напрямую.")
                .choice("TEACHERBOX_AI_EFFORT", "Усилие (только Anthropic)", "Пусто — по умолчанию модели.",
                        List.of("low", "medium", "high", "xhigh", "max"))
                .add("TEACHERBOX_AI_FALLBACKS", "Запасная модель при отказе (только Anthropic)", BOOLEAN, "")
                .add("TEACHERBOX_AI_MAX_TOKENS", "Токенов в ответе", NUMBER, "")
                .add("TEACHERBOX_AI_TIMEOUT", "Время ожидания ответа", DURATION, "Например 120s.");

        b.group("Сеансы и вход")
                .add("TEACHERBOX_IDENTITY_ACCESS_TOKEN_TTL", "Токен доступа действует", DURATION, "Например 15m.")
                .add("TEACHERBOX_IDENTITY_REFRESH_TOKEN_TTL", "Вход помнится", DURATION, "Например 30d.")
                .add("TEACHERBOX_IDENTITY_INVITE_TTL", "Приглашение действует", DURATION, "Например 7d.")
                .add("TEACHERBOX_IDENTITY_MAX_FAILED_LOGINS", "Неудачных входов до блокировки", NUMBER, "")
                .add("TEACHERBOX_IDENTITY_LOCK_DURATION", "Блокировка после неудачных входов", DURATION,
                        "Например 15m.")
                .secret("TEACHERBOX_SECURITY_JWT_SECRET", "Секрет токенов доступа",
                        "Не короче 32 символов; после смены всем нужно войти заново.")
                .add("TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_REQUESTS", "Попыток входа за период", NUMBER,
                        "0 — без ограничения.")
                .add("TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_PERIOD", "Период подсчёта попыток", DURATION,
                        "Например 1m.");

        b.group("Резервные копии")
                .add("TEACHERBOX_BACKUP_CRON", "Расписание копий", CRON,
                        "Cron из 6 частей, например 0 30 3 * * * (каждую ночь в 3:30); - — выключить.")
                .add("TEACHERBOX_BACKUP_KEEP", "Сколько копий хранить", NUMBER,
                        "Копии перед восстановлением и сбросом хранятся всегда.")
                .add("TEACHERBOX_BACKUP_RESTART", "Перезапуск после восстановления", BOOLEAN,
                        "true в Docker; false — перезапускать портал вручную.");

        b.group("Журнал")
                .choice("LOGGING_STRUCTURED_FORMAT_CONSOLE", "Формат журнала в консоли",
                        "Пусто — обычный текст; JSON для сборщиков журналов.", List.of("ecs", "logstash", "gelf"))
                .add("LOGGING_LOGBACK_ROLLINGPOLICY_MAX_FILE_SIZE", "Размер файла журнала", DATA_SIZE,
                        "Например 10MB.")
                .add("LOGGING_LOGBACK_ROLLINGPOLICY_TOTAL_SIZE_CAP", "Все файлы журнала не больше", DATA_SIZE,
                        "Например 100MB.")
                .add("LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY", "Дней журнала хранить", NUMBER, "");

        b.group("Учётные записи")
                .account("TEACHERBOX_IDENTITY_TEACHER_LOGIN", "Логин учителя", false)
                .account("TEACHERBOX_IDENTITY_TEACHER_PASSWORD", "Пароль учителя", true)
                .account("TEACHERBOX_IDENTITY_TEACHER_NAME", "Имя учителя", false)
                .account("TEACHERBOX_IDENTITY_TEACHER_RESET_PASSWORD", "Сброс пароля учителя", false)
                .account("TEACHERBOX_IDENTITY_ADMIN_LOGIN", "Логин администратора", false)
                .account("TEACHERBOX_IDENTITY_ADMIN_PASSWORD", "Пароль администратора", true);

        b.group("Docker")
                .docker("TEACHERBOX_HTTP_PORT", "Порт веб-интерфейса на сервере", NUMBER)
                .docker("TEACHERBOX_VERSION", "Версия образа", TEXT)
                .docker("TEACHERBOX_MEMORY_LIMIT", "Память контейнера", TEXT)
                .docker("TEACHERBOX_CPU_LIMIT", "Процессоры контейнера", TEXT)
                .docker("JAVA_TOOL_OPTIONS", "Параметры Java", TEXT);

        return List.copyOf(b.settings);
    }

    private static final class Builder {

        private final List<SettingDefinition> settings = new ArrayList<>();
        private String group = "";

        Builder group(String name) {
            group = name;
            return this;
        }

        Builder add(String name, String title, SettingKind kind, String hint) {
            return put(name, title, hint, kind, List.of(), false, EDITABLE);
        }

        Builder choice(String name, String title, String hint, List<String> choices) {
            return put(name, title, hint, CHOICE, choices, false, EDITABLE);
        }

        Builder secret(String name, String title) {
            return secret(name, title, "");
        }

        Builder secret(String name, String title, String hint) {
            return put(name, title, hint, TEXT, List.of(), true, EDITABLE);
        }

        Builder docker(String name, String title, SettingKind kind) {
            return put(name, title, "Docker Compose читает её до запуска портала: меняется только в .env.", kind,
                    List.of(), false, DOCKER);
        }

        Builder account(String name, String title, boolean secret) {
            return put(name, title, "Учётные записи меняются в «Мой аккаунт».", TEXT, List.of(), secret, ACCOUNT);
        }

        private Builder put(String name, String title, String hint, SettingKind kind, List<String> choices,
                boolean secret, Access access) {
            settings.add(new SettingDefinition(name, group, title, hint, kind, choices, secret, access));
            return this;
        }
    }
}
