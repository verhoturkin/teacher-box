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
import { Observable, of } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { SHARED_T } from '@shared/i18n/texts';
import { openedOnce } from '@shared/ui/dialog/opened-once';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { TextbooksApi } from '../data-access/textbooks-api';
import { PickedTextbook, Textbook } from '../data-access/textbooks.models';
import { T } from '../i18n/texts';
import { parsePages } from '../page-ranges';

/** Most pages bound at once, as the backend's `PageRanges` allows. */
const MAX_BOUND_PAGES = 500;

/** Pages like «12-14, 20» (the backend normalizes and checks them). */
export const PAGES_PATTERN = /^\s*\d+(\s*[-–—]\s*\d+)?(\s*[,;\s]\s*\d+(\s*[-–—]\s*\d+)?)*\s*$/;

/**
 * Chooses a textbook of «Учебники» with its pages (ADR-0033) for a material — an assignment, a lesson plan — or
 * changes the pages of a chosen one. Blank pages — the whole textbook. The choice is checked against the
 * textbook's pages and handed over (`picked`): the material saves it. With `courseId` only the textbooks of that
 * course are offered (a lesson plan of a course, roadmap 11).
 */
@Component({
  selector: 'tb-bind-textbook-dialog',
  imports: [ReactiveFormsModule, InputText, Select, FieldErrors, TbDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (built()) {
      <tb-dialog
        kind="form"
        [(visible)]="visible"
        [headline]="bound() === null ? (headline() ?? t.newTitle) : t.pagesTitle"
        [confirmLabel]="empty() ? null : bound() === null ? t.bind : c.save"
        [cancelLabel]="empty() ? c.close : c.cancel"
        formId="bind-textbook-form"
        [pending]="submit.pending()"
        [error]="localError() ?? submit.error()"
        [dirty]="submit.dirty()"
      >
        @if (empty()) {
          <p class="tb-muted">{{ courseId() === null ? t.noTextbooks : t.noCourseTextbooks }}</p>
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
                  filterBy="title,courseName"
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
    }
  `,
})
export class BindTextbookDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.bind;
  private readonly textbooksApi = inject(TextbooksApi);

  readonly visible = model(false);
  /** Built when first opened (`openedOnce`): hidden, its form is not built with the page. */
  protected readonly built = openedOnce(this.visible);
  /** The headline of a new choice, e.g. «Учебник к заданию»; none — «Учебник». */
  readonly headline = input<string | null>(null);
  /** The textbooks the material already has. */
  readonly taken = input<readonly PickedTextbook[]>([]);
  /** A chosen textbook whose pages change; `null` chooses a new one. */
  readonly bound = input<PickedTextbook | null>(null);
  /** Only the textbooks of this course; `null` — all of them. */
  readonly courseId = input<string | null>(null);
  readonly picked = output<PickedTextbook>();

  protected readonly textbooks = signal<Textbook[]>([]);
  protected readonly loaded = signal(false);
  /** The failure of the check of the pages. */
  protected readonly localError = signal<string | null>(null);

  readonly textbook = new FormControl<string | null>(null, [Validators.required]);
  readonly pages = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(200), Validators.pattern(PAGES_PATTERN)],
  });
  readonly form = new FormGroup({ textbook: this.textbook, pages: this.pages });
  private readonly chosenId = toSignal(this.textbook.valueChanges, { initialValue: null });
  /** The choice checked by `save`, handed over by the submit. */
  private choice: PickedTextbook | null = null;

  /** Every textbook (of the course) is chosen already. */
  protected readonly empty = computed(
    () => this.loaded() && this.choices().length === 0 && this.bound() === null,
  );

  /** Textbooks (of the course) not chosen yet. */
  protected readonly choices = computed(() => {
    const taken = new Set(this.taken().map((textbook) => textbook.textbookId));
    const course = this.courseId();
    return this.textbooks().filter(
      (textbook) => !taken.has(textbook.id) && (course === null || textbook.courseId === course),
    );
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
    request: (): Observable<PickedTextbook | null> => of(this.choice),
    done: (choice) => {
      if (choice !== null) {
        this.picked.emit(choice);
      }
    },
  });

  save(): void {
    this.localError.set(null);
    const textbookId = this.textbook.value;
    if (!revealErrors(this.form) || textbookId === null) {
      return;
    }
    this.choice = this.pick(textbookId, this.paged() ? this.pages.value.trim() : '');
    if (this.choice !== null) {
      this.submit.run();
    }
  }

  /** The textbook and its normalized pages, checked here as the backend would. */
  private pick(textbookId: string, pages: string): PickedTextbook | null {
    const bound = this.bound();
    const textbook = this.textbooks().find((candidate) => candidate.id === textbookId);
    const base: PickedTextbook | null =
      bound ??
      (textbook === undefined
        ? null
        : {
            textbookId,
            kind: textbook.kind,
            title: textbook.title,
            courseName: textbook.courseName,
            format: textbook.format,
            pageCount: textbook.pageCount,
            pages: null,
          });
    if (base === null) {
      return null;
    }
    const parsed = pages === '' ? null : parsePages(pages, base.pageCount, MAX_BOUND_PAGES);
    if (pages !== '' && parsed === null) {
      this.localError.set(T.bind.beyond);
      return null;
    }
    return { ...base, pages: parsed?.text ?? null };
  }
}
