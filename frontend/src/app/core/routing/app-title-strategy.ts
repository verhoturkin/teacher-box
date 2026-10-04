import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Portal } from '@core/portal/portal';
import { PageDetail } from './page-detail';

/**
 * Page title: "<detail> — <route title> — <portal name>", the detail only on nested pages (the name
 * of the student, of the assignment); follows a renamed portal.
 */
@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly portal = inject(Portal);
  private readonly detail = inject(PageDetail).value;
  private readonly page = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      this.apply(this.page(), this.detail(), this.portal.name());
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.page.set(page);
    this.apply(page, this.detail(), this.portal.name());
  }

  private apply(page: string | undefined, detail: string | null, name: string): void {
    const parts = [detail, page, name].filter((part) => part !== null && part !== undefined);
    this.title.setTitle(parts.join(' — '));
  }
}
