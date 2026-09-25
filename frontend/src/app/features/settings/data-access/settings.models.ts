export type MessengerType = 'TELEGRAM' | 'VK' | 'MAX';

/** Mirrors `BackupInfo` of the backend. */
export interface BackupInfo {
  readonly name: string;
  /** Bytes. */
  readonly size: number;
  readonly createdAt: string;
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

/** Mirrors `NotificationsStatus` of the backend. */
export interface NotificationsStatus {
  /** Messengers configured on the server. */
  readonly channels: MessengerType[];
  readonly failedDeliveries: FailedDelivery[];
}
