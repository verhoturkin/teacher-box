export type MessengerType = 'TELEGRAM' | 'VK' | 'MAX';

/** Why a backup was made. */
export type BackupKind = 'SCHEDULED' | 'MANUAL' | 'BEFORE_RESTORE' | 'BEFORE_RESET';

/** Mirrors `BackupInfo` of the backend. */
export interface BackupInfo {
  readonly name: string;
  /** Bytes. */
  readonly size: number;
  readonly createdAt: string;
  /** `null` for backups made before version 0.3. */
  readonly kind: BackupKind | null;
  /** Version of the portal that made it. */
  readonly version: string | null;
}

/** What the server does with the Google Drive in the background. */
export interface DriveRunning {
  readonly task: 'UPLOAD' | 'DOWNLOAD';
  /** The backup's file name. */
  readonly name: string;
}

/** Mirrors `DriveStatus` of the backend (ADR-0037). */
export interface DriveStatus {
  readonly clientConfigured: boolean;
  /** The OAuth client comes from environment variables and cannot be changed here. */
  readonly clientFromEnvironment: boolean;
  readonly clientId: string | null;
  readonly connected: boolean;
  /** Address of the Google account. */
  readonly account: string | null;
  readonly connectedAt: string | null;
  readonly lastUploadAt: string | null;
  readonly lastUploadName: string | null;
  /** Why the last upload or download failed, or why the connection was lost. */
  readonly lastError: string | null;
  readonly running: DriveRunning | null;
  /** Path of the redirect URI to register in Google Cloud. */
  readonly callbackPath: string;
}

/** Mirrors `CloudBackup` of the backend: a backup in the Google Drive. */
export interface CloudBackup {
  readonly id: string;
  readonly name: string;
  /** Bytes. */
  readonly size: number;
  readonly createdAt: string | null;
}

/** Mirrors `RestoreRequested` of the backend. */
export interface RestoreRequested {
  readonly archive: string;
  /** The backup of the state before restoring. */
  readonly safetyBackup: string;
  /** The portal restarts by itself; otherwise it has to be restarted by hand. */
  readonly restarting: boolean;
}

/** Mirrors `ResetResult` of the backend. */
export interface ResetResult {
  /** The backup with the data before the reset. */
  readonly backup: string;
  /** What the teacher should do by hand. */
  readonly hints: string[];
}

/** Mirrors `LastRestore` of the backend. */
export interface LastRestore {
  readonly restored: boolean;
  readonly archive: string;
  readonly at: string;
  readonly error: string | null;
}

/** Mirrors `RestoreStatus` of the backend. */
export interface RestoreStatus {
  /** When the running portal started: a new value means it has restarted. */
  readonly startedAt: string;
  readonly restartEnabled: boolean;
  /** An archive waiting for the next start. */
  readonly pending: string | null;
  readonly lastRestore: LastRestore | null;
}

export interface FailedDelivery {
  readonly recipientId: string;
  /** `null` for the teacher. */
  readonly recipientName: string | null;
  readonly channel: MessengerType;
  readonly attempts: number;
  readonly error: string | null;
  readonly text: string;
  readonly createdAt: string;
}

/** `PENDING` until the first request to the messenger API completes. */
export type MessengerConnection = 'PENDING' | 'OK' | 'ERROR';

/** Mirrors `MessengerStatus` of the backend. */
export interface MessengerStatus {
  readonly channel: MessengerType;
  readonly connection: MessengerConnection;
  /** Why the latest request failed. */
  readonly error: string | null;
  readonly checkedAt: string | null;
}

/** Mirrors `NotificationsStatus` of the backend. */
export interface NotificationsStatus {
  /** Messengers configured on the server. */
  readonly channels: MessengerStatus[];
  readonly failedDeliveries: FailedDelivery[];
}
