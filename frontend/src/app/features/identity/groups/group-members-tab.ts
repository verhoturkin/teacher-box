import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { labelKey } from '@core/theme/label-colors';
import { Avatar } from '@shared/ui/avatar';
import { EmptyState } from '@shared/ui/empty-state';
import { ChipColors } from '../colors/chip-colors';
import { IdentityApi } from '../data-access/identity-api';
import { GroupMember, Student, StudentGroup } from '../data-access/identity.models';
import { T } from '../i18n/texts';
import { STATUS_LABELS, STATUS_SEVERITIES } from '../students/student-status';
import { groupInput } from './group-input';

/**
 * The Участники tab of a group's card (redesign spec §8): the members, each a link to their card with «убрать
 * из группы»; under them the current students who are not in the group yet, added by the tonal «Добавить».
 */
@Component({
  selector: 'tb-group-members-tab',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Avatar,
    Button,
    Card,
    ChipColors,
    EmptyState,
    Message,
    MultiSelect,
    Tag,
    Tooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      @if (members().length === 0) {
        <tb-empty-state [compact]="true" icon="tb-i-group" [title]="t.empty" [hint]="t.emptyHint" />
      } @else {
        <ul class="tb-list" [attr.aria-label]="t.title">
          @for (member of members(); track member.id) {
            <li>
              <tb-avatar
                [attr.data-tb-label]="colorOf(member)"
                [name]="member.displayName"
                [photo]="photoOf(member)"
              />
              <div class="tb-list__text">
                <a
                  class="tb-list__title tb-list__link"
                  [routerLink]="['/teacher/students', member.id]"
                  >{{ member.displayName }}</a
                >
              </div>
              <div class="tb-list__trail tb-list__trail--icons">
                @if (member.status !== 'ACTIVE') {
                  <p-tag
                    [value]="statusLabels[member.status]"
                    [severity]="statusSeverities[member.status]"
                  />
                }
                <p-button
                  icon="tb-i tb-i-person_remove"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [ariaLabel]="t.remove(member.displayName)"
                  [pTooltip]="t.remove(member.displayName)"
                  [loading]="removing() === member.id"
                  [disabled]="pending()"
                  (onClick)="remove(member)"
                />
              </div>
            </li>
          }
        </ul>
      }

      <form class="tb-form tb-group-members__add" [formGroup]="form" (ngSubmit)="add()">
        <div class="tb-field">
          <label for="group-members-add">{{ t.add }}</label>
          <p-multiselect
            inputId="group-members-add"
            formControlName="memberIds"
            [options]="candidates()"
            optionLabel="displayName"
            optionValue="id"
            [placeholder]="candidates().length === 0 ? t.nobodyToAdd : t.addPlaceholder"
            [filter]="true"
            [filterPlaceHolder]="f.search"
            [ariaFilterLabel]="f.search"
            display="chip"
            tbChipColors="student"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
        <div class="tb-form-actions">
          <p-button
            type="submit"
            severity="secondary"
            [label]="t.addAction"
            icon="tb-i tb-i-person_add"
            [disabled]="picked().length === 0"
            [loading]="pending() && removing() === null"
          />
        </div>
      </form>
    </p-card>
  `,
  styles: `
    .tb-group-members__add {
      margin-block-start: var(--tb-space-4);
    }
  `,
})
export class GroupMembersTab {
  protected readonly t = T.groupMembers;
  protected readonly f = T.groupForm;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusSeverities = STATUS_SEVERITIES;
  private readonly api = inject(IdentityApi);
  private readonly snackbar = inject(Snackbar);

  readonly group = input.required<StudentGroup>();
  /** Every student of the teacher: the photos and colours of the members, the ones to add. */
  readonly students = input<readonly Student[]>([]);
  /** The members changed: the page puts the group in its list. */
  readonly saved = output<StudentGroup>();

  protected readonly pending = signal(false);
  /** The member being taken off. */
  protected readonly removing = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  readonly chosen = new FormControl<string[]>([], { nonNullable: true });
  protected readonly form = new FormGroup({ memberIds: this.chosen });
  protected readonly picked = toSignal(this.chosen.valueChanges, { initialValue: [] });

  protected readonly members = computed(() =>
    [...this.group().members].sort((a, b) => a.displayName.localeCompare(b.displayName)),
  );
  private readonly byId = computed(
    () => new Map(this.students().map((student) => [student.id, student])),
  );
  /** Current students who are not in the group. */
  protected readonly candidates = computed(() => {
    const members = new Set(this.group().members.map((member) => member.id));
    return this.students().filter(
      (student) => student.status !== 'DEACTIVATED' && !members.has(student.id),
    );
  });

  protected photoOf(member: GroupMember): string | null {
    return this.byId().get(member.id)?.avatar ?? null;
  }

  protected colorOf(member: GroupMember): string | null {
    const color = this.byId().get(member.id)?.color ?? null;
    return color === null ? null : labelKey(color);
  }

  protected add(): void {
    const ids = this.chosen.value;
    if (ids.length === 0 || this.pending()) {
      return;
    }
    const memberIds = [...this.group().members.map((member) => member.id), ...ids];
    this.save(memberIds, null, () => {
      this.chosen.setValue([]);
      this.snackbar.success(this.t.added);
    });
  }

  protected remove(member: GroupMember): void {
    if (this.pending()) {
      return;
    }
    const memberIds = this.group()
      .members.map((item) => item.id)
      .filter((id) => id !== member.id);
    this.save(memberIds, member.id, () => {
      this.snackbar.success(this.t.removed(member.displayName));
    });
  }

  private save(memberIds: string[], removing: string | null, done: () => void): void {
    const group = this.group();
    this.pending.set(true);
    this.removing.set(removing);
    this.error.set(null);
    this.api.updateGroup(group.id, groupInput(group, { memberIds }), group.version).subscribe({
      next: (saved) => {
        this.pending.set(false);
        this.removing.set(null);
        this.saved.emit(saved);
        done();
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.removing.set(null);
        this.error.set(describeError(error, this.f.failed));
      },
    });
  }
}
