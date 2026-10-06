import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import { DEFAULT_ACCENT, applyAccent } from '@core/theme/portal-accent';

export const DEFAULT_PORTAL_NAME = 'Teacher Box';

/** What every page knows about the portal (`/api/public/portal`). */
export interface PortalInfo {
  readonly name: string;
  /** The address links are built from; `null` until it is set. */
  readonly address: string | null;
  /** The PrimeNG palette of the portal, e.g. `indigo`. */
  readonly accent: string;
  /** Address of the portal's own logo; `null`: the default icon. */
  readonly logo: string | null;
}

/** The portal as the teacher and the administrator see it in the settings. */
export interface PortalSettings extends PortalInfo {
  /** The address comes from `TEACHERBOX_PUBLIC_URL` on the server and cannot be changed here. */
  readonly addressFromEnvironment: boolean;
  /** The teacher finished or skipped the first setup. */
  readonly setupCompleted: boolean;
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
  private readonly info = signal<PortalInfo>({
    name: DEFAULT_PORTAL_NAME,
    address: null,
    accent: DEFAULT_ACCENT,
    logo: null,
  });
  private setupDone = false;

  readonly name = computed(() => this.info().name);
  readonly logo = computed(() => this.info().logo);
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

  /**
   * Whether the teacher has finished (or skipped) the first setup. Asked once it is done; when the
   * server does not answer, the wizard is not forced on the teacher.
   */
  async setupCompleted(): Promise<boolean> {
    if (this.setupDone) {
      return true;
    }
    try {
      const context = new HttpContext().set(SKIP_ERROR_TOAST, true);
      const settings = await firstValueFrom(
        this.injector.get(HttpClient).get<PortalSettings>('/api/teacher/portal', { context }),
      );
      this.setupDone = settings.setupCompleted;
      return this.setupDone;
    } catch {
      return true;
    }
  }

  /** The first setup is finished; `false` after a full reset brings it back. */
  setSetupCompleted(completed: boolean): void {
    this.setupDone = completed;
  }

  /** After the teacher or the administrator has changed them. */
  set(info: PortalInfo): void {
    const before = this.info();
    this.info.set({ name: info.name, address: info.address, accent: info.accent, logo: info.logo });
    if (info.accent !== before.accent) {
      applyAccent(info.accent);
    }
    if (info.logo !== before.logo) {
      this.showIcon(info.logo);
    }
  }

  /**
   * The logo becomes the icon of the browser tab, in place of every default icon (SVG and ICO); the
   * defaults come back when the logo is removed.
   */
  private showIcon(logo: string | null): void {
    for (const icon of this.document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')) {
      icon.dataset['defaultHref'] ??= icon.getAttribute('href') ?? '';
      icon.dataset['defaultType'] ??= icon.type;
      icon.type = logo === null ? icon.dataset['defaultType'] : '';
      icon.href = logo ?? icon.dataset['defaultHref'];
    }
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
