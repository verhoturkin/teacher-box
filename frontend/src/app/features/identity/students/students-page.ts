import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { HelpButton } from '@features/help/parts';
import { ButtonAttributes } from '@shared/ui/button-attributes';
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
import { Avatar } from '@shared/ui/avatar';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';

/** Teacher: the list of students, invitations and access management; groups of students. */
@Component({
  selector: 'tb-students-page',
  imports: [
    Avatar,
    EmptyState,
    HelpButton,
    ReactiveFormsModule,
    Button,
    Card,
    ConfirmDialog,
    IconField,
    InputIcon,
    InputText,
    Menu,
    Tag,
    ToggleSwitch,
    Tooltip,
    ButtonAttributes,
    GroupsPanel,
    InviteLinkDialog,
    StudentFormDialog,
    LoadStateView,
    PageHeader,
  ],
  providers: [ConfirmationService, DatePipe],
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
          @if (visibleStudents().length > 0) {
            <ul class="tb-list" aria-label="Ученики">
              @for (student of visibleStudents(); track student.id) {
                <li>
                  <tb-avatar [name]="student.displayName" [photo]="student.avatar" />
                  <div class="tb-list__text">
                    <span
                      class="tb-list__title"
                      [pTooltip]="details(student)"
                      tooltipStyleClass="tb-tooltip-lines"
                      [attr.tabindex]="details(student) ? 0 : null"
                      >{{ student.displayName }}</span
                    >
                    @if (student.phone) {
                      <span class="tb-list__supporting">{{ student.phone }}</span>
                    }
                  </div>
                  <div class="tb-list__trail tb-list__trail--icons">
                    <p-tag
                      [value]="statusLabels[student.status]"
                      [severity]="statusSeverities[student.status]"
                      [pTooltip]="inviteHint(student)"
                    />
                    <p-button
                      icon="pi pi-ellipsis-v"
                      [text]="true"
                      [rounded]="true"
                      severity="secondary"
                      [pTooltip]="'Действия: ' + student.displayName"
                      [ariaLabel]="'Действия: ' + student.displayName"
                      [loading]="
                        busy.is('invite-' + student.id) || busy.is('reactivate-' + student.id)
                      "
                      [tbAttributes]="{
                        'aria-haspopup': 'menu',
                        'aria-expanded': menuFor()?.id === student.id ? 'true' : 'false',
                      }"
                      (onClick)="openMenu(student, $event)"
                    />
                  </div>
                </li>
              }
            </ul>
          } @else if (students().length === 0) {
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
        </tb-load-state>
      </p-card>
      <tb-groups-panel [students]="students()" />
    </div>

    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />
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
    <p-confirmdialog />
  `,
})
export class StudentsPage implements OnInit {
  protected readonly busy = new Busy();
  private readonly api = inject(IdentityApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(Snackbar);
  private readonly date = inject(DatePipe);
  private readonly menu = viewChild.required<Menu>('menu');

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusSeverities = STATUS_SEVERITIES;

  /** `?create=...` from the quick actions of the home page: opens the form at once. */
  readonly create = input<string>();

  protected readonly students = signal<Student[]>([]);

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
    return this.students().filter(
      (student) =>
        (includeDeactivated || student.status !== 'DEACTIVATED') &&
        student.displayName.toLocaleLowerCase('ru').includes(query),
    );
  });

  /** The student whose «⋮» menu is open: one popup menu serves every row. */
  protected readonly menuFor = signal<Student | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const student = this.menuFor();
    return student === null ? [] : this.actionsOf(student);
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
  }

  protected loadStudents(): void {
    this.api
      .listStudents(quietContext())
      .pipe(this.state.track())
      .subscribe((students) => {
        this.students.set(students);
      });
  }

  /** The tooltip of the name: the login and the note (one per line), or none. */
  protected details(student: Student): string {
    return [
      student.login === null ? null : `Логин: ${student.login}`,
      student.note === null ? null : `Заметка: ${student.note}`,
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  /** The tooltip of the status: until when the issued link works. */
  protected inviteHint(student: Student): string {
    const invite = student.pendingInvite;
    if (invite === null) {
      return '';
    }
    const until = this.date.transform(invite.expiresAt, 'dd.MM.yyyy') ?? '';
    return `${INVITE_PURPOSE_LABELS[invite.purpose]} до ${until}`;
  }

  protected openMenu(student: Student, event: Event): void {
    this.menuFor.set(student);
    this.menu().toggle(event);
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

  private actionsOf(student: Student): MenuItem[] {
    const items: MenuItem[] = [
      {
        label: 'Изменить',
        icon: 'pi pi-pencil',
        command: () => {
          this.openEdit(student);
        },
      },
    ];
    if (student.status === 'DEACTIVATED') {
      items.push({
        label: 'Вернуть доступ',
        icon: 'pi pi-replay',
        command: () => {
          this.reactivate(student);
        },
      });
    } else {
      items.push(
        {
          label: student.status === 'ACTIVE' ? 'Сбросить пароль' : 'Новое приглашение',
          icon: 'pi pi-link',
          command: () => {
            this.reissueInvite(student);
          },
        },
        {
          label: 'Отключить доступ…',
          icon: 'pi pi-ban',
          styleClass: 'tb-menu-item--danger',
          command: () => {
            this.confirmDeactivate(student);
          },
        },
      );
    }
    return items;
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
