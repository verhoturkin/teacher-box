/**
 * Parts of the settings feature that other features embed: the backups card (also in the
 * administrator area). Pages are loaded lazily through index.ts.
 */
export { BackupsCard } from './backups/backups-card';
export { BackupsApi } from './backups/backups-api';
export type { BackupInfo } from './data-access/settings.models';

export { DrivePanel } from './backups/drive-panel';
export { DriveStore } from './backups/drive-store';
