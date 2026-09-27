import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';

export const DEFAULT_PORTAL_NAME = 'Teacher Box';

/** What every page knows about the portal (`/api/public/portal`). */
export interface PortalInfo {
  readonly name: string;
  /** The address links are built from; `null` until it is set. */
  readonly address: string | null;
}

/** The portal as the teacher and the administrator see it in the settings. */
export interface PortalSettings extends PortalInfo {
  /** The address comes from `TEACHERBOX_PUBLIC_URL` on the server and cannot be changed here. */
  readonly addressFromEnvironment: boolean;
}

/**
 * The name and the address of the portal (ADR-0014): the name is shown in the header and the browser
 * tab, every link the portal gives out starts with the address.
 */
@Injectable({ providedIn: 'root' })
export class Portal {
  /** HttpClient only for loading: components that just show the name do not need it. */
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly info = signal<PortalInfo>({ name: DEFAULT_PORTAL_NAME, address: null });

  readonly name = computed(() => this.info().name);
  /** The portal address or, until it is set, the address this page is opened at. */
  readonly address = computed(() => this.info().address ?? this.openedAt());
  /** The teacher has set the address (or the server has it). */
  readonly addressSet = computed(() => this.info().address !== null);

  /** Loads the name and the address; without an answer the defaults stay (the sign-in page works). */
  async load(): Promise<void> {
    try {
      const context = new HttpContext().set(SKIP_ERROR_TOAST, true);
      this.set(
        await firstValueFrom(
          this.injector.get(HttpClient).get<PortalInfo>('/api/public/portal', { context }),
        ),
      );
    } catch {
      // The defaults are good enough until the next start.
    }
  }

  /** After the teacher or the administrator has changed them. */
  set(info: PortalInfo): void {
    this.info.set({ name: info.name, address: info.address });
  }

  /** @param path a path of the portal starting with `/` */
  link(path: string): string {
    return this.address() + path;
  }

  /** The address this page is opened at, e.g. `http://192.168.1.10:8080`. */
  openedAt(): string {
    return this.document.location.origin;
  }
}
