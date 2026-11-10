package ru.teacherbox.platform.settings;

import static ru.teacherbox.platform.settings.SettingDefinition.Access.ACCOUNT;
import static ru.teacherbox.platform.settings.SettingDefinition.Access.DOCKER;
import static ru.teacherbox.platform.settings.SettingDefinition.Access.EDITABLE;
import static ru.teacherbox.platform.settings.SettingDefinition.Access.ENV;
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
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import ru.teacherbox.platform.settings.SettingDefinition.Access;
import ru.teacherbox.platform.settings.SettingDefinition.Owner;

/**
 * Every variable the portal reads with its section and description (ADR-0016), in each language of the
 * interface (ADR-0036). The teacher's settings (ADR-0056) stay here so that an old value can be imported
 * and the administrator sees which variables are no longer theirs; the rest are {@code .env.example}.
 */
public final class SettingsCatalog {

    /** No hint. */
    private static final Wording NONE = new Wording("", "");

    /** The teacher's settings: they move into the portal (ADR-0056). */
    static final Set<String> TEACHER = Set.of(
            "TEACHERBOX_PUBLIC_URL", "TEACHERBOX_TIMEZONE",
            "TEACHERBOX_BILLING_CURRENCY", "TEACHERBOX_BILLING_DEFAULT_LESSON_DURATION",
            "TEACHERBOX_HOMEWORK_DUE_SOON_WINDOW",
            "TEACHERBOX_SCHEDULE_DEFAULT_DURATION", "TEACHERBOX_SCHEDULE_HORIZON",
            "TEACHERBOX_SCHEDULE_LATE_CANCELLATION", "TEACHERBOX_SCHEDULE_REMINDERS",
            "TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_ID", "TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_SECRET",
            "TEACHERBOX_NOTIFICATIONS_TELEGRAM_BOT_TOKEN", "TEACHERBOX_NOTIFICATIONS_VK_TOKEN",
            "TEACHERBOX_NOTIFICATIONS_VK_GROUP_ID", "TEACHERBOX_NOTIFICATIONS_MAX_TOKEN",
            "TEACHERBOX_AI_PROVIDER", "TEACHERBOX_AI_API_KEY", "TEACHERBOX_AI_MODEL", "TEACHERBOX_AI_BASE_URL",
            "TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT", "TEACHERBOX_AI_EFFORT", "TEACHERBOX_AI_FALLBACKS",
            "TEACHERBOX_AI_MAX_TOKENS", "TEACHERBOX_AI_TIMEOUT",
            "TEACHERBOX_IDENTITY_TEACHER_NAME",
            "TEACHERBOX_BACKUP_GOOGLE_CLIENT_ID", "TEACHERBOX_BACKUP_GOOGLE_CLIENT_SECRET");

    /**
     * The administrator's settings that apply at once: their consumers read them through
     * {@code shared.settings.LiveProperties} on every call (ADR-0056).
     */
    static final Set<String> LIVE = Set.of(
            "TEACHERBOX_HOMEWORK_MAX_FILE_SIZE", "TEACHERBOX_HOMEWORK_MAX_FILES_PER_UPLOAD",
            "TEACHERBOX_HOMEWORK_YOUTUBE_PROXY", "TEACHERBOX_SCHEDULE_GOOGLE_PROXY",
            "TEACHERBOX_BOARDS_BACKUP_CRON", "TEACHERBOX_BOARDS_BACKUP_KEEP",
            "TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY", "TEACHERBOX_NOTIFICATIONS_TELEGRAM_API_URL",
            "TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS", "TEACHERBOX_NOTIFICATIONS_LINK_CODE_TTL",
            "TEACHERBOX_NOTIFICATIONS_WEBPUSH_SUBJECT",
            "TEACHERBOX_IDENTITY_ACCESS_TOKEN_TTL", "TEACHERBOX_IDENTITY_REFRESH_TOKEN_TTL",
            "TEACHERBOX_IDENTITY_INVITE_TTL", "TEACHERBOX_IDENTITY_MAX_FAILED_LOGINS",
            "TEACHERBOX_IDENTITY_LOCK_DURATION",
            "TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_REQUESTS", "TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_PERIOD",
            "TEACHERBOX_BACKUP_CRON", "TEACHERBOX_BACKUP_KEEP_DAYS", "TEACHERBOX_BACKUP_GOOGLE_PROXY");

