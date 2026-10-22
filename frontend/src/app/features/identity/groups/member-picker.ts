import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormsModule, NgControl } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';
import { T } from '../i18n/texts';

/** Keep explicit choices separate from any students resolved from group membership. */
export interface MemberSelection {
  readonly kind: 'STUDENT' | 'GROUP';
  readonly id: string;
}

export interface MemberPickerOption {
  readonly id: string;
  readonly name: string;
  /** For example, a login that distinguishes namesakes. */
  readonly detail?: string;
  readonly unavailable?: boolean;
}

@Component({
  selector: 'tb-member-picker',
  imports: [FormsModule, MultiSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-multiselect
      [inputId]="inputId()"
      [ariaLabelledBy]="labelledBy()"
      [ngModel]="selected()"
      (ngModelChange)="choose($event)"
      [ngModelOptions]="{ standalone: true }"
      [options]="sections()"
      [group]="true"
      optionGroupLabel="label"
      optionGroupChildren="items"
      optionLabel="label"
      optionValue="member"
      optionDisabled="disabled"
      [filter]="true"
      filterBy="label"
      [filterPlaceHolder]="t.search"
      [ariaFilterLabel]="t.search"
      [placeholder]="placeholder() || t.placeholder"
      [showToggleAll]="false"
      [showClear]="true"
      [selectionLimit]="selectionLimit()"
      [maxSelectedLabels]="selected().length + 1"
      [disabled]="disabled()"
      [invalid]="!!control?.invalid && (!!control?.touched || !!control?.dirty)"
      [fluid]="true"
      display="chip"
      appendTo="body"
      (onBlur)="touch()"
      (onPanelHide)="touch()"
    />
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
  `,
})
export class MemberPicker implements ControlValueAccessor, OnInit {
  protected readonly t = T.memberPicker;
  protected readonly control = inject(NgControl, { self: true, optional: true });
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly inputId = input.required<string>();
  readonly labelledBy = input<string>();
  readonly placeholder = input('');
  readonly students = input<readonly MemberPickerOption[]>([]);
  readonly groups = input<readonly MemberPickerOption[]>([]);
  /** Undefined permits any number; one supports callers with a single recipient. */
  readonly selectionLimit = input<number>();

  protected readonly selected = signal<readonly MemberSelection[]>([]);
  protected readonly disabled = signal(false);
  private changed: (value: MemberSelection[]) => void = () => undefined;
  private touched: () => void = () => undefined;

  constructor() {
    // Reuse the host form's validity without a circular NG_VALUE_ACCESSOR dependency.
    if (this.control) this.control.valueAccessor = this;
  }

  ngOnInit(): void {
    this.control?.control?.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.changeDetector.markForCheck();
    });
  }

  protected readonly sections = computed(() =>
    (['STUDENT', 'GROUP'] as const).map((kind) => {
      const type = kind === 'STUDENT' ? this.t.student : this.t.group;
      const options = kind === 'STUDENT' ? this.students() : this.groups();
      const byId = new Map(options.map((option) => [option.id, option]));
      for (const member of this.selected()) {
        if (member.kind === kind && !byId.has(member.id)) {
          byId.set(member.id, { id: member.id, name: member.id, unavailable: true });
        }
      }
      return {
        label: kind === 'STUDENT' ? this.t.students : this.t.groups,
        items: [...byId.values()].map((option) => ({
          member: { kind, id: option.id },
          label: `${type}: ${option.name}${option.detail ? ` (${option.detail})` : ''}${option.unavailable ? ` — ${this.t.unavailable}` : ''}`,
          disabled: option.unavailable === true,
        })),
      };
    }),
  );

  writeValue(value: readonly MemberSelection[] | null): void {
    this.selected.set(this.unique(value ?? []));
  }

  registerOnChange(fn: (value: MemberSelection[]) => void): void {
    this.changed = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.touched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected choose(value: readonly MemberSelection[] | null): void {
    if (this.disabled()) return;
    const selected = this.unique(value ?? []);
    const limit = this.selectionLimit();
    if (limit !== undefined && selected.length > limit && selected.length > this.selected().length)
      return;
    this.selected.set(selected);
    this.changed(selected);
    this.touch();
  }

  protected touch(): void {
    this.touched();
  }

  private unique(value: readonly MemberSelection[]): MemberSelection[] {
    return [...new Map(value.map((member) => [`${member.kind}:${member.id}`, member])).values()];
  }
}
