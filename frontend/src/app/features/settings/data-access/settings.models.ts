export type MessengerType = 'TELEGRAM' | 'VK' | 'MAX';

/** Why a backup was made. */
export type BackupKind = 'SCHEDULED' | 'MANUAL' | 'BEFORE_RESTORE' | 'BEFORE_RESET';

/** Mirrors `BackupInfo` of the backend. */
export interface BackupInfo {
  readonly name: string;
  /** Bytes. */
  readonly size: number;
  readonly createdAt: string;
  /** `null` for backups made before version 1.3. */
  readonly kind: BackupKind | null;
  /** Version of the portal that made it. */
  readonly version: string | null;
}

/** Mirrors `RestoreRequested` of the backend. */
export interface RestoreRequested {
  readonly archive: string;
  /** The backup of the state before restoring. */
  readonly safetyBackup: string;
  /** The portal restarts by itself; otherwise it has to be restarted by hand. */
  readonly restarting: boolean;
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
