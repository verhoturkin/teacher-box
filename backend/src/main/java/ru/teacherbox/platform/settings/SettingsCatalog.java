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

/**
 * Every variable of {@code .env.example} with its section and description (ADR-0016), in each language of
 * the interface (ADR-0036).
 */
public final class SettingsCatalog {

    /** No hint. */
    private static final Wording NONE = new Wording("", "");
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

        b.group("portal", w("Портал", "Portal"))
                .add("TEACHERBOX_PUBLIC_URL", w("Адрес портала", "Portal address"), ADDRESS,
                        w("Все ссылки портала начинаются с него. Если задан, важнее адреса из «Настройки» → «Портал».",
                                "Every link of the portal starts with it. When set, it wins over the address in "
                                        + "“Settings” → “Portal”."))
                .add("TEACHERBOX_TIMEZONE", w("Часовой пояс учителя", "Teacher's time zone"), TIME_ZONE,
                        w("По нему считаются даты занятий и отчёты за месяц, например Europe/Moscow.",
                                "Lesson dates and monthly reports follow it, e.g. Europe/Moscow."));

        b.group("billing", w("Оплаты", "Payments"))
                .add("TEACHERBOX_BILLING_CURRENCY", w("Валюта", "Currency"), CURRENCY,
                        w("Код ISO 4217, например RUB.", "ISO 4217 code, e.g. RUB."))
                .add("TEACHERBOX_BILLING_DEFAULT_LESSON_DURATION",
                        w("Длительность занятия, минут", "Lesson length, minutes"), NUMBER, NONE);

        b.group("homework", w("Домашние задания", "Homework"))
                .add("TEACHERBOX_HOMEWORK_MAX_FILE_SIZE", w("Наибольший размер файла", "Largest file size"), DATA_SIZE,
                        w("Например 20MB; больше 25MB сервер не примет.",
                                "E.g. 20MB; the server accepts at most 25MB."))
                .add("TEACHERBOX_HOMEWORK_MAX_FILES_PER_UPLOAD", w("Файлов за одну отправку", "Files per upload"),
                        NUMBER, NONE)
                .add("TEACHERBOX_HOMEWORK_DUE_SOON_WINDOW", w("Напоминание о сроке сдачи за", "Deadline reminder before"),
                        DURATION, w("Например 24h.", "E.g. 24h."))
                .add("TEACHERBOX_HOMEWORK_YOUTUBE_PROXY", w("Прокси для субтитров YouTube", "Proxy for YouTube captions"),
                        PROXY, w("Из России YouTube замедлен; пусто — напрямую.",
                                "YouTube is slowed down in Russia; empty — direct."));

        b.group("schedule", w("Расписание", "Schedule"))
                .add("TEACHERBOX_SCHEDULE_DEFAULT_DURATION",
                        w("Длительность занятия по умолчанию, минут", "Default lesson length, minutes"), NUMBER, NONE)
                .add("TEACHERBOX_SCHEDULE_HORIZON",
                        w("Регулярные занятия создаются вперёд на", "Regular lessons are planned ahead for"), DURATION,
                        w("Например 84d.", "E.g. 84d."))
                .add("TEACHERBOX_SCHEDULE_LATE_CANCELLATION",
                        w("Поздняя отмена — позже чем за", "Late cancellation — later than"), DURATION,
                        w("Позднюю отмену учитель может засчитать как пропуск.",
                                "The teacher may count a late cancellation as missed."))
                .add("TEACHERBOX_SCHEDULE_REMINDERS", w("Напоминания о занятии за", "Lesson reminders before"),
                        DURATIONS, w("Через запятую, например 24h,1h; пусто — без напоминаний.",
                                "Separated by commas, e.g. 24h,1h; empty — no reminders."))
                .add("TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_ID",
                        w("Google: идентификатор клиента OAuth", "Google: OAuth client ID"), TEXT,
                        w("Можно ввести и в «Настройках» учителя; эта переменная важнее.",
                                "Can also be entered in the teacher's “Settings”; this variable wins."))
                .secret("TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_SECRET",
                        w("Google: секрет клиента OAuth", "Google: OAuth client secret"))
                .add("TEACHERBOX_SCHEDULE_GOOGLE_PROXY", w("Google: прокси", "Google: proxy"), PROXY,
                        w("Если Google недоступен напрямую.", "If Google can't be reached directly."));

        b.group("meetings", w("Видеозвонки", "Video calls"))
                // the LiveKit container reads them from .env too, so they change only there
                .dockerSecret("TEACHERBOX_MEETINGS_LIVEKIT_API_KEY", w("LiveKit: ключ API", "LiveKit: API key"))
                .dockerSecret("TEACHERBOX_MEETINGS_LIVEKIT_API_SECRET",
                        w("LiveKit: секрет API (не короче 32 символов)", "LiveKit: API secret (at least 32 characters)"))
                .add("TEACHERBOX_MEETINGS_LIVEKIT_API_URL", w("LiveKit: адрес для портала", "LiveKit: address for the portal"),
                        URL, w("Браузеры всегда подключаются к <адрес портала>/livekit.",
                                "Browsers always connect to <portal address>/livekit."));

