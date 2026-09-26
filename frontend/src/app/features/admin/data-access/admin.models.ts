/** Mirrors the administrator's API (`/api/admin/**`, ADR-0010). */

export type LogLevelName = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/** One line of the server log. */
export interface LogEntry {
  readonly timestamp: string;
  readonly level: string;
  readonly logger: string;
  readonly message: string;
  /** Code of the request the line belongs to. */
  readonly requestId: string | null;
  readonly thread: string | null;
  /** Stack trace of the logged exception. */
  readonly error: string | null;
}

export interface LogResult {
  /** Newest first. */
  readonly entries: LogEntry[];
  /** More lines matched than the limit. */
  readonly truncated: boolean;
  /** The log is written to files. */
  readonly available: boolean;
}

export interface LogQuery {
  readonly from: string | null;
  readonly level: LogLevelName | null;
  readonly logger: string | null;
  readonly text: string | null;
  readonly requestId: string | null;
  readonly limit: number;
}

export interface LoggerLevel {
  readonly name: string;
  /** Set explicitly (`null`: inherited). */
  readonly configuredLevel: string | null;
  readonly effectiveLevel: string;
  /** When a temporary level ends. */
  readonly revertAt: string | null;
}

export interface SystemStatus {
  readonly version: string | null;
  readonly builtAt: string | null;
  readonly startedAt: string;
  /** Seconds. */
  readonly uptime: number;
  readonly javaVersion: string;
  readonly timeZone: string;
  readonly dataDir: string;
  /** Bytes. */
  readonly heapUsed: number;
  readonly heapMax: number;
  readonly diskFree: number;
  readonly diskTotal: number;
  readonly dataSize: number;
  readonly logsSize: number;
  readonly health: string;
  /** Health component → status, e.g. `db → UP`. */
  readonly components: Readonly<Record<string, string>>;
}

/** A domain event a listener has not processed yet (no content, only its type). */
export interface EventPublication {
  readonly id: string;
  readonly eventType: string;
  readonly listener: string;
  readonly publishedAt: string;
  readonly status: string;
  readonly attempts: number;
}

/** A given up delivery to a messenger, without the text and the name. */
export interface FailedDelivery {
  readonly id: string;
  readonly recipientId: string;
  readonly channel: string;
  readonly attempts: number;
  readonly error: string | null;
  readonly createdAt: string;
}

export type IntegrationState = 'OK' | 'FAILED' | 'NOT_CONFIGURED';

export interface IntegrationStatus {
  readonly name: string;
  readonly state: IntegrationState;
  readonly detail: string;
  readonly millis: number;
}

export interface AiStatus {
  readonly enabled: boolean;
  readonly provider: string | null;
  readonly model: string | null;
  readonly usedThisMonth: number;
  /** `0`: no limit. */
  readonly monthlyTokenLimit: number;
  readonly limitReached: boolean;
}

/** An AI request: metadata only. */
export interface AiRequest {
  readonly feature: string;
  readonly model: string;
  readonly status: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly durationMs: number;
  readonly error: string | null;
  readonly createdAt: string;
}

export interface AiUsage {
  /** `yyyy-MM`. */
  readonly month: string;
  readonly usedTokens: number;
  readonly monthlyTokenLimit: number;
  readonly recent: AiRequest[];
}
