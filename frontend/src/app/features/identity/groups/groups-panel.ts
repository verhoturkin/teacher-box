import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { BillingApi } from '@features/billing/parts';
import { BoardCell, BoardsDialog, OwnerBoards } from '@features/boards/parts';
import {
  MeetingRoom,
  MeetingsApi,
  RoomCell,
  RoomDialog,
  RoomOwnerRef,
} from '@features/meetings/parts';
import { MoneyPipe } from '@shared/money/money.pipe';
import { RowType } from '@shared/ui/row-type.directive';
import { IdentityApi } from '../data-access/identity-api';
import { Student, StudentGroup } from '../data-access/identity.models';
import { GroupFormDialog, SavedGroup } from './group-form-dialog';
import { EmptyState } from '@shared/ui/empty-state';
import { HelpButton } from '@features/help/parts';
import { dangerConfirmation } from '@shared/ui/confirmation';

/** Teacher: groups of students taught together, their members and lesson prices (under the students). */
@Component({
  selector: 'tb-groups-panel',
  imports: [
    EmptyState,
    ReactiveFormsModule,
    Button,
    Card,
    ConfirmDialog,
    TableModule,
    Tag,
    ToggleSwitch,
    Tooltip,
    MoneyPipe,
    RowType,
    BoardCell,
    BoardsDialog,
    GroupFormDialog,
    RoomCell,
    RoomDialog,
    HelpButton,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text">Группы <tb-help-button topic="teacher/groups" /></span>
          <div class="tb-card-title__actions">
            <p-button
              label="Создать группу"
              severity="secondary"
              icon="pi pi-users"
              (onClick)="openCreate()"
            />
          </div>
        </div>
      </ng-template>
      <div class="tb-toolbar">
        <label class="tb-switch" for="show-archived">
          <p-toggleswitch inputId="show-archived" [formControl]="showArchived" />
          Показывать архив
        </label>
      </div>

      <p-table
        [value]="visibleGroups()"
        [loading]="loading()"
        dataKey="id"
        [rowHover]="true"
        styleClass="tb-cards tb-cards--wide"
      >
        <ng-template #header>
          <tr>
            <th>Группа</th>
            <th>Ученики</th>
            <th>Цена занятия</th>
            <th>Видеовстреча</th>
            <th>Доски</th>
            <th class="tb-actions-column"><span class="tb-sr-only">Действия</span></th>
          </tr>
        </ng-template>
        <ng-template #body let-group [tbRowType]="visibleGroups()">
          <tr>
            <td data-label="Группа">
              <div class="tb-person">
                <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-users"></i></span>
                <span class="tb-list__title">
                  {{ group.name }}
                  @if (group.archivedAt) {
                    <p-tag value="В архиве" severity="secondary" />
                  }
                </span>
              </div>
            </td>
            <td data-label="Ученики">
              @if (group.members.length === 0) {
                <span class="tb-muted">Пока никого</span>
              } @else {
                {{ memberNames(group) }}
              }
            </td>
            <td data-label="Цена занятия">
              @if (priceOf(group.id); as price) {
                {{ price | money: currency() }}
              } @else {
                <span class="tb-muted">—</span>
              }
            </td>
            <td data-label="Видеовстреча">
              @if (!group.archivedAt) {
                <tb-room-cell
                  [room]="roomOf(group.id)"
                  [name]="group.name"
                  (edit)="openRoom({ type: 'GROUP', id: group.id, name: group.name })"
                />
              }
            </td>
            <td data-label="Доски">
              @if (!group.archivedAt) {
                <tb-board-cell
                  [boards]="boards.of(group.id)"
                  [name]="group.name"
                  (edit)="boards.open({ type: 'GROUP', id: group.id, name: group.name })"
                />
              }
            </td>
            <td class="tb-actions-column">
              <p-button
                icon="pi pi-pencil"
                [text]="true"
                severity="secondary"
                [rounded]="true"
                pTooltip="Изменить"
                [ariaLabel]="'Изменить группу: ' + group.name"
                (onClick)="openEdit(group)"
              />
              @if (group.archivedAt) {
                <p-button
                  icon="pi pi-replay"
                  [text]="true"
                  severity="secondary"
                  [rounded]="true"
                  pTooltip="Вернуть из архива"
                  [ariaLabel]="'Вернуть из архива: ' + group.name"
                  (onClick)="restore(group)"
                />
              } @else {
                <p-button
                  icon="pi pi-inbox"
                  [text]="true"
                  severity="danger"
                  [rounded]="true"
                  pTooltip="В архив"
                  [ariaLabel]="'В архив: ' + group.name"
                  (onClick)="confirmArchive(group)"
                />
              }
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="6">
              @if (groups().length === 0) {
                <tb-empty-state
                  icon="pi-users"
                  title="Групп пока нет"
                  hint="Создайте группу, если занимаетесь с несколькими учениками сразу"
                >
                  <p-button
                    label="Создать группу"
                    severity="secondary"
                    icon="pi pi-users"
                    (onClick)="openCreate()"
                  />
                </tb-empty-state>
              } @else {
                <tb-empty-state icon="pi-box" title="Все группы в архиве" />
              }
            </td>
          </tr>
        </ng-template>
      </p-table>
    </p-card>

    <tb-group-form-dialog
      [(visible)]="formVisible"
      [group]="edited()"
      [students]="students()"
      [lessonPrice]="editedPrice()"
      [currency]="currency()"
      (saved)="onSaved($event)"
    />
    <tb-room-dialog
      [(visible)]="roomVisible"
      [owner]="roomOwner()"
      [room]="ownerRoom()"
      [canCreate]="canCreateRooms()"
      (changed)="onRoomChanged($event)"
    />
    <tb-boards-dialog
      [(visible)]="boards.visible"
      [owner]="boards.owner()"
      [boards]="boards.ownerBoards()"
      (saved)="boards.saved($event)"
      (removed)="boards.removed($event)"
    />
    <p-confirmdialog key="groups" />
  `,
  styles: ``,
})
export class GroupsPanel implements OnInit {
  private readonly api = inject(IdentityApi);
  private readonly billing = inject(BillingApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly meetings = inject(MeetingsApi);

  /** Students of the teacher: the members to choose from. */
  readonly students = input<readonly Student[]>([]);
  /** A group was created, changed or archived. */
  readonly changed = output();

  protected readonly groups = signal<StudentGroup[]>([]);
  private readonly prices = signal<ReadonlyMap<string, number>>(new Map());
  protected readonly currency = signal('RUB');
  protected readonly loading = signal(true);
  protected readonly showArchived = new FormControl(false, { nonNullable: true });
  private readonly includeArchived = toSignal(this.showArchived.valueChanges, {
    initialValue: false,
  });
  protected readonly visibleGroups = computed(() => {
    // New rows when the rooms or boards arrive: the table re-renders the columns only for a new value.
    this.rooms();
    this.boards.byOwner();
    return this.groups().filter((group) => this.includeArchived() || group.archivedAt === null);
  });

  protected readonly rooms = signal<ReadonlyMap<string, MeetingRoom>>(new Map());
  protected readonly canCreateRooms = signal(false);
  protected readonly boards = new OwnerBoards();
  protected readonly roomVisible = signal(false);
  protected readonly roomOwner = signal<RoomOwnerRef | null>(null);
  protected readonly ownerRoom = computed(() => {
    const owner = this.roomOwner();
    return owner === null ? null : this.roomOf(owner.id);
  });
  protected readonly formVisible = signal(false);
  protected readonly edited = signal<StudentGroup | null>(null);
  protected readonly editedPrice = computed(() => {
    const group = this.edited();
    return group === null ? null : this.priceOf(group.id);
  });

  ngOnInit(): void {
    forkJoin({
      groups: this.api.listGroups(),
      prices: this.billing.groupPrices(),
    }).subscribe({
      next: ({ groups, prices }) => {
        this.groups.set(groups);
        this.currency.set(prices.currency);
        this.prices.set(new Map(prices.prices.map((price) => [price.groupId, price.lessonPrice])));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
    this.loadRooms();
    this.boards.load();
  }

  protected roomOf(ownerId: string): MeetingRoom | null {
    return this.rooms().get(ownerId) ?? null;
  }

  protected openRoom(owner: RoomOwnerRef): void {
    this.roomOwner.set(owner);
    this.roomVisible.set(true);
  }

  protected onRoomChanged(room: MeetingRoom | null): void {
    const owner = this.roomOwner();
    if (owner === null) {
      return;
    }
    this.rooms.update((rooms) => {
      const next = new Map(rooms);
      if (room === null) {
        next.delete(owner.id);
      } else {
        next.set(owner.id, room);
      }
      return next;
    });
  }

  private loadRooms(): void {
    this.meetings.rooms().subscribe((rooms) => {
      this.rooms.set(new Map(rooms.map((room) => [room.ownerId, room])));
    });
    this.meetings.yandexStatus().subscribe((status) => {
      this.canCreateRooms.set(status.status === 'CONNECTED' || status.tokenFromEnvironment);
    });
  }

  protected memberNames(group: StudentGroup): string {
    return group.members.map((member) => member.displayName).join(', ');
  }

  protected priceOf(groupId: string): number | null {
    return this.prices().get(groupId) ?? null;
  }

  protected openCreate(): void {
    this.edited.set(null);
    this.formVisible.set(true);
  }

  protected openEdit(group: StudentGroup): void {
    this.edited.set(group);
    this.formVisible.set(true);
  }

  protected onSaved({ group, lessonPrice }: SavedGroup): void {
    this.replace(group);
    if (lessonPrice !== null) {
      this.prices.update((prices) => new Map(prices).set(group.id, lessonPrice));
    }
  }

  protected confirmArchive(group: StudentGroup): void {
    this.confirmation.confirm(
      dangerConfirmation({
        key: 'groups',
        header: 'Убрать группу в архив?',
        message: `Регулярные занятия группы «${group.name}» остановятся, будущие занятия отменятся. Проведённые занятия и оплаты сохранятся.`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'В архив',
        rejectLabel: 'Отмена',
        accept: () => {
          this.api.archiveGroup(group.id).subscribe((saved) => {
            this.replace(saved);
          });
        },
      }),
    );
  }

  protected restore(group: StudentGroup): void {
    this.api.restoreGroup(group.id).subscribe((saved) => {
      this.replace(saved);
    });
  }

  private replace(saved: StudentGroup): void {
    this.groups.update((groups) =>
      sortGroups([...groups.filter((group) => group.id !== saved.id), saved]),
    );
    this.changed.emit();
  }
}

/** Current groups first, then by name. */
function sortGroups(groups: StudentGroup[]): StudentGroup[] {
  return groups.sort(
    (a, b) =>
      Number(a.archivedAt !== null) - Number(b.archivedAt !== null) ||
      a.name.localeCompare(b.name, 'ru'),
  );
}
