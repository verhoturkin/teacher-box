import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { IdentityApi } from '@features/identity/parts';
import { NewMessageState } from '@core/notifications/new-message';
import { Snackbar } from '@core/snackbar/snackbar';
import { BroadcastDialog, Recipient } from './broadcast-dialog';
import { T } from '../i18n/texts';

/**
 * The frame's dialog of a new message to students (`NEW_MESSAGE_DIALOG`): opened by «Создать › Сообщение»
 * from any page and by «Написать ученикам» of the sent tab; it writes to the current students.
 */
@Component({
  selector: 'tb-new-message-dialog',
  imports: [BroadcastDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-broadcast-dialog
      [visible]="visible()"
      (visibleChange)="onVisible($event)"
      [students]="students()"
      (sent)="onSent($event)"
    />
  `,
})
export class NewMessageDialog {
  private readonly state = inject(NewMessageState);
  private readonly identity = inject(IdentityApi);
  private readonly snackbar = inject(Snackbar);

  protected readonly visible = signal(false);
  protected readonly students = signal<Recipient[]>([]);

  constructor() {
    // the dialog opens once the students to choose from are known
    effect(() => {
      if (this.state.open()) {
        this.identity.listStudents().subscribe((students) => {
          this.students.set(
            students
              .filter((student) => student.status !== 'DEACTIVATED')
              .map((student) => ({ id: student.id, displayName: student.displayName })),
          );
          this.visible.set(true);
        });
      }
    });
  }

  protected onVisible(visible: boolean): void {
    this.visible.set(visible);
    if (!visible) {
      this.state.close();
    }
  }

  protected onSent(recipients: number): void {
    this.snackbar.success(T.broadcasts.sent(recipients));
    this.state.markSent();
  }
}
