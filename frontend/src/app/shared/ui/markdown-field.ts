import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { SHARED_T } from '@shared/i18n/texts';
import { FieldErrors } from './field-errors';
import { MarkdownView } from './markdown-view';

/** «Текст» or «Просмотр» of a Markdown field. */
export type MarkdownMode = 'edit' | 'preview';

/**
 * A Markdown text with «Текст · Просмотр» beside its label (an assignment, a lesson plan): the text area, or the
 * text as the student sees it. The text area keeps its height while the preview is shown, so switching never
 * moves the page; the hint ends with what Markdown can do. Errors of the control show under it.
 *
 * ```html
 * <tb-markdown-field [control]="form.controls.body" [mode]="mode" fieldId="plan-body" [label]="t.body" />
 * ```
 */
@Component({
  selector: 'tb-markdown-field',
  imports: [ReactiveFormsModule, SelectButton, Textarea, FieldErrors, MarkdownView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div tbFieldErrors class="tb-field">
      <div class="tb-field__header">
        <label [for]="fieldId()">{{ label() }}</label>
        <p-selectbutton
          [options]="modes"
          [formControl]="mode()"
          optionLabel="label"
          optionValue="value"
          [allowEmpty]="false"
          [ariaLabel]="t.mode"
        />
      </div>
      @if (modeValue() === 'preview') {
        <div class="tb-preview" [style.min-height.px]="height()">
          <tb-markdown [text]="text()" />
        </div>
      } @else {
        <textarea
          pTextarea
          #editor
          class="tb-markdown-field__text"
          [id]="fieldId()"
          [style.height.px]="height()"
          [formControl]="control()"
          [rows]="rows()"
        ></textarea>
      }
      <small class="tb-hint">{{ hintText() }}</small>
    </div>
  `,
  styles: `
    .tb-markdown-field__text {
      width: 100%;
    }
  `,
})
export class MarkdownField implements OnInit {
  protected readonly t = SHARED_T.markdown;
  private readonly destroyRef = inject(DestroyRef);

  readonly control = input.required<FormControl<string>>();
  /** «Текст» or «Просмотр»; the page may switch it (an AI draft is shown as the student sees it). */
  readonly mode = input(new FormControl<MarkdownMode>('edit', { nonNullable: true }));
  readonly label = input.required<string>();
  readonly fieldId = input('markdown-text');
  /** What comes before the Markdown hint, e.g. «Первая строка станет названием». */
  readonly hint = input<string | null>(null);
  readonly rows = input(10);
  /** The height of the text area, kept while the preview is shown. */
  readonly height = model<number | null>(null);

  protected readonly modes = [
    { label: SHARED_T.markdown.write, value: 'edit' },
    { label: SHARED_T.markdown.preview, value: 'preview' },
  ];
  protected readonly modeValue = signal<MarkdownMode>('edit');
  /** The text as it is typed (or set by the page). */
  protected readonly text = signal('');
  protected readonly hintText = computed(() => {
    const hint = this.hint();
    return hint === null ? this.t.hint : `${hint}. ${this.t.hint}`;
  });
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');

  ngOnInit(): void {
    const control = this.control();
    this.text.set(control.value);
    control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.text.set(value);
    });
    const mode = this.mode();
    this.modeValue.set(mode.value);
    mode.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const field = this.editor();
      if (field) {
        this.height.set(field.nativeElement.offsetHeight);
      }
      this.modeValue.set(value);
    });
  }
}
