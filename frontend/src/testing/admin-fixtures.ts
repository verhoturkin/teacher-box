import {
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
  return { name: 'ru.teacherbox', configuredLevel: null, effectiveLevel: 'INFO', revertAt: null, ...overrides };
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
    ...overrides,
  };
}
