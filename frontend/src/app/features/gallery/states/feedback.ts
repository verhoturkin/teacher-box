import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Snackbar } from '@core/snackbar/snackbar';
import { Confirm } from '@shared/ui/confirm';

/**
 * §12 Feedback: the snackbar (`Snackbar` of `core/snackbar`: success and info `role="status"`, error
 * `role="alert"`, `undoable` with «Undo»), and confirmations (`Confirm.danger` — filled red, `Confirm.safe` —
 * filled primary; both with the fixed neutral «Cancel»).
 */
@Component({
  selector: 'tb-gallery-feedback',
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-gallery-row">
      <p-button label="Saved" severity="secondary" (onClick)="saved()" />
      <p-button
        label="error"
        severity="secondary"
        (onClick)="snackbar.error('Could not save: 503')"
      />
      <p-button
        label="undoable"
        severity="secondary"
        (onClick)="snackbar.undoable('Marked: missed', undo)"
      />
    </div>
    <code class="tb-gallery-name"
      >inject(Snackbar).success(text) | .error(text) | .undoable(text, undo)</code
    >
    <div class="tb-gallery-row">
      <p-button label="Confirm.danger" severity="secondary" (onClick)="ask(true)" />
      <p-button label="Confirm.safe" severity="secondary" (onClick)="ask(false)" />
      <span class="tb-gallery-name">answer: {{ answer() }}</span>
    </div>
    <code class="tb-gallery-name"
      >await inject(Confirm).danger({{ '{' }} header, message, acceptLabel {{ '}' }})</code
    >
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
    }
  `,
})
export class FeedbackSample {
  protected readonly snackbar = inject(Snackbar);
  private readonly confirm = inject(Confirm);
  protected readonly answer = signal('—');
  /** `p-button` attributes must not mention a success severity (design-rules.spec): a method calls it. */
  protected saved(): void {
    this.snackbar.success('Saved');
  }

  protected readonly undo = (): void => {
    this.snackbar.info('Undone');
  };

  protected async ask(danger: boolean): Promise<void> {
    const request = danger
      ? {
          header: 'Delete the board?',
          message: 'The board and its copies are deleted.',
          acceptLabel: 'Delete',
        }
      : {
          header: 'Restart the portal?',
          message: 'Lessons in progress keep going.',
          acceptLabel: 'Restart',
        };
    const accepted = await (danger ? this.confirm.danger(request) : this.confirm.safe(request));
    this.answer.set(String(accepted));
  }
}
