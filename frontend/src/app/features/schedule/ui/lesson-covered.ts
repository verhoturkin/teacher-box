import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MarkdownView } from '@shared/ui/markdown-view';
import { T } from '../i18n/texts';

/**
 * «Что прошли» of a held lesson as the teacher's lists, the student and the parent read it (466.3): with a plan —
 * «Прошли по плану» and the deviations under «Не по плану», if any; without one — the summary under «Что прошли».
 * Nothing without a plan and a summary.
 */
@Component({
  selector: 'tb-lesson-covered',
  imports: [MarkdownView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let text = summary();
    @if (byPlan()) {
      <p class="tb-lesson-covered__plan">
        <i class="tb-i tb-i-check_circle" aria-hidden="true"></i>{{ t.byPlan }}
      </p>
    }
    @if (text) {
      <div class="tb-lesson-covered__part">
        <span class="tb-lesson-covered__label">{{ byPlan() ? t.offPlan : t.covered }}</span>
        <tb-markdown [text]="text" />
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .tb-lesson-covered__part {
      margin: var(--tb-space-2) 0 0;
      overflow-wrap: anywhere;
    }

    .tb-lesson-covered__label {
      display: block;
      font: var(--tb-type-label-m);
      letter-spacing: var(--tb-tracking-label-m);
      color: var(--p-md-on-surface-variant);
    }

    /* M3: an icon with text takes the text's colour; the 18px icon and the gap are our decision */
    .tb-lesson-covered__plan {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      margin: var(--tb-space-2) 0 0;
      font: var(--tb-type-label-l);
      letter-spacing: var(--tb-tracking-label-l);
      color: var(--p-md-on-surface);
    }

    .tb-lesson-covered__plan .tb-i {
      font-size: 1.125rem;
      color: var(--p-md-primary);
    }
  `,
})
export class LessonCovered {
  protected readonly t = T.covered;
  /** «Что прошли»; with a plan only the deviations from it. */
  readonly summary = input<string | null | undefined>(null);
  /** The lesson was held with a plan on it. */
  readonly byPlan = input(false);
}

/** A held lesson with a plan reads «Прошли по плану» (466.3). */
export function heldByPlan(lesson: {
  readonly planId: string | null;
  readonly status: string;
}): boolean {
  return lesson.planId !== null && lesson.status === 'CONDUCTED';
}
