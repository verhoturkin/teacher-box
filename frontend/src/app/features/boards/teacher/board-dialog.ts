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
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { SelectButton } from 'primeng/selectbutton';
import { describeError } from '@core/http/error-messages';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { BoardsApi } from '../data-access/boards-api';
import { Board, BoardInput, BoardKind } from '../data-access/boards.models';
import { BOARD_KIND_LABELS } from '../boards-labels';

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
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Message,
    MultiSelect,
    SelectButton,
    FieldErrors,
    SubmitFor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="board() === null ? 'Новая доска' : 'Изменить доску'"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      <form tbFieldErrors id="board-form" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        @if (board() === null) {
          <div class="tb-field tb-field__header">
            <span id="board-kind-label">Вид доски</span>
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
          <label for="board-title">Название</label>
          <input
            pInputText
            id="board-title"
            formControlName="title"
            placeholder="Например, Алгебра"
            autocomplete="off"
            aria-required="true"
          />
        </div>
        @if (kind() === 'LINK') {
          <div class="tb-field tb-field--required">
            <label for="board-url">Ссылка на доску</label>
            <input
              pInputText
              id="board-url"
              formControlName="url"
              placeholder="https://…"
              autocomplete="off"
              aria-required="true"
            />
            <small class="tb-hint">Откройте к доске доступ по ссылке, например в Холсте.</small>
          </div>
        }
        <div class="tb-field">
          <label for="board-students">Ученики</label>
          <p-multiselect
            inputId="board-students"
            formControlName="studentIds"
            [options]="studentOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Кому открыта доска"
            [filter]="true"
            filterPlaceHolder="Поиск"
            ariaFilterLabel="Поиск"
            display="chip"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        <div class="tb-field">
          <label for="board-groups">Группы</label>
          <p-multiselect
            inputId="board-groups"
            formControlName="groupIds"
            [options]="groupOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Все ученики группы"
            [filter]="true"
            filterPlaceHolder="Поиск"
            ariaFilterLabel="Поиск"
            display="chip"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button
          label="Отмена"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          severity="success"
          [label]="board() === null ? 'Создать' : 'Сохранить'"
          [loading]="pending()"
          type="submit"
          tbSubmitFor="board-form"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class BoardDialog {
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
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    kind: new FormControl<BoardKind>('EXCALIDRAW', { nonNullable: true }),
    title: ['', [Validators.required, Validators.maxLength(200)]],
    url: [
      '',
      [Validators.required, Validators.maxLength(1000), Validators.pattern(BOARD_LINK_PATTERN)],
    ],
    studentIds: [[] as string[]],
    groupIds: [[] as string[]],
  });

  private readonly chosenKind = toSignal(this.form.controls.kind.valueChanges, {
    initialValue: this.form.controls.kind.value,
  });
  /** The kind of the board: chosen for a new one, fixed for an existing one. */
  protected readonly kind = computed(() => this.board()?.kind ?? this.chosenKind());
  protected readonly kindHint = computed(() =>
    this.kind() === 'EXCALIDRAW'
      ? 'Рисуете вместе с учениками прямо в портале; доска сохраняется сама.'
      : 'Доска в другом сервисе — портал хранит только её название и ссылку.',
  );
  /** Members the board already has stay choosable even when they left. */
  readonly studentOptions = computed(() => this.withMembers(this.students(), 'STUDENT'));
  readonly groupOptions = computed(() => this.withMembers(this.groups(), 'GROUP'));

  constructor() {
    effect(() => {
      if (this.visible()) {
        const board = this.board();
        const defaults = this.defaults();
        this.error.set(null);
        this.form.reset({
          kind: board?.kind ?? 'EXCALIDRAW',
          title: board?.title ?? '',
          url: board?.url ?? '',
          studentIds: board ? this.memberIds(board, 'STUDENT') : [...defaults.studentIds],
          groupIds: board ? this.memberIds(board, 'GROUP') : [...defaults.groupIds],
        });
      }
    });
    effect(() => {
      // The link is checked only for an external board.
      const url = this.form.controls.url;
      if (this.kind() === 'LINK') url.enable();
      else url.disable();
    });
  }

  save(): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    const input: BoardInput = {
      title: value.title.trim(),
      url: this.kind() === 'LINK' ? value.url.trim() : null,
      studentIds: value.studentIds,
      groupIds: value.groupIds,
    };
    const board = this.board();
    this.pending.set(true);
    this.error.set(null);
    (board === null ? this.api.create(value.kind, input) : this.api.change(board, input)).subscribe(
      {
        next: (saved) => {
          this.pending.set(false);
          this.visible.set(false);
          this.saved.emit(saved);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, 'Не удалось сохранить. Попробуйте позже'));
        },
      },
    );
  }

  private memberIds(board: Board, type: 'STUDENT' | 'GROUP'): string[] {
    return board.members.filter((member) => member.type === type).map((member) => member.id);
  }

  private withMembers(options: readonly MemberOption[], type: 'STUDENT' | 'GROUP'): MemberOption[] {
    const missing = (this.board()?.members ?? [])
      .filter(
        (member) => member.type === type && !options.some((option) => option.id === member.id),
      )
      .map((member) => ({ id: member.id, name: member.name ?? 'Нет в списке' }));
    return [...options, ...missing];
  }
}
