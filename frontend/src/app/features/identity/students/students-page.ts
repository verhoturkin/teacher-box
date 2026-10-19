import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { HelpButton } from '@features/help/parts';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { TeacherColors } from '../colors/teacher-colors';
import { IdentityApi } from '../data-access/identity-api';
import { CreatedStudent, IssuedInvite, Student } from '../data-access/identity.models';
import { GroupsPanel } from '../groups/groups-panel';
import { InviteLinkDialog } from './invite-link-dialog';
import { StudentFormDialog } from './student-form-dialog';
import { INVITE_PURPOSE_LABELS, STATUS_LABELS, STATUS_SEVERITIES } from './student-status';
import { injectMobile } from '@core/layout/mobile';
import { quietContext } from '@core/http/api-error.interceptor';
import { labelKey } from '@core/theme/label-colors';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { Avatar } from '@shared/ui/avatar';
import { openOnCreate } from '@core/routing/create-param';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { T } from '../i18n/texts';
import { SearchField } from '@shared/ui/search-field';

/** Teacher: the list of students, invitations and access management; groups of students. */
@Component({
  selector: 'tb-students-page',
  imports: [
    SearchField,
    Avatar,
    EmptyState,
    HelpButton,
    ReactiveFormsModule,
    Button,
    Card,
    ConfirmDialog,
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
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="teacher/students" />
      <!-- wider, the rail's «Создать» is the page's FAB (spec §1 principle 5) -->
      @if (mobile()) {
        <p-button
          class="tb-page-fab"
          [label]="t.add"
          icon="tb-i tb-i-person_add"
          (onClick)="openCreate()"
        />
      }
    </tb-page-header>

    <div class="tb-stack">
      <p-card>
        <h2 class="tb-sr-only">{{ t.list }}</h2>
        <div class="tb-toolbar">
          <tb-search-field [formControl]="search" [label]="t.search" />
          <label class="tb-switch" for="show-deactivated">
            <p-toggleswitch inputId="show-deactivated" [formControl]="showDeactivated" />
            {{ t.showDeactivated }}
          </label>
        </div>

        <tb-load-state [state]="state" [what]="t.what" (retry)="loadStudents()">
          @if (visibleStudents().length > 0) {
            <ul class="tb-list" [attr.aria-label]="t.title">
              @for (student of visibleStudents(); track student.id) {
                <li [attr.data-tb-label]="student.color === null ? null : labelKey(student.color)">
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
                      icon="tb-i tb-i-more_vert"
                      [text]="true"
                      [rounded]="true"
                      severity="secondary"
                      [pTooltip]="t.actions(student.displayName)"
                      [ariaLabel]="t.actions(student.displayName)"
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
            <tb-empty-state icon="tb-i-person_add" [title]="t.emptyTitle" [hint]="t.emptyHint" />
          } @else {
            <tb-empty-state icon="tb-i-search" [title]="t.notFoundTitle" [hint]="t.notFoundHint" />
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
  protected readonly mobile = injectMobile();
  protected readonly t = T.students;
  protected readonly busy = new Busy();
  private readonly api = inject(IdentityApi);
  private readonly colors = inject(TeacherColors);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(Snackbar);
  private readonly date = inject(DatePipe);
  private readonly menu = viewChild.required<Menu>('menu');

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusSeverities = STATUS_SEVERITIES;
  protected readonly labelKey = labelKey;

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

  constructor() {
    openOnCreate('student', () => {
      this.openCreate();
    });
  }

  ngOnInit(): void {
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
      student.login === null ? null : T.students.login(student.login),
      student.note === null ? null : T.students.note(student.note),
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
    return T.students.inviteUntil(INVITE_PURPOSE_LABELS[invite.purpose], until);
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
    this.colors.rememberStudent(created.student);
    this.showInvite(created.student, created.invite);
  }

  protected onUpdated(student: Student): void {
    this.replace(student);
    this.colors.rememberStudent(student);
    this.snackbar.success(T.students.saved(student.displayName));
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
        header: T.students.deactivateHeader,
        message: T.students.deactivateMessage(student.displayName),
        icon: 'tb-i tb-i-warning',
        acceptLabel: T.students.deactivate,
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
        label: T.students.edit,
        icon: 'tb-i tb-i-edit',
        command: () => {
          this.openEdit(student);
        },
      },
    ];
    if (student.status === 'DEACTIVATED') {
      items.push({
        label: T.students.reactivate,
        icon: 'tb-i tb-i-replay',
        command: () => {
          this.reactivate(student);
        },
      });
    } else {
      items.push(
        {
          label: student.status === 'ACTIVE' ? T.students.resetPassword : T.students.newInvite,
          icon: 'tb-i tb-i-link',
          command: () => {
            this.reissueInvite(student);
          },
        },
        {
          label: T.students.deactivateItem,
          icon: 'tb-i tb-i-block',
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
