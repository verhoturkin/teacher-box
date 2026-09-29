import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { HelpButton } from '@features/help/parts';
import { BoardCell, BoardsDialog, OwnerBoards } from '@features/boards/parts';
import {
  MeetingRoom,
  MeetingsApi,
  RoomCell,
  RoomDialog,
  RoomOwnerRef,
} from '@features/meetings/parts';
import { RowType } from '@shared/ui/row-type.directive';
import { IdentityApi } from '../data-access/identity-api';
import {
  CreatedStudent,
  IssuedInvite,
  Student,
  StudentGroup,
} from '../data-access/identity.models';
import { GroupsPanel } from '../groups/groups-panel';
import { InviteLinkDialog } from './invite-link-dialog';
import { StudentFormDialog } from './student-form-dialog';
import { INVITE_PURPOSE_LABELS, STATUS_LABELS, STATUS_SEVERITIES } from './student-status';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';

/** Teacher: the list of students, invitations and access management; groups of students. */
@Component({
  selector: 'tb-students-page',
  imports: [
    EmptyState,
    HelpButton,
    DatePipe,
    ReactiveFormsModule,
    Button,
    Card,
    ConfirmDialog,
    IconField,
    InputIcon,
    InputText,
    TableModule,
    Tag,
    ToggleSwitch,
    Tooltip,
    RowType,
    BoardCell,
    BoardsDialog,
    GroupsPanel,
    InviteLinkDialog,
    RoomCell,
    RoomDialog,
    StudentFormDialog,
    PageHeader,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Ученики">
      <tb-help-button help topic="teacher/students" />
      <p-button
        class="tb-page-fab"
        label="Добавить ученика"
        icon="pi pi-user-plus"
        (onClick)="openCreate()"
      />
    </tb-page-header>

    <div class="tb-stack">
      <p-card>
        <div class="tb-toolbar">
          <p-iconfield>
            <p-inputicon styleClass="pi pi-search" />
            <input
              pInputText
              [formControl]="search"
              placeholder="Поиск по имени"
              aria-label="Поиск по имени"
            />
          </p-iconfield>
          <label class="tb-switch" for="show-deactivated">
            <p-toggleswitch inputId="show-deactivated" [formControl]="showDeactivated" />
            Показывать отключённых
          </label>
        </div>

        <p-table
          [value]="visibleStudents()"
          [loading]="loading()"
          dataKey="id"
          [rowHover]="true"
          styleClass="tb-cards tb-cards--wide"
        >
          <ng-template #header>
            <tr>
              <th class="tb-col-main">Имя</th>
              <th>Контакты</th>
              <th>Группы</th>
              <th>Видеовстреча</th>
              <th>Доски</th>
              <th>Статус</th>
              <th>Логин</th>
              <th class="tb-actions-column"><span class="tb-sr-only">Действия</span></th>
            </tr>
          </ng-template>
          <ng-template #body let-student [tbRowType]="visibleStudents()">
            <tr>
              <td data-label="Имя">
                <div class="tb-strong">{{ student.displayName }}</div>
                @if (student.note) {
                  <small class="tb-muted">{{ student.note }}</small>
                }
              </td>
              <td data-label="Контакты">
                <div>{{ student.email ?? '' }}</div>
                <div>{{ student.phone ?? '' }}</div>
              </td>
              <td data-label="Группы">{{ groupNames(student.id) }}</td>
              <td data-label="Видеовстреча">
                @if (student.status !== 'DEACTIVATED') {
                  <tb-room-cell
                    [room]="roomOf(student.id)"
                    [name]="student.displayName"
                    (edit)="
                      openRoom({ type: 'STUDENT', id: student.id, name: student.displayName })
                    "
                  />
                }
              </td>
              <td data-label="Доски">
                @if (student.status !== 'DEACTIVATED') {
                  <tb-board-cell
                    [boards]="boards.of(student.id)"
                    [name]="student.displayName"
                    (edit)="
                      boards.open({
                        type: 'STUDENT',
                        id: student.id,
                        name: student.displayName,
                      })
                    "
                  />
                }
              </td>
              <td data-label="Статус">
                <p-tag
                  [value]="statusLabels[student.status]"
                  [severity]="statusSeverities[student.status]"
                />
                @if (student.pendingInvite; as invite) {
                  <div>
                    <small class="tb-muted">
                      {{ purposeLabels[invite.purpose] }} до
                      {{ invite.expiresAt | date: 'dd.MM.yyyy' }}
                    </small>
                  </div>
                }
              </td>
              <td data-label="Логин">{{ student.login ?? '—' }}</td>
              <td class="tb-actions-column">
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  severity="secondary"
                  [rounded]="true"
                  pTooltip="Редактировать"
                  [ariaLabel]="'Редактировать: ' + student.displayName"
                  (onClick)="openEdit(student)"
                />
                @if (student.status === 'DEACTIVATED') {
                  <p-button
                    icon="pi pi-replay"
                    [text]="true"
                    severity="secondary"
                    [rounded]="true"
                    pTooltip="Вернуть доступ"
                    [ariaLabel]="'Вернуть доступ: ' + student.displayName"
                    (onClick)="reactivate(student)"
                  />
                } @else {
                  <p-button
                    icon="pi pi-link"
                    [text]="true"
                    severity="secondary"
                    [rounded]="true"
                    [pTooltip]="
                      student.status === 'ACTIVE'
                        ? 'Ссылка для сброса пароля'
                        : 'Новая ссылка-приглашение'
                    "
                    [ariaLabel]="'Ссылка: ' + student.displayName"
                    (onClick)="reissueInvite(student)"
                  />
                  <p-button
                    icon="pi pi-ban"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    pTooltip="Отключить доступ"
                    [ariaLabel]="'Отключить доступ: ' + student.displayName"
                    (onClick)="confirmDeactivate(student)"
                  />
                }
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="8">
                @if (students().length === 0) {
                  <tb-empty-state
                    icon="pi-user-plus"
                    title="Учеников пока нет"
                    hint="Добавьте первого ученика и отправьте ему ссылку-приглашение"
                  >
                    <p-button
                      label="Добавить ученика"
                      icon="pi pi-user-plus"
                      severity="secondary"
                      (onClick)="openCreate()"
                    />
                  </tb-empty-state>
                } @else {
                  <tb-empty-state icon="pi-search" title="Никого не найдено" />
                }
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>
      <tb-groups-panel [students]="students()" (changed)="loadGroups()" />
    </div>

    <tb-student-form-dialog
      [(visible)]="formVisible"
      [student]="editedStudent()"
      (created)="onCreated($event)"
      (updated)="onUpdated($event)"
    />
    <tb-invite-link-dialog
      [(visible)]="inviteVisible"
      [invite]="invite()"
      [studentName]="inviteStudentName()"
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
    <p-confirmdialog />
  `,
})
export class StudentsPage implements OnInit {
  private readonly api = inject(IdentityApi);
  private readonly meetings = inject(MeetingsApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusSeverities = STATUS_SEVERITIES;
  protected readonly purposeLabels = INVITE_PURPOSE_LABELS;

  /** `?create=...` from the quick actions of the home page: opens the form at once. */
  readonly create = input<string>();

  protected readonly students = signal<Student[]>([]);
  private readonly groups = signal<StudentGroup[]>([]);
  protected readonly rooms = signal<ReadonlyMap<string, MeetingRoom>>(new Map());
  protected readonly canCreateRooms = signal(false);
  protected readonly boards = new OwnerBoards();
  protected readonly roomVisible = signal(false);
  protected readonly roomOwner = signal<RoomOwnerRef | null>(null);
  protected readonly ownerRoom = computed(() => {
    const owner = this.roomOwner();
    return owner === null ? null : this.roomOf(owner.id);
  });

  protected readonly loading = signal(true);
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly showDeactivated = new FormControl(false, { nonNullable: true });
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  private readonly includeDeactivated = toSignal(this.showDeactivated.valueChanges, {
    initialValue: false,
  });

  protected readonly visibleStudents = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('ru');
    const includeDeactivated = this.includeDeactivated();
    // New rows when the groups, rooms or boards arrive: the table re-renders the columns only for a new value.
    this.groups();
    this.rooms();
    this.boards.byOwner();
    return this.students().filter(
      (student) =>
        (includeDeactivated || student.status !== 'DEACTIVATED') &&
        student.displayName.toLocaleLowerCase('ru').includes(query),
    );
  });

  protected readonly formVisible = signal(false);
  protected readonly editedStudent = signal<Student | null>(null);
  protected readonly inviteVisible = signal(false);
  protected readonly invite = signal<IssuedInvite | null>(null);
  protected readonly inviteStudentName = signal('');

  ngOnInit(): void {
    if (this.create() === 'student') {
      this.openCreate();
    }
    this.api.listStudents().subscribe({
      next: (students) => {
        this.students.set(students);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
    this.loadGroups();
    this.loadRooms();
    this.boards.load();
  }

  protected loadGroups(): void {
    this.api.listGroups().subscribe((groups) => {
      this.groups.set(groups);
    });
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

  /** Current groups of the student. */
  protected groupNames(studentId: string): string {
    return this.groups()
      .filter(
        (group) =>
          group.archivedAt === null && group.members.some((member) => member.id === studentId),
      )
      .map((group) => group.name)
      .join(', ');
  }

  protected openCreate(): void {
    this.editedStudent.set(null);
    this.formVisible.set(true);
  }

  protected openEdit(student: Student): void {
    this.editedStudent.set(student);
    this.formVisible.set(true);
  }

  protected onCreated(created: CreatedStudent): void {
    this.students.update((students) => sortByName([...students, created.student]));
    this.showInvite(created.student, created.invite);
  }

  protected onUpdated(student: Student): void {
    this.replace(student);
    this.messages.add({ severity: 'success', summary: 'Сохранено', detail: student.displayName });
  }

  protected reissueInvite(student: Student): void {
    this.api.reissueInvite(student.id).subscribe((invite) => {
      this.replace({
        ...student,
        pendingInvite: { purpose: invite.purpose, expiresAt: invite.expiresAt },
      });
      this.showInvite(student, invite);
    });
  }

  protected confirmDeactivate(student: Student): void {
    this.confirmation.confirm({
      header: 'Отключить доступ?',
      message: `${student.displayName} не сможет войти в личный кабинет. История занятий и заданий сохранится.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Отключить',
      rejectLabel: 'Отмена',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.api.deactivate(student.id).subscribe((saved) => {
          this.replace(saved);
        });
      },
    });
  }

  protected reactivate(student: Student): void {
    this.api.reactivate(student.id).subscribe((saved) => {
      this.replace(saved);
    });
  }

  private showInvite(student: Student, invite: IssuedInvite): void {
    this.inviteStudentName.set(student.displayName);
    this.invite.set(invite);
    this.inviteVisible.set(true);
  }

  private replace(saved: Student): void {
    this.students.update((students) =>
      sortByName(students.map((student) => (student.id === saved.id ? saved : student))),
    );
  }
}

function sortByName(students: Student[]): Student[] {
  return students.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));
}
