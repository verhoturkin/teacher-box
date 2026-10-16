import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { ExternalNavigation } from '@shared/navigation/external-navigation';
import { Portal } from '@core/portal/portal';
import { callOwnerOf } from '../call/call-links';
import { CallSession } from '../call/call-session';
import { MeetingPreferences, isTelemostLink, telemostAppLink } from '../telemost';
import { T } from '../i18n/texts';

/**
 * Opens the video meeting of a lesson. A built-in room (`<portal>/call/<ownerId>`, ADR-0030) opens the
 * call in place. For the teacher a Telemost link opens in the desktop application (if chosen on this
 * device): an M3 Expressive split button, the browser in the menu of its trailing part (ADR-0022);
 * other links open in a new tab.
 */
@Component({
  selector: 'tb-join-lesson-button',
  imports: [Button, ButtonDirective, ButtonIcon, ButtonLabel, Menu, ButtonAttributes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (callOwner(); as owner) {
      <p-button
        [label]="label()"
        icon="tb-i tb-i-videocam"
        [severity]="tonal() ? 'secondary' : 'primary'"
        [styleClass]="medium() ? 'tb-button-m' : ''"
        [loading]="session.opening() === owner"
        (onClick)="session.open(owner)"
      />
    } @else if (inApp()) {
      <span
        class="tb-split"
        [class.tb-split--m]="medium()"
        role="group"
        [attr.aria-label]="label()"
        [class.tb-split--open]="menuOpen()"
      >
        <p-button
          [styleClass]="medium() ? 'tb-split__main tb-button-m' : 'tb-split__main'"
          [label]="label()"
          icon="tb-i tb-i-videocam"
          [severity]="tonal() ? 'secondary' : 'primary'"
          (onClick)="openApp()"
        />
        <p-button
          styleClass="tb-split__more"
          icon="tb-i tb-i-expand_more"
          [severity]="tonal() ? 'secondary' : 'primary'"
          [ariaLabel]="t.other"
          [tbAttributes]="{
            'aria-haspopup': 'menu',
            'aria-expanded': menuOpen() ? 'true' : 'false',
          }"
          (onClick)="menu.toggle($event)"
        />
        <p-menu
          #menu
          [model]="items()"
          [popup]="true"
          appendTo="body"
          (onShow)="menuOpen.set(true)"
          (onHide)="menuOpen.set(false)"
        />
      </span>
    } @else {
      <a
        pButton
        [href]="url()"
        target="_blank"
        rel="noopener"
        [severity]="tonal() ? 'secondary' : 'primary'"
        [class.tb-button-m]="medium()"
      >
        <i pButtonIcon aria-hidden="true" class="tb-i tb-i-videocam"></i>
        <span pButtonLabel>{{ label() }}</span>
      </a>
    }
  `,
})
export class JoinLessonButton {
  protected readonly t = T.join;
  private readonly navigation = inject(ExternalNavigation);
  private readonly preferences = inject(MeetingPreferences);
  private readonly portal = inject(Portal);
  protected readonly session = inject(CallSession);

  readonly url = input.required<string>();
  readonly label = input(T.join.label);
  /** The teacher may open Telemost in the desktop application. */
  readonly teacher = input(false);
  /** A secondary action next to others (ADR-0018): the tonal button. */
  readonly tonal = input(false);
  /** The hero of the home page: the one M3E medium button of the portal, 56 px (ADR-0045). */
  readonly medium = input(false);

  /** The owner of a built-in room: the call opens in the portal. */
  protected readonly callOwner = computed(() =>
    callOwnerOf(this.url(), [this.portal.openedAt(), this.portal.address()]),
  );

  protected readonly inApp = computed(
    () => this.teacher() && this.preferences.openInApp() && isTelemostLink(this.url()),
  );

  protected readonly menuOpen = signal(false);
  protected readonly items = computed<MenuItem[]>(() => [
    {
      label: T.join.inBrowser,
      icon: 'tb-i tb-i-open_in_new',
      url: this.url(),
      target: '_blank',
    },
  ]);

  openApp(): void {
    this.navigation.go(telemostAppLink(this.url()));
  }
}
