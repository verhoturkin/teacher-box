import { Injectable, computed, inject, signal } from '@angular/core';
import { CloudBackup, DriveStatus } from '../data-access/settings.models';
import { BackupsApi } from './backups-api';

/** How often the state is asked again while an upload or a download runs. */
export const DRIVE_POLL_MS = 3000;

/**
 * The teacher's Google Drive for the backups (ADR-0037), shared by the backups card and the Drive
 * panel: the connection, the copies there and what runs in the background. While something runs, the
 * state is asked again every few seconds; when a copy has come to the server, `arrived` grows.
 */
@Injectable({ providedIn: 'root' })
export class DriveStore {
  private readonly api = inject(BackupsApi);

  readonly status = signal<DriveStatus | null>(null);
  readonly files = signal<CloudBackup[]>([]);
  readonly connected = computed(() => this.status()?.connected === true);
  /** Names of the backups that are in the Drive. */
  readonly names = computed<ReadonlySet<string>>(
    () => new Set(this.files().map((file) => file.name)),
  );
  /** Names of the backups on the server, told by the backups card. */
  readonly local = signal<ReadonlySet<string>>(new Set());
  /** Grows each time a copy from the Drive has come to the server. */
  readonly arrived = signal(0);

  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Asks the state (and the copies, once connected); keeps asking while something runs. */
  load(): void {
    this.cancel();
    const before = this.status()?.running ?? null;
    this.api.driveStatus().subscribe((status) => {
      this.status.set(status);
      if (before !== null && status.running === null) {
        if (before.task === 'DOWNLOAD') {
          this.arrived.update((count) => count + 1);
        }
      }
      if (status.connected) {
        this.loadFiles();
      } else {
        this.files.set([]);
      }
      if (status.running !== null) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.load();
        }, DRIVE_POLL_MS);
      }
    });
  }

  loadFiles(): void {
    this.api.driveFiles().subscribe((files) => {
      this.files.set(files);
    });
  }

  /** Stops asking (the page is left). */
  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