        b.group("boards", w("Доски", "Boards"))
                .add("TEACHERBOX_BOARDS_BACKUP_CRON", w("Расписание копий досок", "Board copies schedule"), CRON,
                        w("Ежедневная копия каждой изменённой доски, например 0 0 3 * * *; - — выключить.",
                                "A daily copy of every changed board, e.g. 0 0 3 * * *; - — off."))
                .add("TEACHERBOX_BOARDS_BACKUP_KEEP",
                        w("Сколько ежедневных копий доски хранить", "Daily copies of a board to keep"), NUMBER,
                        w("Копии, сделанные учителем, не считаются.", "Copies made by the teacher don't count."));

        b.group("notifications", w("Уведомления и боты", "Notifications and bots"))
                .secret("TEACHERBOX_NOTIFICATIONS_TELEGRAM_BOT_TOKEN", w("Telegram: токен бота", "Telegram: bot token"))
                .add("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY", w("Telegram: прокси", "Telegram: proxy"), PROXY,
                        w("Если Telegram заблокирован в сети сервера.", "If Telegram is blocked in the server's network."))
                .add("TEACHERBOX_NOTIFICATIONS_TELEGRAM_API_URL", w("Telegram: адрес Bot API", "Telegram: Bot API address"),
                        URL, w("Свой сервер Bot API вместо api.telegram.org.",
                                "Your own Bot API server instead of api.telegram.org."))
                .secret("TEACHERBOX_NOTIFICATIONS_VK_TOKEN", w("ВКонтакте: токен сообщества", "VK: community token"))
                .add("TEACHERBOX_NOTIFICATIONS_VK_GROUP_ID", w("ВКонтакте: номер сообщества", "VK: community number"),
                        NUMBER, w("Число из адреса club<номер>.", "The number from the address club<number>."))
                .secret("TEACHERBOX_NOTIFICATIONS_MAX_TOKEN", w("MAX: токен бота", "MAX: bot token"))
                .add("TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS", w("Попыток доставки сообщения", "Delivery attempts"),
                        NUMBER, NONE)
                .add("TEACHERBOX_NOTIFICATIONS_LINK_CODE_TTL",
                        w("Код подключения мессенджера действует", "Messenger connection code is valid for"), DURATION,
                        w("Например 15m.", "E.g. 15m."))
                .add("TEACHERBOX_NOTIFICATIONS_WEBPUSH_SUBJECT",
                        w("Уведомления в браузере: контакт для push-сервисов", "Browser notifications: contact for push services"),
                        TEXT, w("mailto:адрес или https-адрес; пусто — адрес портала.",
                                "mailto: address or an https address; empty — the portal address."));

        b.group("ai", w("ИИ-помощник", "AI assistant"))
                .choice("TEACHERBOX_AI_PROVIDER", w("Сервис ИИ", "AI service"),
                        w("Пусто — ИИ выключен.", "Empty — AI is off."),
                        List.of("anthropic", "gemini", "openrouter", "deepseek", "openai-compatible"))
                .secret("TEACHERBOX_AI_API_KEY", w("Ключ API", "API key"))
                .add("TEACHERBOX_AI_MODEL", w("Модель", "Model"), TEXT,
                        w("Пусто — модель сервиса по умолчанию.", "Empty — the service's default model."))
                .add("TEACHERBOX_AI_BASE_URL", w("Адрес API", "API address"), URL,
                        w("Для openai-compatible обязателен.", "Required for openai-compatible."))
                .add("TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT", w("Токенов в месяц", "Tokens per month"), NUMBER,
                        w("0 — без ограничения.", "0 — no limit."))
                .add("TEACHERBOX_AI_PROXY", w("Прокси", "Proxy"), PROXY,
                        w("Сервисы ИИ недоступны из России напрямую.", "AI services can't be reached from Russia directly."))
                .choice("TEACHERBOX_AI_EFFORT", w("Усилие (только Anthropic)", "Effort (Anthropic only)"),
                        w("Пусто — по умолчанию модели.", "Empty — the model's default."),
                        List.of("low", "medium", "high", "xhigh", "max"))
                .add("TEACHERBOX_AI_FALLBACKS",
                        w("Запасная модель при отказе (только Anthropic)", "Fallback model on refusal (Anthropic only)"),
                        BOOLEAN, NONE)
                .add("TEACHERBOX_AI_MAX_TOKENS", w("Токенов в ответе", "Tokens per answer"), NUMBER, NONE)
                .add("TEACHERBOX_AI_TIMEOUT", w("Время ожидания ответа", "Answer timeout"), DURATION,
                        w("Например 120s.", "E.g. 120s."));

