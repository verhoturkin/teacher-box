import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Portal } from '@core/portal/portal';

/** Page title: "<route title> — <portal name>"; follows a renamed portal. */
@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly portal = inject(Portal);
  private readonly page = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      this.apply(this.page(), this.portal.name());
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.page.set(page);
    this.apply(page, this.portal.name());
  }

  private apply(page: string | undefined, name: string): void {
    this.title.setTitle(page === undefined ? name : `${page} — ${name}`);
  }
}