    /**
     * The crons in force when their variable is not set, as the jobs ({@code shared.time.ZonedJob}) define
     * them: the interface shows the schedule of an unset setting by them.
     */
    static final Map<String, String> DEFAULT_CRONS = Map.of(
            "TEACHERBOX_BACKUP_CRON", "0 30 3 * * *",
            "TEACHERBOX_BOARDS_BACKUP_CRON", "0 0 3 * * *");
    private static final List<SettingDefinition> ALL = build();

    private SettingsCatalog() {
    }

    /** By section as in {@code .env.example}; what cannot be changed here comes last. */
    public static List<SettingDefinition> all() {
        return ALL;
    }

    /** The cron of a {@link SettingKind#CRON} setting when it is not set. */
    public static Optional<String> defaultCron(String name) {
        return Optional.ofNullable(DEFAULT_CRONS.get(name));
    }

    public static Optional<SettingDefinition> find(String name) {
        return ALL.stream().filter(setting -> setting.name().equals(name)).findFirst();
    }

    private static List<SettingDefinition> build() {
        Builder b = new Builder();

        b.group("portal", w("Портал", "Portal"))
                .add("TEACHERBOX_PUBLIC_URL", w("Адрес портала", "Portal address"), ADDRESS,
                        w("Теперь задаётся в «Настройки» → «Портал»; без него ссылки начинаются с https://<домен портала>.",
                                "Now set in “Settings” → “Portal”. Until it is set, links start with https://<portal domain>."))
                .add("TEACHERBOX_TIMEZONE", w("Часовой пояс учителя", "Teacher's time zone"), TIME_ZONE,
                        w("По нему считаются даты занятий и отчёты за месяц, например Europe/Moscow.",
                                "Time zone used for lesson dates and monthly reports, such as Europe/Moscow."));

        b.group("billing", w("Оплаты", "Payments"))
                .add("TEACHERBOX_BILLING_CURRENCY", w("Валюта", "Currency"), CURRENCY,
                        w("Код ISO 4217, например RUB.", "ISO 4217 code, e.g. RUB."))
                .add("TEACHERBOX_BILLING_DEFAULT_LESSON_DURATION",
                        w("Длительность занятия, минут", "Lesson length, minutes"), NUMBER, NONE);

        b.group("homework", w("Домашние задания", "Homework"))
                .add("TEACHERBOX_HOMEWORK_MAX_FILE_SIZE", w("Наибольший размер файла", "Maximum file size"), DATA_SIZE,
                        w("Например 20MB; больше 25MB сервер не примет.",
                                "E.g. 20MB; the server accepts at most 25MB."))
                .add("TEACHERBOX_HOMEWORK_MAX_FILES_PER_UPLOAD", w("Файлов за одну отправку", "Files per upload"),
                        NUMBER, NONE)
                .add("TEACHERBOX_HOMEWORK_DUE_SOON_WINDOW", w("Напоминание о сроке сдачи за", "Homework reminder lead time"),
                        DURATION, w("Например 24h.", "E.g. 24h."))
                .add("TEACHERBOX_HOMEWORK_YOUTUBE_PROXY", w("Прокси для субтитров YouTube", "Proxy for YouTube captions"),
                        PROXY, w("Из России YouTube замедлен; пусто — напрямую.",
                                "YouTube access is throttled in Russia. Leave blank to connect directly."));

        b.group("schedule", w("Расписание", "Schedule"))
                .add("TEACHERBOX_SCHEDULE_DEFAULT_DURATION",
                        w("Длительность занятия по умолчанию, минут", "Default lesson length, minutes"), NUMBER, NONE)
                .add("TEACHERBOX_SCHEDULE_HORIZON",
                        w("Регулярные занятия создаются вперёд на", "Recurring lesson scheduling window"), DURATION,
                        w("Например 84d.", "E.g. 84d."))
                .add("TEACHERBOX_SCHEDULE_LATE_CANCELLATION",
                        w("Поздняя отмена — позже чем за", "Late cancellation window"), DURATION,
                        w("Позднюю отмену учитель может засчитать как пропуск.",
                                "The teacher can mark a late cancellation as a missed lesson."))
                .add("TEACHERBOX_SCHEDULE_REMINDERS", w("Напоминания о занятии за", "Lesson reminder times"),
                        DURATIONS, w("Через запятую, например 24h,1h; пусто — без напоминаний.",
                                "Enter comma-separated durations, such as 24h,1h. Leave blank to disable reminders."))
                .add("TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_ID",
                        w("Google: идентификатор клиента OAuth", "Google: OAuth client ID"), TEXT,
                        w("Теперь вводится в «Настройках» учителя.", "Now entered in the teacher's Settings."))
                .secret("TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_SECRET",
                        w("Google: секрет клиента OAuth", "Google: OAuth client secret"))
                .add("TEACHERBOX_SCHEDULE_GOOGLE_PROXY", w("Google: прокси", "Google: proxy"), PROXY,
                        w("Если Google недоступен напрямую.", "If Google can't be reached directly."));

        b.group("meetings", w("Видеозвонки", "Video calls"))
                // the LiveKit container reads them from .env too, so they change only there
                .dockerSecret("TEACHERBOX_MEETINGS_LIVEKIT_API_KEY", w("LiveKit: ключ API", "LiveKit: API key"))
                .dockerSecret("TEACHERBOX_MEETINGS_LIVEKIT_API_SECRET",
                        w("LiveKit: секрет API (не короче 32 символов)", "LiveKit: API secret (at least 32 characters)"))
                .env("TEACHERBOX_MEETINGS_LIVEKIT_API_URL", w("LiveKit: адрес для портала", "LiveKit: server URL"),
                        URL, w("Браузеры всегда подключаются к <адрес портала>/livekit.",
                                "Browsers always connect to <portal address>/livekit."));

        b.group("boards", w("Доски", "Boards"))
                .add("TEACHERBOX_BOARDS_BACKUP_CRON", w("Расписание копий досок", "Board backup schedule"), CRON,
                        w("Ежедневная копия каждой изменённой доски, например 0 0 3 * * *; - — выключить.",
                                "Back up changed boards daily, for example 0 0 3 * * *. Use - to disable."))
                .add("TEACHERBOX_BOARDS_BACKUP_KEEP",
                        w("Сколько ежедневных копий доски хранить", "Daily backups to keep per board"), NUMBER,
                        w("Копии, сделанные учителем, не считаются.", "Backups created manually by the teacher don't count towards this limit."));

        b.group("notifications", w("Уведомления и боты", "Notifications and bots"))
                .secret("TEACHERBOX_NOTIFICATIONS_TELEGRAM_BOT_TOKEN", w("Telegram: токен бота", "Telegram: bot token"))
                .add("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY", w("Telegram: прокси", "Telegram: proxy"), PROXY,
                        w("Если Telegram заблокирован в сети сервера.", "Use a proxy if Telegram is blocked on the server's network."))
                .add("TEACHERBOX_NOTIFICATIONS_TELEGRAM_API_URL", w("Telegram: адрес Bot API", "Telegram: Bot API address"),
                        URL, w("Свой сервер Bot API вместо api.telegram.org.",
                                "Your own Bot API server instead of api.telegram.org."))
                .secret("TEACHERBOX_NOTIFICATIONS_VK_TOKEN", w("ВКонтакте: токен сообщества", "VK: community token"))
                .add("TEACHERBOX_NOTIFICATIONS_VK_GROUP_ID", w("ВКонтакте: номер сообщества", "VK: community ID"),
                        NUMBER, w("Число из адреса club<номер>.", "Numeric ID from the community address, club<ID>."))
                .secret("TEACHERBOX_NOTIFICATIONS_MAX_TOKEN", w("MAX: токен бота", "MAX: bot token"))
                .add("TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS", w("Попыток доставки сообщения", "Delivery attempts"),
                        NUMBER, NONE)
                .add("TEACHERBOX_NOTIFICATIONS_LINK_CODE_TTL",
                        w("Код подключения мессенджера действует", "Messaging app connection code lifetime"), DURATION,
                        w("Например 15m.", "E.g. 15m."))
                .add("TEACHERBOX_NOTIFICATIONS_WEBPUSH_SUBJECT",
                        w("Уведомления в браузере: контакт для push-сервисов", "Browser notifications: contact for push services"),
                        TEXT, w("mailto:адрес или https-адрес; пусто — адрес портала.",
                                "Enter a mailto: or HTTPS URL. Leave blank to use the portal URL."));

        b.group("ai", w("ИИ-помощник", "AI assistant"))
                .choice("TEACHERBOX_AI_PROVIDER", w("Сервис ИИ", "AI service"),
                        w("Пусто — ИИ выключен.", "Leave blank to disable AI."),
                        List.of("anthropic", "gemini", "openrouter", "deepseek", "openai-compatible"))
                .secret("TEACHERBOX_AI_API_KEY", w("Ключ API", "API key"))
                .add("TEACHERBOX_AI_MODEL", w("Модель", "Model"), TEXT,
                        w("Пусто — модель сервиса по умолчанию.", "Leave blank to use the provider's default model."))
                .add("TEACHERBOX_AI_BASE_URL", w("Адрес API", "API URL"), URL,
                        w("Для openai-compatible обязателен.", "Required for openai-compatible."))
                .add("TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT", w("Токенов в месяц", "Tokens per month"), NUMBER,
                        w("0 — без ограничения.", "Use 0 for no limit."))
                .add("TEACHERBOX_AI_PROXY", w("Прокси", "Proxy"), PROXY,
                        w("Сервисы ИИ недоступны из России напрямую.", "AI services can't be reached from Russia directly."))
                .choice("TEACHERBOX_AI_EFFORT", w("Усилие (только Anthropic)", "Effort (Anthropic only)"),
                        w("Пусто — по умолчанию модели.", "Leave blank to use the model's default."),
                        List.of("low", "medium", "high", "xhigh", "max"))
                .add("TEACHERBOX_AI_FALLBACKS",
                        w("Запасная модель при отказе (только Anthropic)", "Use a fallback model on refusal (Anthropic only)"),
                        BOOLEAN, NONE)
                .add("TEACHERBOX_AI_MAX_TOKENS", w("Токенов в ответе", "Maximum response tokens"), NUMBER, NONE)
                .add("TEACHERBOX_AI_TIMEOUT", w("Время ожидания ответа", "Response timeout"), DURATION,
                        w("Например 120s.", "E.g. 120s."));

        b.group("sessions", w("Сеансы и вход", "Sessions and sign-in"))
                .add("TEACHERBOX_IDENTITY_ACCESS_TOKEN_TTL", w("Токен доступа действует", "Access token lifetime"),
                        DURATION, w("Например 15m.", "E.g. 15m."))
                .add("TEACHERBOX_IDENTITY_REFRESH_TOKEN_TTL", w("Вход помнится", "Sign-in session lifetime"), DURATION,
                        w("Например 30d.", "E.g. 30d."))
                .add("TEACHERBOX_IDENTITY_INVITE_TTL", w("Приглашение действует", "Invitation link lifetime"), DURATION,
                        w("Например 7d.", "E.g. 7d."))
                .add("TEACHERBOX_IDENTITY_MAX_FAILED_LOGINS",
                        w("Неудачных входов до блокировки", "Failed sign-ins before lockout"), NUMBER, NONE)
                .add("TEACHERBOX_IDENTITY_LOCK_DURATION",
                        w("Блокировка после неудачных входов", "Sign-in lockout duration"), DURATION,
                        w("Например 15m.", "E.g. 15m."))
                .envSecret("TEACHERBOX_SECURITY_JWT_SECRET", w("Секрет токенов доступа", "Access token secret"),
                        w("Не короче 32 символов; после смены всем нужно войти заново.",
                                "At least 32 characters. Changing this signs everyone out."))
                .add("TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_REQUESTS",
                        w("Попыток входа за период", "Sign-in attempts per period"), NUMBER,
                        w("0 — без ограничения.", "Use 0 for no limit."))
                .add("TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_PERIOD",
                        w("Период подсчёта попыток", "Sign-in rate limit window"), DURATION,
                        w("Например 1m.", "E.g. 1m."));

        b.group("backups", w("Резервные копии", "Backups"))
                .add("TEACHERBOX_BACKUP_CRON", w("Расписание копий", "Backup schedule"), CRON,
                        w("Cron из 6 частей, например 0 30 3 * * * (каждую ночь в 3:30); - — выключить.",
                                "Six-field cron expression, such as 0 30 3 * * * (daily at 03:30). Use - to disable."))
                .add("TEACHERBOX_BACKUP_KEEP_DAYS", w("Сколько дней хранить копии", "Days to keep backups"), NUMBER,
                        w("Более старые копии удаляются после новой — на сервере и в Google Диске; по умолчанию 14.",
                                "After each backup, older backups are deleted from the server and Google Drive. Default: 14 days."))
                .env("TEACHERBOX_BACKUP_RESTART", w("Перезапуск после восстановления", "Restart after restore"),
                        BOOLEAN, w("true в Docker; false — перезапускать портал вручную.",
                                "Use true in Docker. With false, restart the portal manually after restoring."))
                .add("TEACHERBOX_BACKUP_GOOGLE_CLIENT_ID",
                        w("Google Диск: идентификатор клиента OAuth", "Google Drive: OAuth client ID"), TEXT,
                        w("Копии в Google Диске учителя. Теперь вводится в «Настройках» учителя.",
                                "Backups in the teacher's Google Drive. Now entered in the teacher's Settings."))
                .secret("TEACHERBOX_BACKUP_GOOGLE_CLIENT_SECRET",
                        w("Google Диск: секрет клиента OAuth", "Google Drive: OAuth client secret"))
                .add("TEACHERBOX_BACKUP_GOOGLE_PROXY", w("Google Диск: прокси", "Google Drive: proxy"), PROXY,
                        w("Если Google недоступен напрямую.", "If Google can't be reached directly."));

        b.group("log", w("Журнал", "Log"))
                .envChoice("LOGGING_STRUCTURED_FORMAT_CONSOLE", w("Формат журнала в консоли", "Console log format"),
                        w("Пусто — обычный текст; JSON для сборщиков журналов.",
                                "Leave blank for plain text. Select a JSON format when using a log collector."),
                        List.of("ecs", "logstash", "gelf"))
                .env("LOGGING_LOGBACK_ROLLINGPOLICY_MAX_FILE_SIZE", w("Размер файла журнала", "Log file size"),
                        DATA_SIZE, w("Например 10MB.", "E.g. 10MB."))
                .env("LOGGING_LOGBACK_ROLLINGPOLICY_TOTAL_SIZE_CAP",
                        w("Все файлы журнала не больше", "Maximum total log size"), DATA_SIZE,
                        w("Например 100MB.", "E.g. 100MB."))
                .env("LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY", w("Дней журнала хранить", "Log retention period (days)"),
                        NUMBER, NONE);

        b.group("accounts", w("Учётные записи", "Accounts"))
                .account("TEACHERBOX_IDENTITY_TEACHER_LOGIN", w("Логин учителя", "Teacher username"), false)
                .account("TEACHERBOX_IDENTITY_TEACHER_PASSWORD", w("Пароль учителя", "Teacher's password"), true)
                .add("TEACHERBOX_IDENTITY_TEACHER_NAME", w("Имя учителя", "Teacher's name"), TEXT, NONE)
                .account("TEACHERBOX_IDENTITY_TEACHER_RESET_PASSWORD",
                        w("Сброс пароля учителя", "Teacher's password reset"), false)
                .account("TEACHERBOX_IDENTITY_ADMIN_LOGIN", w("Логин администратора", "Administrator username"), false)
                .account("TEACHERBOX_IDENTITY_ADMIN_PASSWORD", w("Пароль администратора", "Administrator's password"),
                        true);

        b.group("docker", w("Docker", "Docker"))
                .docker("TEACHERBOX_HTTP_PORT", w("Порт веб-интерфейса на сервере", "Web interface port on the server"),
                        NUMBER)
                .docker("TEACHERBOX_DOMAIN", w("Домен портала для HTTPS (Caddy)", "Portal domain for HTTPS (Caddy)"),
                        TEXT)
                .docker("TEACHERBOX_VERSION", w("Версия образа", "Image version"), TEXT)
                .docker("TEACHERBOX_MEMORY_LIMIT", w("Память контейнера", "Container memory limit"), TEXT)
                .docker("TEACHERBOX_CPU_LIMIT", w("Процессоры контейнера", "Container CPU limit"), TEXT)
                .docker("JAVA_TOOL_OPTIONS", w("Параметры Java", "Java options"), TEXT)
                .docker("COMPOSE_PROFILES", w("Профили Compose (calls — звонки)", "Compose profiles (calls — video calls)"),
                        TEXT)
                .docker("TEACHERBOX_LIVEKIT_USE_EXTERNAL_IP",
                        w("LiveKit: искать публичный IP через STUN", "LiveKit: detect public IP using STUN"), TEXT)
                .docker("TEACHERBOX_LIVEKIT_NODE_IP", w("LiveKit: публичный IP сервера", "LiveKit: server's public IP"),
                        TEXT)
                .docker("TEACHERBOX_LIVEKIT_MEMORY_LIMIT", w("LiveKit: память контейнера", "LiveKit: container memory limit"),
                        TEXT)
                .docker("TEACHERBOX_LIVEKIT_CPU_LIMIT", w("LiveKit: процессоры контейнера", "LiveKit: container CPU limit"),
                        TEXT);

        return List.copyOf(b.settings);
    }

