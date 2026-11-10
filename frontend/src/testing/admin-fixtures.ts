import {
  AdminSetting,
  AdminSettings,
  AiStatus,
  AiUsage,
  EventPublication,
  FailedDelivery,
  LogEntry,
  LogResult,
  LoggerLevel,
  SystemStatus,
} from '@features/admin/data-access/admin.models';

export function logEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: '2026-09-26T10:00:00Z',
    level: 'ERROR',
    logger: 'ru.teacherbox.platform.web.ProblemDetailsAdvice',
    message: 'Unhandled exception',
    requestId: 'k3m9x2ab7c',
    thread: 'tomcat-handler-1',
    error: 'java.lang.IllegalStateException: boom',
    ...overrides,
  };
}

export function logResult(entries: LogEntry[], overrides: Partial<LogResult> = {}): LogResult {
  return { entries, truncated: false, available: true, ...overrides };
}

export function loggerLevel(overrides: Partial<LoggerLevel> = {}): LoggerLevel {
  return {
    name: 'ru.teacherbox',
    configuredLevel: null,
    effectiveLevel: 'INFO',
    revertAt: null,
    ...overrides,
  };
}

export function systemStatus(overrides: Partial<SystemStatus> = {}): SystemStatus {
  return {
    version: '1.1.0',
    builtAt: '2026-09-26T10:00:00Z',
    startedAt: '2026-09-24T10:00:00Z',
    uptime: 2 * 86_400 + 3 * 3_600,
    javaVersion: '25.0.1',
    timeZone: 'Europe/Moscow',
    dataDir: '/data',
    heapUsed: 100 * 1024 * 1024,
    heapMax: 512 * 1024 * 1024,
    diskFree: 20 * 1024 * 1024 * 1024,
    diskTotal: 100 * 1024 * 1024 * 1024,
    dataSize: 5 * 1024 * 1024,
    logsSize: 1024 * 1024,
    health: 'UP',
    components: { db: 'UP', diskSpace: 'UP' },
    ...overrides,
  };
}

export function eventPublication(overrides: Partial<EventPublication> = {}): EventPublication {
  return {
    id: 'e-1',
    eventType: 'HomeworkSubmitted',
    listener: 'ru.teacherbox.notifications.application.HomeworkNotifications.on',
    publishedAt: '2026-09-26T09:00:00Z',
    status: 'FAILED',
    attempts: 3,
    ...overrides,
  };
}

export function failedDelivery(overrides: Partial<FailedDelivery> = {}): FailedDelivery {
  return {
    id: 'd-1',
    recipientId: 's-1',
    channel: 'TELEGRAM',
    attempts: 5,
    error: 'Forbidden: bot was blocked by the user',
    createdAt: '2026-09-26T09:00:00Z',
    ...overrides,
  };
}

export function aiStatus(overrides: Partial<AiStatus> = {}): AiStatus {
  return {
    enabled: true,
    provider: 'anthropic',
    model: 'claude-opus-5',
    usedThisMonth: 12_000,
    monthlyTokenLimit: 1_000_000,
    limitReached: false,
    ...overrides,
  };
}

export function aiUsage(overrides: Partial<AiUsage> = {}): AiUsage {
  return {
    month: '2026-09',
    usedTokens: 12_000,
    monthlyTokenLimit: 1_000_000,
    recent: [
      {
        feature: 'HOMEWORK_DRAFT',
        model: 'claude-opus-5',
        status: 'SUCCEEDED',
        inputTokens: 420,
        outputTokens: 180,
        durationMs: 1_500,
        error: null,
        createdAt: '2026-09-26T09:00:00Z',
      },
      {
        feature: 'REVIEW_DRAFT',
        model: 'claude-opus-5',
        status: 'FAILED',
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 300,
        error: 'Anthropic API 529: Overloaded',
        createdAt: '2026-09-26T08:00:00Z',
      },
    ],
    moreRecent: false,
    ...overrides,
  };
}

export function adminSetting(overrides: Partial<AdminSetting> = {}): AdminSetting {
  return {
    name: 'TEACHERBOX_HOMEWORK_MAX_FILE_SIZE',
    section: 'homework',
    group: 'Домашние задания',
    title: 'Наибольший размер файла',
    hint: 'Например 20MB; больше 25MB сервер не примет.',
    kind: 'DATA_SIZE',
    choices: [],
    secret: false,
    access: 'EDITABLE',
    owner: 'ADMIN',
    live: true,
    source: 'DEFAULT',
    value: null,
    set: false,
    schedule: null,
    ...overrides,
  };
}

