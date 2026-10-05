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
import { ConfirmationService } from 'primeng/api';
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
import {
  MeetingRoom,
  MeetingsApi,
  RoomCell,
  RoomDialog,
  RoomOwnerRef,
} from '@features/meetings/parts';
import { RowType } from '@shared/ui/row-type.directive';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { OpenCards } from '@shared/ui/open-cards';
import { IdentityApi } from '../data-access/identity-api';
import { CreatedStudent, IssuedInvite, Student } from '../data-access/identity.models';
import { GroupsPanel } from '../groups/groups-panel';
import { InviteLinkDialog } from './invite-link-dialog';
import { StudentFormDialog } from './student-form-dialog';
import { INVITE_PURPOSE_LABELS, STATUS_LABELS, STATUS_SEVERITIES } from './student-status';
import { quietContext } from '@core/http/api-error.interceptor';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { InitialsPipe } from '@shared/ui/initials';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';

/** Teacher: the list of students, invitations and access management; groups of students. */
@Component({
  selector: 'tb-students-page',
  imports: [
    InitialsPipe,
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
    ButtonAttributes,
    GroupsPanel,
    InviteLinkDialog,
    RoomCell,
    RoomDialog,
    StudentFormDialog,
    LoadStateView,
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
        <h2 class="tb-sr-only">Список учеников</h2>
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

        <tb-load-state [state]="state" what="учеников" (retry)="loadStudents()">
          <p-table
            [value]="visibleStudents()"
            dataKey="id"
            [rowHover]="true"
            styleClass="tb-cards tb-cards--wide"
          >
            <ng-template #header>
              <tr>
                <th class="tb-col-main">Ученик</th>
                <th class="tb-actions-column"><span class="tb-sr-only">Подробнее</span></th>
              </tr>
            </ng-template>
            <ng-template #body let-student [tbRowType]="visibleStudents()">
              <tr [class.tb-card--open]="cards.isOpen(student.id)">
                <td data-label="Ученик">
                  <div class="tb-person">
                    <span class="tb-avatar" aria-hidden="true">{{
                      student.displayName | initials
                    }}</span>
                    <div class="tb-list__text">
                      <span class="tb-list__title">
                        {{ student.displayName }}
                        @if (student.status === 'DEACTIVATED') {
                          <p-tag
                            [value]="statusLabels[student.status]"
                            [severity]="statusSeverities[student.status]"
                          />
                        }
                      </span>
                      @if (student.phone) {
                        <span class="tb-list__supporting">{{ student.phone }}</span>
                      }
                    </div>
                  </div>
                </td>
                <td class="tb-actions-column">
                  <p-button
                    [icon]="cards.icon(student.id)"
                    [text]="true"
                    severity="secondary"
                    [rounded]="true"
                    [pTooltip]="cards.isOpen(student.id) ? 'Скрыть подробности' : 'Подробнее'"
                    [ariaLabel]="'Подробнее: ' + student.displayName"
                    [tbAttributes]="{
                      'aria-expanded': cards.isOpen(student.id) ? 'true' : 'false',
                    }"
                    (onClick)="cards.toggle(student.id)"
                  />
                </td>
                @if (cards.isOpen(student.id)) {
                  <td data-label="Почта">
                    @if (student.email) {
                      {{ student.email }}
                    } @else {
                      <span class="tb-muted">—</span>
                    }
                  </td>
                  <td data-label="Статус">
                    <div>
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
                    </div>
                  </td>
                  <td data-label="Логин">{{ student.login ?? '—' }}</td>
                  @if (student.status !== 'DEACTIVATED') {
                    <td data-label="Видеовстреча">
                      <tb-room-cell
                        [room]="roomOf(student.id)"
                        [name]="student.displayName"
                        (edit)="
                          openRoom({ type: 'STUDENT', id: student.id, name: student.displayName })
                        "
                      />
                    </td>
                  }
                  @if (student.note) {
                    <td data-label="Заметка" class="tb-cell-long">{{ student.note }}</td>
                  }
                  <td class="tb-card-actions">
                    <p-button
                      label="Изменить"
                      icon="pi pi-pencil"
                      [text]="true"
                      severity="secondary"
                      [ariaLabel]="'Изменить: ' + student.displayName"
                      (onClick)="openEdit(student)"
                    />
                    @if (student.status === 'DEACTIVATED') {
                      <p-button
                        label="Вернуть доступ"
                        icon="pi pi-replay"
                        [text]="true"
                        severity="secondary"
                        [ariaLabel]="'Вернуть доступ: ' + student.displayName"
                        [loading]="busy.is('reactivate-' + student.id)"
                        (onClick)="reactivate(student)"
                      />
                    } @else {
                      <p-button
                        [label]="student.status === 'ACTIVE' ? 'Сбросить пароль' : 'Приглашение'"
                        icon="pi pi-link"
                        [text]="true"
                        severity="secondary"
                        [ariaLabel]="linkLabel(student)"
                        [loading]="busy.is('invite-' + student.id)"
                        (onClick)="reissueInvite(student)"
                      />
                      <p-button
                        label="Отключить доступ"
                        icon="pi pi-ban"
                        [text]="true"
                        severity="danger"
                        [ariaLabel]="'Отключить доступ: ' + student.displayName"
                        (onClick)="confirmDeactivate(student)"
                      />
                    }
                  </td>
                }
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr>
                <td colspan="2">
                  @if (students().length === 0) {
                    <tb-empty-state
                      icon="pi-user-plus"
                      title="Учеников пока нет"
                      hint="Нажмите «Добавить ученика» и отправьте ему ссылку-приглашение"
                    />
                  } @else {
                    <tb-empty-state
                      icon="pi-search"
                      title="Никого не найдено"
                      hint="Измените запрос или включите показ отключённых учеников"
                    />
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
        </tb-load-state>
      </p-card>
      <tb-groups-panel [students]="students()" />
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
    <p-confirmdialog />
  `,
})
export class StudentsPage implements OnInit {
  protected readonly busy = new Busy();
  protected readonly cards = new OpenCards();
  private readonly api = inject(IdentityApi);
  private readonly meetings = inject(MeetingsApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(Snackbar);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusSeverities = STATUS_SEVERITIES;
  protected readonly purposeLabels = INVITE_PURPOSE_LABELS;

  /** `?create=...` from the quick actions of the home page: opens the form at once. */
  readonly create = input<string>();

  protected readonly students = signal<Student[]>([]);
  protected readonly rooms = signal<ReadonlyMap<string, MeetingRoom>>(new Map());
  protected readonly canCreateRooms = signal(false);
  protected readonly roomVisible = signal(false);
  protected readonly roomOwner = signal<RoomOwnerRef | null>(null);
  protected readonly ownerRoom = computed(() => {
    const owner = this.roomOwner();
    return owner === null ? null : this.roomOf(owner.id);
  });

  protected readonly state = new LoadState();
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly showDeactivated = new FormControl(false, { nonNullable: true });
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  private readonly includeDeactivated = toSignal(this.showDeactivated.valueChanges, {
    initialValue: false,
  });

  protected readonly visibleStudents = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('ru');
    const includeDeactivated = this.includeDeactivated();
    // New rows when the rooms arrive: the table re-renders the columns only for a new value.
    this.rooms();
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
    this.loadStudents();
    this.loadRooms();
  }

  protected loadStudents(): void {
    this.api
      .listStudents(quietContext())
      .pipe(this.state.track())
      .subscribe((students) => {
        this.students.set(students);
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
    this.snackbar.success(`Сохранено: ${student.displayName}`);
  }

  /** The name and the tooltip of the link button: what the link is for and whose it is. */
  protected linkLabel(student: Student): string {
    const purpose =
      student.status === 'ACTIVE' ? 'Ссылка для сброса пароля' : 'Новая ссылка-приглашение';
    return `${purpose}: ${student.displayName}`;
  }

  protected reissueInvite(student: Student): void {
    this.busy
      .guard('invite-' + student.id, this.api.reissueInvite(student.id))
      .subscribe((invite) => {
        this.replace({
          ...student,
          pendingInvite: { purpose: invite.purpose, expiresAt: invite.expiresAt },
        });
        this.showInvite(student, invite);
      });
  }

  protected confirmDeactivate(student: Student): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: 'Отключить доступ?',
        message: `${student.displayName} не сможет войти в личный кабинет. История занятий и заданий сохранится.`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Отключить',
        accept: () => {
          this.api.deactivate(student.id).subscribe((saved) => {
            this.replace(saved);
          });
        },
      }),
    );
  }

  protected reactivate(student: Student): void {
    this.busy
      .guard('reactivate-' + student.id, this.api.reactivate(student.id))
      .subscribe((saved) => {
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
