import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { ExternalNavigation } from '@shared/navigation/external-navigation';
import { MeetingPreferences, isTelemostLink, telemostAppLink } from '../telemost';

/**
 * Opens the video meeting of a lesson. For the teacher a Telemost link opens in the desktop
 * application (if chosen on this device) with the browser as a fallback; students get the link.
 */
@Component({
  selector: 'tb-join-lesson-button',
  imports: [Button, ButtonDirective, ButtonIcon, ButtonLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (inApp()) {
      <span class="tb-join">
        <p-button
          [label]="label()"
          icon="pi pi-video"
          [size]="small() ? 'small' : undefined"
          [outlined]="outlined()"
          (onClick)="openApp()"
        />
        <a class="tb-join__browser" [href]="url()" target="_blank" rel="noopener">в браузере</a>
      </span>
    } @else {
      <a
        pButton
        [href]="url()"
        target="_blank"
        rel="noopener"
        [size]="small() ? 'small' : undefined"
        [outlined]="outlined()"
      >
        <i pButtonIcon class="pi pi-video"></i>
        <span pButtonLabel>{{ label() }}</span>
      </a>
    }
  `,
  styles: `
    .tb-join {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-join__browser {
      font-size: 0.875rem;
    }
  `,
})
export class JoinLessonButton {
  private readonly navigation = inject(ExternalNavigation);
  private readonly preferences = inject(MeetingPreferences);

  readonly url = input.required<string>();
  readonly label = input('Войти в урок');
  /** The teacher may open Telemost in the desktop application. */
  readonly teacher = input(false);
  readonly small = input(false);
  readonly outlined = input(false);

  protected readonly inApp = computed(
    () => this.teacher() && this.preferences.openInApp() && isTelemostLink(this.url()),
  );

  openApp(): void {
    this.navigation.go(telemostAppLink(this.url()));
  }
}