/** A read-only setting of `.env` alone. */
function envOnly(overrides: Partial<AdminSetting>): AdminSetting {
  return adminSetting({ access: 'ENV', owner: 'ENV_ONLY', live: false, ...overrides });
}

export function adminSettings(overrides: Partial<AdminSettings> = {}): AdminSettings {
  return {
    settings: [
      adminSetting(),
      adminSetting({
        name: 'TEACHERBOX_HOMEWORK_MAX_FILES_PER_UPLOAD',
        title: 'Файлов за одну отправку',
        hint: '',
        kind: 'NUMBER',
        source: 'ADMIN',
        value: '10',
        set: true,
      }),
      adminSetting({
        name: 'TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY',
        section: 'notifications',
        group: 'Уведомления и боты',
        title: 'Telegram: прокси',
        hint: 'Если Telegram заблокирован в сети сервера.',
        kind: 'PROXY',
        source: 'ENVIRONMENT',
        value: 'socks5://host.docker.internal:1080',
        set: true,
      }),
      adminSetting({
        name: 'TEACHERBOX_AI_PROXY',
        section: 'ai',
        group: 'ИИ-помощник',
        title: 'Прокси',
        hint: 'Сервисы ИИ недоступны из России напрямую.',
        kind: 'PROXY',
        live: false,
      }),
      adminSetting({
        name: 'TEACHERBOX_IDENTITY_REFRESH_TOKEN_TTL',
        section: 'sessions',
        group: 'Сеансы и вход',
        title: 'Вход помнится',
        hint: 'Например 30d.',
        kind: 'DURATION',
      }),
      adminSetting({
        name: 'TEACHERBOX_NOTIFICATIONS_LINK_CODE_TTL',
        section: 'notifications',
        group: 'Уведомления и боты',
        title: 'Код подключения мессенджера действует',
        hint: 'Например 15m.',
        kind: 'DURATION',
      }),
      adminSetting({
        name: 'TEACHERBOX_EXTRA',
        section: 'extra',
        group: 'Другое',
        title: 'Новая настройка',
        hint: '',
        kind: 'BOOLEAN',
      }),
      adminSetting({
        name: 'TEACHERBOX_BACKUP_CRON',
        section: 'backups',
        group: 'Резервные копии',
        title: 'Расписание копий',
        hint: 'Cron из 6 частей; - — выключить.',
        kind: 'CRON',
        schedule: { enabled: true, time: '03:30' },
      }),
      adminSetting({
        name: 'TEACHERBOX_BACKUP_KEEP_DAYS',
        section: 'backups',
        group: 'Резервные копии',
        title: 'Сколько дней хранить копии',
        hint: '',
        kind: 'NUMBER',
        source: 'ADMIN',
        value: '14',
        set: true,
      }),
      adminSetting({
        name: 'TEACHERBOX_BOARDS_BACKUP_CRON',
        section: 'boards',
        group: 'Доски',
        title: 'Расписание копий досок',
        hint: '',
        kind: 'CRON',
        source: 'ENVIRONMENT',
        value: '0 0 3 * * MON',
        set: true,
      }),
      envOnly({
        name: 'TEACHERBOX_HTTP_PORT',
        section: 'docker',
        group: 'Docker',
        title: 'Порт веб-интерфейса на сервере',
        hint: 'Docker Compose читает её до запуска портала: меняется только в .env.',
        kind: 'NUMBER',
        access: 'DOCKER',
        source: 'ENVIRONMENT',
        value: '8080',
        set: true,
      }),
      envOnly({
        name: 'TEACHERBOX_IDENTITY_TEACHER_PASSWORD',
        section: 'accounts',
        group: 'Учётные записи',
        title: 'Пароль учителя',
        hint: 'Учётные записи меняются в «Мой аккаунт».',
        kind: 'TEXT',
        secret: true,
        access: 'ACCOUNT',
        source: 'ENVIRONMENT',
        set: true,
      }),
      envOnly({
        name: 'TEACHERBOX_SECURITY_JWT_SECRET',
        section: 'sessions',
        group: 'Сеансы и вход',
        title: 'Секрет токенов доступа',
        hint: '',
        kind: 'TEXT',
        secret: true,
      }),
      envOnly({
        name: 'LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY',
        section: 'log',
        group: 'Журнал',
        title: 'Дней журнала хранить',
        hint: '',
        kind: 'NUMBER',
        source: 'ADMIN',
        value: '9',
        set: true,
      }),
    ],
    moved: [],
    restartEnabled: true,
    restartNeeded: false,
    startedAt: '2026-09-28T09:00:00Z',
    ...overrides,
  };
}
