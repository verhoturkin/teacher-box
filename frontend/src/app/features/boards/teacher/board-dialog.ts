import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { MemberPicker, MemberSelection } from '@features/identity/parts';
import { SelectButton } from 'primeng/selectbutton';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { BoardsApi } from '../data-access/boards-api';
import { Board, BoardInput, BoardKind } from '../data-access/boards.models';
import { BOARD_KIND_LABELS } from '../boards-labels';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

export const BOARD_LINK_PATTERN = /^\s*https?:\/\/\S+\s*$/;

/** A student or a group the teacher can bind a board to. */
export interface MemberOption {
  readonly id: string;
  readonly name: string;
}

/** Students and groups a new board starts with (e.g. the filter of the page). */
export interface BoardDefaults {
  readonly studentIds: readonly string[];
  readonly groupIds: readonly string[];
}

/**
 * Creates a board (when `board` is null) or changes one: its kind (only when created), title, link of an
 * external board, students and groups.
 */
@Component({
  selector: 'tb-board-dialog',
  imports: [ReactiveFormsModule, TbDialog, InputText, MemberPicker, SelectButton, FieldErrors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="board() === null ? t.newBoard : t.editBoard"
      [confirmLabel]="board() === null ? c.create : c.save"
      formId="board-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty()"
    >
      <form
        tbFieldErrors
        id="board-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="submit.run()"
      >
        @if (board() === null) {
          <div class="tb-field tb-field__header">
            <span id="board-kind-label">{{ t.kind }}</span>
            <p-selectbutton
              formControlName="kind"
              [options]="kinds"
              optionLabel="label"
              optionValue="value"
              [allowEmpty]="false"
              ariaLabelledBy="board-kind-label"
            />
            <small class="tb-hint">{{ kindHint() }}</small>
          </div>
        }
        <div class="tb-field tb-field--required">
          <label for="board-title">{{ t.title }}</label>
          <input
            pInputText
            id="board-title"
            formControlName="title"
            [placeholder]="t.titlePlaceholder"
            autocomplete="off"
            aria-required="true"
          />
        </div>
        @if (kind() === 'LINK') {
          <div class="tb-field tb-field--required">
            <label for="board-url">{{ t.url }}</label>
            <input
              pInputText
              id="board-url"
              formControlName="url"
              placeholder="https://…"
              autocomplete="off"
              aria-required="true"
            />
            <small class="tb-hint">{{ t.urlHint }}</small>
          </div>
        }
        <div class="tb-field">
          <label for="board-members">{{ t.members }}</label>
          <tb-member-picker
            inputId="board-members"
            formControlName="members"
            [students]="studentOptions()"
            [groups]="groupOptions()"
          />
        </div>
      </form>
    </tb-dialog>
  `,
})
export class BoardDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.dialog;
  private readonly api = inject(BoardsApi);

  readonly visible = model(false);
  /** The board to change; `null` creates a new one. */
  readonly board = input<Board | null>(null);
  /** Current students and active groups. */
  readonly students = input<readonly MemberOption[]>([]);
  readonly groups = input<readonly MemberOption[]>([]);
  readonly defaults = input<BoardDefaults>({ studentIds: [], groupIds: [] });
  readonly saved = output<Board>();

  protected readonly kinds = (['EXCALIDRAW', 'LINK'] as const).map((value) => ({
    value,
    label: BOARD_KIND_LABELS[value],
  }));

  readonly form = inject(NonNullableFormBuilder).group({
    kind: new FormControl<BoardKind>('EXCALIDRAW', { nonNullable: true }),
    title: ['', [Validators.required, Validators.maxLength(200)]],
    url: [
      '',
      [Validators.required, Validators.maxLength(1000), Validators.pattern(BOARD_LINK_PATTERN)],
    ],
    members: [[] as MemberSelection[]],
  });

  private readonly chosenKind = toSignal(this.form.controls.kind.valueChanges, {
    initialValue: this.form.controls.kind.value,
  });
  /** The kind of the board: chosen for a new one, fixed for an existing one. */
  protected readonly kind = computed(() => this.board()?.kind ?? this.chosenKind());
  protected readonly kindHint = computed(() =>
    this.kind() === 'EXCALIDRAW' ? T.dialog.excalidrawHint : T.dialog.linkHint,
  );
  /** Members the board already has stay choosable even when they left. */
  readonly studentOptions = computed(() => this.withMembers(this.students(), 'STUDENT'));
  readonly groupOptions = computed(() => this.withMembers(this.groups(), 'GROUP'));

  constructor() {
    effect(() => {
      // The link is checked only for an external board.
      const url = this.form.controls.url;
      if (this.kind() === 'LINK') url.enable();
      else url.disable();
    });
  }

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.dialog.failed,
    reset: () => {
      const board = this.board();
      const defaults = this.defaults();
      this.form.reset({
        kind: board?.kind ?? 'EXCALIDRAW',
        title: board?.title ?? '',
        url: board?.url ?? '',
        members: board
          ? board.members.map((member) => ({ kind: member.type, id: member.id }))
          : [
              ...defaults.studentIds.map((id) => ({ kind: 'STUDENT' as const, id })),
              ...defaults.groupIds.map((id) => ({ kind: 'GROUP' as const, id })),
            ],
      });
    },
    request: (value) => {
      const input: BoardInput = {
        title: value.title.trim(),
        url: this.kind() === 'LINK' ? value.url.trim() : null,
        studentIds: value.members
          .filter((member) => member.kind === 'STUDENT')
          .map((member) => member.id),
        groupIds: value.members
          .filter((member) => member.kind === 'GROUP')
          .map((member) => member.id),
      };
      const board = this.board();
      return board === null ? this.api.create(value.kind, input) : this.api.change(board, input);
    },
    done: (saved) => {
      this.saved.emit(saved);
    },
  });

  private withMembers(options: readonly MemberOption[], type: 'STUDENT' | 'GROUP'): MemberOption[] {
    const missing = (this.board()?.members ?? [])
      .filter(
        (member) => member.type === type && !options.some((option) => option.id === member.id),
      )
      .map((member) => ({ id: member.id, name: member.name ?? T.dialog.notInList }));
    return [...options, ...missing];
  }
}
