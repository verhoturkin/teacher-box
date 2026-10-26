import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { quietContext } from '@core/http/api-error.interceptor';
import { Textbook, TextbooksApi, parsePages } from '@features/textbooks/parts';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails, BoundTextbook } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { Observable } from 'rxjs';

/** Most pages bound at once, as the backend's `PageRanges` allows. */
const MAX_BOUND_PAGES = 500;

/** Pages like «12-14, 20» (the backend normalizes and checks them). */
export const PAGES_PATTERN = /^\s*\d+(\s*[-–—]\s*\d+)?(\s*[,;\s]\s*\d+(\s*[-–—]\s*\d+)?)*\s*$/;

/**
 * Binds a textbook of «Учебники» to an assignment with its pages (ADR-0033), or changes the pages of a bound
 * one. Blank pages — the whole textbook. Without an assignment (a new one in the editor) it only hands the choice
 * over (`picked`), checked against the textbook's pages; the editor binds it after creating the assignment.
 */
@Component({
  selector: 'tb-bind-textbook-dialog',
  imports: [ReactiveFormsModule, InputText, Select, FieldErrors, TbDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="bound() === null ? t.newTitle : t.pagesTitle"
      [confirmLabel]="empty() ? null : bound() === null ? t.bind : c.save"
      [cancelLabel]="empty() ? c.close : c.cancel"
      formId="bind-textbook-form"
      [pending]="submit.pending()"
      [error]="localError() ?? submit.error()"
      [dirty]="submit.dirty()"
    >
      @if (empty()) {
        <p class="tb-muted">{{ t.noTextbooks }}</p>
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
              <label for="bind-textbook">{{ t.textbook }}</label>
              <p-select
                inputId="bind-textbook"
                formControlName="textbook"
                [options]="choices()"
                optionLabel="title"
                optionValue="id"
                [placeholder]="t.chooseTextbook"
                [filter]="true"
                filterBy="title,course"
                appendTo="body"
                [fluid]="true"
              />
            </div>
          }
          @if (paged()) {
            <div class="tb-field">
              <label for="bind-pages">{{ t.pages }}</label>
              <input
                pInputText
                id="bind-pages"
                formControlName="pages"
                [placeholder]="t.pagesPlaceholder"
                autocomplete="off"
              />
              <small class="tb-hint">{{ pagesHint() }}</small>
            </div>
          }
        </form>
      }
    </tb-dialog>
  `,
})
export class BindTextbookDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.bind;
  private readonly homework = inject(HomeworkApi);
  private readonly textbooksApi = inject(TextbooksApi);

  readonly visible = model(false);
  /** `null`: the assignment is not created yet — the choice goes to `picked`. */
  readonly assignmentId = input<string | null>(null);
  /** The textbooks the assignment already has. */
  readonly taken = input<readonly BoundTextbook[]>([]);
  /** A bound textbook whose pages change; `null` binds a new one. */
  readonly bound = input<BoundTextbook | null>(null);
  readonly saved = output<AssignmentDetails>();
  readonly picked = output<BoundTextbook>();

  protected readonly textbooks = signal<Textbook[]>([]);
  protected readonly loaded = signal(false);
  /** The failure of the local check of a new assignment's choice. */
  protected readonly localError = signal<string | null>(null);

  readonly textbook = new FormControl<string | null>(null, [Validators.required]);
  readonly pages = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(200), Validators.pattern(PAGES_PATTERN)],
  });
  readonly form = new FormGroup({ textbook: this.textbook, pages: this.pages });
  private readonly chosenId = toSignal(this.textbook.valueChanges, { initialValue: null });

  /** Every textbook is bound already. */
  protected readonly empty = computed(
    () => this.loaded() && this.choices().length === 0 && this.bound() === null,
  );

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
    const whole = count === null ? T.bind.whole : T.bind.wholeOf(count);
    return chosen?.format === 'DOCUMENT' ? T.bind.wordHint(whole) : T.bind.pagesHint(whole);
  });

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.bind.failed,
    // The form writes into PrimeNG's select, whose signals must not become the effect's.
    reset: () => {
      const bound = this.bound();
      this.localError.set(null);
      this.textbook.reset(bound?.textbookId ?? null);
      this.pages.reset(bound?.pages ?? '');
      if (bound === null) {
        this.loaded.set(false);
        this.textbooksApi.list(quietContext()).subscribe((textbooks) => {
          this.textbooks.set(textbooks);
          this.loaded.set(true);
        });
      }
    },
    request: (): Observable<AssignmentDetails> => {
      const assignmentId = this.assignmentId() ?? '';
      const pages = this.paged() ? this.pages.value.trim() : '';
      return this.homework.bindTextbook(
        assignmentId,
        this.textbook.value ?? '',
        pages === '' ? null : pages,
      );
    },
    done: (assignment) => {
      this.saved.emit(assignment);
    },
  });

  save(): void {
    const textbookId = this.textbook.value;
    if (this.assignmentId() === null) {
      this.localError.set(null);
      if (!revealErrors(this.form) || textbookId === null) {
        return;
      }
      this.pick(textbookId, this.paged() ? this.pages.value.trim() : '');
      return;
    }
    this.submit.run();
  }

  /** A new assignment: the textbook and its normalized pages, checked here as the backend would. */
  private pick(textbookId: string, pages: string): void {
    const bound = this.bound();
    const textbook = this.textbooks().find((candidate) => candidate.id === textbookId);
    const base: BoundTextbook | null =
      bound ??
      (textbook === undefined
        ? null
        : {
            textbookId,
            kind: textbook.kind,
            title: textbook.title,
            course: textbook.course,
            format: textbook.format,
            pageCount: textbook.pageCount,
            pages: null,
          });
    if (base === null) {
      return;
    }
    const parsed = pages === '' ? null : parsePages(pages, base.pageCount, MAX_BOUND_PAGES);
    if (pages !== '' && parsed === null) {
      this.localError.set(T.bind.beyond);
      return;
    }
    this.visible.set(false);
    this.picked.emit({ ...base, pages: parsed?.text ?? null });
  }
}