        b.group("sessions", w("Сеансы и вход", "Sessions and sign-in"))
                .add("TEACHERBOX_IDENTITY_ACCESS_TOKEN_TTL", w("Токен доступа действует", "Access token is valid for"),
                        DURATION, w("Например 15m.", "E.g. 15m."))
                .add("TEACHERBOX_IDENTITY_REFRESH_TOKEN_TTL", w("Вход помнится", "Sign-in is remembered for"), DURATION,
                        w("Например 30d.", "E.g. 30d."))
                .add("TEACHERBOX_IDENTITY_INVITE_TTL", w("Приглашение действует", "Invitation is valid for"), DURATION,
                        w("Например 7d.", "E.g. 7d."))
                .add("TEACHERBOX_IDENTITY_MAX_FAILED_LOGINS",
                        w("Неудачных входов до блокировки", "Failed sign-ins before a lock"), NUMBER, NONE)
                .add("TEACHERBOX_IDENTITY_LOCK_DURATION",
                        w("Блокировка после неудачных входов", "Lock after failed sign-ins"), DURATION,
                        w("Например 15m.", "E.g. 15m."))
                .secret("TEACHERBOX_SECURITY_JWT_SECRET", w("Секрет токенов доступа", "Access token secret"),
                        w("Не короче 32 символов; после смены всем нужно войти заново.",
                                "At least 32 characters; after a change everyone signs in again."))
                .add("TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_REQUESTS",
                        w("Попыток входа за период", "Sign-in attempts per period"), NUMBER,
                        w("0 — без ограничения.", "0 — no limit."))
                .add("TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_PERIOD",
                        w("Период подсчёта попыток", "Period of counting attempts"), DURATION,
                        w("Например 1m.", "E.g. 1m."));

        b.group("backups", w("Резервные копии", "Backups"))
                .add("TEACHERBOX_BACKUP_CRON", w("Расписание копий", "Backup schedule"), CRON,
                        w("Cron из 6 частей, например 0 30 3 * * * (каждую ночь в 3:30); - — выключить.",
                                "Cron of 6 parts, e.g. 0 30 3 * * * (every night at 3:30); - — off."))
                .add("TEACHERBOX_BACKUP_KEEP_DAYS", w("Сколько дней хранить копии", "Days to keep backups"), NUMBER,
                        w("Более старые копии удаляются после новой — на сервере и в Google Диске; по умолчанию 14.",
                                "Older backups are deleted after a new one, on the server and in Google Drive; "
                                        + "14 by default."))
                .add("TEACHERBOX_BACKUP_RESTART", w("Перезапуск после восстановления", "Restart after a restore"),
                        BOOLEAN, w("true в Docker; false — перезапускать портал вручную.",
                                "true in Docker; false — restart the portal by hand."))
                .add("TEACHERBOX_BACKUP_GOOGLE_CLIENT_ID",
                        w("Google Диск: идентификатор клиента OAuth", "Google Drive: OAuth client ID"), TEXT,
                        w("Копии в Google Диске учителя. Можно ввести и в «Настройках» учителя; эта переменная важнее.",
                                "Copies in the teacher's Google Drive. Can also be entered in the teacher's “Settings”; "
                                        + "this variable wins."))
                .secret("TEACHERBOX_BACKUP_GOOGLE_CLIENT_SECRET",
                        w("Google Диск: секрет клиента OAuth", "Google Drive: OAuth client secret"))
                .add("TEACHERBOX_BACKUP_GOOGLE_PROXY", w("Google Диск: прокси", "Google Drive: proxy"), PROXY,
                        w("Если Google недоступен напрямую.", "If Google can't be reached directly."));

        b.group("log", w("Журнал", "Log"))
                .choice("LOGGING_STRUCTURED_FORMAT_CONSOLE", w("Формат журнала в консоли", "Console log format"),
                        w("Пусто — обычный текст; JSON для сборщиков журналов.",
                                "Empty — plain text; JSON for log collectors."),
                        List.of("ecs", "logstash", "gelf"))
                .add("LOGGING_LOGBACK_ROLLINGPOLICY_MAX_FILE_SIZE", w("Размер файла журнала", "Log file size"),
                        DATA_SIZE, w("Например 10MB.", "E.g. 10MB."))
                .add("LOGGING_LOGBACK_ROLLINGPOLICY_TOTAL_SIZE_CAP",
                        w("Все файлы журнала не больше", "All log files at most"), DATA_SIZE,
                        w("Например 100MB.", "E.g. 100MB."))
                .add("LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY", w("Дней журнала хранить", "Days of log to keep"),
                        NUMBER, NONE);

