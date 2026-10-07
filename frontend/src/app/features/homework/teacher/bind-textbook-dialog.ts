import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { quietContext } from '@core/http/api-error.interceptor';
import { describeError } from '@core/http/error-messages';
import { Textbook, TextbooksApi } from '@features/textbooks/parts';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails, BoundTextbook } from '../data-access/homework.models';

/** Pages like «12-14, 20» (the backend normalizes and checks them). */
export const PAGES_PATTERN = /^\s*\d+(\s*[-–—]\s*\d+)?(\s*[,;\s]\s*\d+(\s*[-–—]\s*\d+)?)*\s*$/;

/**
 * Binds a textbook of «Учебники» to an assignment with its pages (ADR-0033), or changes the pages of a bound
 * one. Blank pages — the whole textbook.
 */
@Component({
  selector: 'tb-bind-textbook-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Message,
    Select,
    FieldErrors,
    SubmitFor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="bound() === null ? 'Учебник к заданию' : 'Страницы учебника'"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      @if (loaded() && choices().length === 0 && bound() === null) {
        <p class="tb-muted">Свободных учебников нет. Добавьте учебник в разделе «Учебники».</p>
      } @else {
        <form
          tbFieldErrors
          id="bind-textbook-form"
          class="tb-form"
          [formGroup]="form"
          (ngSubmit)="save()"
        >
          @if (bound(); as current) {
            <p class="tb-strong">{{ current.title }}</p>
          } @else {
            <div class="tb-field tb-field--required">
              <label for="bind-textbook">Учебник</label>
              <p-select
                inputId="bind-textbook"
                formControlName="textbook"
                [options]="choices()"
                optionLabel="title"
                optionValue="id"
                placeholder="Выберите учебник"
                [filter]="true"
                filterBy="title,course"
                appendTo="body"
                [fluid]="true"
              />
            </div>
          }
          @if (paged()) {
            <div class="tb-field">
              <label for="bind-pages">Страницы</label>
              <input
                pInputText
                id="bind-pages"
                formControlName="pages"
                placeholder="Например, 12-14, 20"
                autocomplete="off"
              />
              <small class="tb-hint">{{ pagesHint() }}</small>
            </div>
          }
          @if (error(); as message) {
            <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
          }
        </form>
      }
      <ng-template #footer>
        <p-button
          label="Отмена"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          severity="success"
          [label]="bound() === null ? 'Привязать' : 'Сохранить'"
          [loading]="pending()"
          [disabled]="loaded() && choices().length === 0 && bound() === null"
          type="submit"
          tbSubmitFor="bind-textbook-form"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class BindTextbookDialog {
  private readonly homework = inject(HomeworkApi);
  private readonly textbooksApi = inject(TextbooksApi);

  readonly visible = model(false);
  readonly assignmentId = input.required<string>();
  /** The textbooks the assignment already has. */
  readonly taken = input<readonly BoundTextbook[]>([]);
  /** A bound textbook whose pages change; `null` binds a new one. */
  readonly bound = input<BoundTextbook | null>(null);
  readonly saved = output<AssignmentDetails>();

  protected readonly textbooks = signal<Textbook[]>([]);
  protected readonly loaded = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly textbook = new FormControl<string | null>(null, [Validators.required]);
  readonly pages = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(200), Validators.pattern(PAGES_PATTERN)],
  });
  readonly form = new FormGroup({ textbook: this.textbook, pages: this.pages });
  private readonly chosenId = toSignal(this.textbook.valueChanges, { initialValue: null });

  /** Textbooks not bound yet. */
  protected readonly choices = computed(() => {
    const taken = new Set(this.taken().map((textbook) => textbook.textbookId));
    return this.textbooks().filter((textbook) => !taken.has(textbook.id));
  });
  private readonly chosen = computed(() => {
    const bound = this.bound();
    if (bound !== null) return { format: bound.format, pageCount: bound.pageCount };
    return this.textbooks().find((textbook) => textbook.id === this.chosenId()) ?? null;
  });
  /** An image is one page: nothing to choose. */
  protected readonly paged = computed(() => this.chosen()?.format !== 'IMAGE');
  protected readonly pagesHint = computed(() => {
    const chosen = this.chosen();
    const count = chosen?.pageCount ?? null;
    const whole =
      count === null ? 'Пусто — весь учебник.' : `Пусто — весь учебник (${String(count)} с.).`;
    return chosen?.format === 'DOCUMENT'
      ? `${whole} Файл Word ученик получит целиком, страницы — подсказка.`
      : `${whole} Ученик получит только эти страницы.`;
  });

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const bound = this.bound();
      // The form writes into PrimeNG's select, whose signals must not become this effect's.
      untracked(() => {
        this.error.set(null);
        this.textbook.reset(bound?.textbookId ?? null);
        this.pages.reset(bound?.pages ?? '');
        if (bound === null) {
          this.loaded.set(false);
          this.textbooksApi.list(quietContext()).subscribe((textbooks) => {
            this.textbooks.set(textbooks);
            this.loaded.set(true);
          });
        }
      });
    });
  }

  save(): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const textbookId = this.textbook.value;
    if (textbookId === null) {
      return;
    }
    const pages = this.paged() ? this.pages.value.trim() : '';
    this.pending.set(true);
    this.error.set(null);
    this.homework
      .bindTextbook(this.assignmentId(), textbookId, pages === '' ? null : pages)
      .subscribe({
        next: (assignment) => {
          this.pending.set(false);
          this.visible.set(false);
          this.saved.emit(assignment);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, 'Не удалось привязать учебник'));
        },
      });
  }
}