    private static Wording w(String ru, String en) {
        return new Wording(ru, en);
    }

    private static final class Builder {

        private static final Wording DOCKER_ONLY = w("Docker Compose читает её до запуска портала: меняется только в .env.",
                "Docker Compose reads this before the portal starts. Change it in .env.");
        private static final Wording IN_MY_ACCOUNT = w("Учётные записи меняются в «Мой аккаунт».",
                "Manage account details in “My account”.");

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
            return put(name, title, NONE, TEXT, List.of(), true, EDITABLE);
        }

        /** A secret that Docker Compose also passes to another container: read-only in the UI. */
        Builder dockerSecret(String name, Wording title) {
            return put(name, title, DOCKER_ONLY, TEXT, List.of(), true, DOCKER);
        }

        /** Only in {@code .env} (ADR-0056): read-only here, with its own hint. */
        Builder env(String name, Wording title, SettingKind kind, Wording hint) {
            return put(name, title, hint, kind, List.of(), false, ENV);
        }

        Builder envChoice(String name, Wording title, Wording hint, List<String> choices) {
            return put(name, title, hint, CHOICE, choices, false, ENV);
        }

        Builder envSecret(String name, Wording title, Wording hint) {
            return put(name, title, hint, TEXT, List.of(), true, ENV);
        }

        Builder docker(String name, Wording title, SettingKind kind) {
            return put(name, title, DOCKER_ONLY, kind, List.of(), false, DOCKER);
        }

        Builder account(String name, Wording title, boolean secret) {
            return put(name, title, IN_MY_ACCOUNT, TEXT, List.of(), secret, ACCOUNT);
        }

        private Builder put(String name, Wording title, Wording hint, SettingKind kind, List<String> choices,
                boolean secret, Access access) {
            Owner owner = access != Access.EDITABLE ? Owner.ENV_ONLY
                    : TEACHER.contains(name) ? Owner.TEACHER : Owner.ADMIN;
            settings.add(new SettingDefinition(name, section, group, title, hint, kind, choices, secret, access,
                    owner, LIVE.contains(name)));
            return this;
        }
    }
}