        b.group("accounts", w("Учётные записи", "Accounts"))
                .account("TEACHERBOX_IDENTITY_TEACHER_LOGIN", w("Логин учителя", "Teacher's login"), false)
                .account("TEACHERBOX_IDENTITY_TEACHER_PASSWORD", w("Пароль учителя", "Teacher's password"), true)
                .account("TEACHERBOX_IDENTITY_TEACHER_NAME", w("Имя учителя", "Teacher's name"), false)
                .account("TEACHERBOX_IDENTITY_TEACHER_RESET_PASSWORD",
                        w("Сброс пароля учителя", "Teacher's password reset"), false)
                .account("TEACHERBOX_IDENTITY_ADMIN_LOGIN", w("Логин администратора", "Administrator's login"), false)
                .account("TEACHERBOX_IDENTITY_ADMIN_PASSWORD", w("Пароль администратора", "Administrator's password"),
                        true);

        b.group("docker", w("Docker", "Docker"))
                .docker("TEACHERBOX_HTTP_PORT", w("Порт веб-интерфейса на сервере", "Web interface port on the server"),
                        NUMBER)
                .docker("TEACHERBOX_DOMAIN", w("Домен портала для HTTPS (Caddy)", "Portal domain for HTTPS (Caddy)"),
                        TEXT)
                .docker("TEACHERBOX_VERSION", w("Версия образа", "Image version"), TEXT)
                .docker("TEACHERBOX_MEMORY_LIMIT", w("Память контейнера", "Container memory"), TEXT)
                .docker("TEACHERBOX_CPU_LIMIT", w("Процессоры контейнера", "Container CPUs"), TEXT)
                .docker("JAVA_TOOL_OPTIONS", w("Параметры Java", "Java options"), TEXT)
                .docker("COMPOSE_PROFILES", w("Профили Compose (calls — звонки)", "Compose profiles (calls — video calls)"),
                        TEXT)
                .docker("TEACHERBOX_LIVEKIT_USE_EXTERNAL_IP",
                        w("LiveKit: искать публичный IP через STUN", "LiveKit: find the public IP through STUN"), TEXT)
                .docker("TEACHERBOX_LIVEKIT_NODE_IP", w("LiveKit: публичный IP сервера", "LiveKit: server's public IP"),
                        TEXT)
                .docker("TEACHERBOX_LIVEKIT_MEMORY_LIMIT", w("LiveKit: память контейнера", "LiveKit: container memory"),
                        TEXT)
                .docker("TEACHERBOX_LIVEKIT_CPU_LIMIT", w("LiveKit: процессоры контейнера", "LiveKit: container CPUs"),
                        TEXT);

        return List.copyOf(b.settings);
    }

    private static Wording w(String ru, String en) {
        return new Wording(ru, en);
    }

    private static final class Builder {

        private static final Wording DOCKER_ONLY = w("Docker Compose читает её до запуска портала: меняется только в .env.",
                "Docker Compose reads it before the portal starts: it changes only in .env.");
        private static final Wording IN_MY_ACCOUNT = w("Учётные записи меняются в «Мой аккаунт».",
                "Accounts are changed in “My account”.");

        private final List<SettingDefinition> settings = new ArrayList<>();
        private String section = "";
        private Wording group = NONE;

        Builder group(String key, Wording name) {
            section = key;
            group = name;
            return this;
        }

        Builder add(String name, Wording title, SettingKind kind, Wording hint) {
            return put(name, title, hint, kind, List.of(), false, EDITABLE);
        }

        Builder choice(String name, Wording title, Wording hint, List<String> choices) {
            return put(name, title, hint, CHOICE, choices, false, EDITABLE);
        }

        Builder secret(String name, Wording title) {
            return secret(name, title, NONE);
        }

        Builder secret(String name, Wording title, Wording hint) {
            return put(name, title, hint, TEXT, List.of(), true, EDITABLE);
        }

        /** A secret that Docker Compose also passes to another container: read-only in the UI. */
        Builder dockerSecret(String name, Wording title) {
            return put(name, title, DOCKER_ONLY, TEXT, List.of(), true, DOCKER);
        }

        Builder docker(String name, Wording title, SettingKind kind) {
            return put(name, title, DOCKER_ONLY, kind, List.of(), false, DOCKER);
        }

        Builder account(String name, Wording title, boolean secret) {
            return put(name, title, IN_MY_ACCOUNT, TEXT, List.of(), secret, ACCOUNT);
        }

        private Builder put(String name, Wording title, Wording hint, SettingKind kind, List<String> choices,
                boolean secret, Access access) {
            settings.add(new SettingDefinition(name, section, group, title, hint, kind, choices, secret, access));
            return this;
        }
    }
}
