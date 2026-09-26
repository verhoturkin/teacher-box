import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { RowType } from '@shared/ui/row-type.directive';
import { IdentityApi } from '../data-access/identity-api';
import { CreatedStudent, IssuedInvite, Student, StudentGroup } from '../data-access/identity.models';
import { GroupsPanel } from '../groups/groups-panel';
import { InviteLinkDialog } from './invite-link-dialog';
import { StudentFormDialog } from './student-form-dialog';
import { INVITE_PURPOSE_LABELS, STATUS_LABELS, STATUS_SEVERITIES } from './student-status';

/** Sections of the students page (`?tab=`). */
export const STUDENTS_TABS = ['students', 'groups'] as const;
export type StudentsTab = (typeof STUDENTS_TABS)[number];

function isStudentsTab(value: unknown): value is StudentsTab {
  return STUDENTS_TABS.some((tab) => tab === value);
}

/** Teacher: the list of students, invitations and access management; groups of students. */
@Component({
  selector: 'tb-students-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    Button,
    Card,
    ConfirmDialog,
    IconField,
    InputIcon,
    InputText,
    TableModule,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    Tag,
    ToggleSwitch,
    Tooltip,
    RowType,
    GroupsPanel,
    InviteLinkDialog,
    StudentFormDialog,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-page-header">
      <h1 class="tb-page-title">Ученики</h1>
      @if (activeTab() === 'students') {
        <p-button label="Добавить ученика" icon="pi pi-user-plus" (onClick)="openCreate()" />
      }
    </div>

    <p-tabs [value]="activeTab()" (valueChange)="select($event)" [lazy]="true">
      <p-tablist>
        <p-tab value="students">Ученики</p-tab>
        <p-tab value="groups">Группы</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="students">
          <p-card>
            <div class="tb-toolbar">
              <p-iconfield>
                <p-inputicon styleClass="pi pi-search" />
                <input pInputText [formControl]="search" placeholder="Поиск по имени" aria-label="Поиск по имени" />
              </p-iconfield>
              <label class="tb-switch" for="show-deactivated">
                <p-toggleswitch inputId="show-deactivated" [formControl]="showDeactivated" />
                Показывать отключённых
              </label>
            </div>

            <p-table [value]="visibleStudents()" [loading]="loading()" dataKey="id" [rowHover]="true">
              <ng-template #header>
                <tr>
                  <th>Имя</th>
                  <th>Контакты</th>
                  <th>Группы</th>
                  <th>Статус</th>
                  <th>Логин</th>
                  <th class="tb-actions-column"><span class="tb-sr-only">Действия</span></th>
                </tr>
              </ng-template>
              <ng-template #body let-student [tbRowType]="visibleStudents()">
                <tr>
                  <td>
                    <div class="tb-strong">{{ student.displayName }}</div>
                    @if (student.note) {
                      <small class="tb-muted">{{ student.note }}</small>
                    }
                  </td>
                  <td>
                    <div>{{ student.email ?? '' }}</div>
                    <div>{{ student.phone ?? '' }}</div>
                  </td>
                  <td>{{ groupNames(student.id) }}</td>
                  <td>
                    <p-tag [value]="statusLabels[student.status]" [severity]="statusSeverities[student.status]" />
                    @if (student.pendingInvite; as invite) {
                      <div>
                        <small class="tb-muted">
                          {{ purposeLabels[invite.purpose] }} до {{ invite.expiresAt | date: 'dd.MM.yyyy' }}
                        </small>
                      </div>
                    }
                  </td>
                  <td>{{ student.login ?? '—' }}</td>
                  <td class="tb-actions-column">
                    <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" pTooltip="Редактировать"
                      [ariaLabel]="'Редактировать: ' + student.displayName" (onClick)="openEdit(student)" />
                    @if (student.status === 'DEACTIVATED') {
                      <p-button icon="pi pi-replay" [text]="true" [rounded]="true" pTooltip="Вернуть доступ"
                        [ariaLabel]="'Вернуть доступ: ' + student.displayName" (onClick)="reactivate(student)" />
                    } @else {
                      <p-button icon="pi pi-link" [text]="true" [rounded]="true"
                        [pTooltip]="student.status === 'ACTIVE' ? 'Ссылка для сброса пароля' : 'Новая ссылка-приглашение'"
                        [ariaLabel]="'Ссылка: ' + student.displayName" (onClick)="reissueInvite(student)" />
                      <p-button icon="pi pi-ban" [text]="true" [rounded]="true" severity="danger" pTooltip="Отключить доступ"
                        [ariaLabel]="'Отключить доступ: ' + student.displayName" (onClick)="confirmDeactivate(student)" />
                    }
                  </td>
                </tr>
              </ng-template>
              <ng-template #emptymessage>
                <tr>
                  <td colspan="6" class="tb-empty">
                    {{ students().length === 0 ? 'Пока нет ни одного ученика. Добавьте первого!' : 'Никого не найдено' }}
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </p-card>
        </p-tabpanel>
        <p-tabpanel value="groups">
          <ng-template #content>
            <tb-groups-panel (changed)="loadGroups()" />
          </ng-template>
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>

    <tb-student-form-dialog
      [(visible)]="formVisible"
      [student]="editedStudent()"
      (created)="onCreated($event)"
      (updated)="onUpdated($event)"
    />
    <tb-invite-link-dialog [(visible)]="inviteVisible" [invite]="invite()" [studentName]="inviteStudentName()" />
    <p-confirmdialog />
  `,
  styles: `
    p-tabpanels {
      padding-inline: 0;
    }
  `,
})
export class StudentsPage implements OnInit {
  private readonly api = inject(IdentityApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusSeverities = STATUS_SEVERITIES;
  protected readonly purposeLabels = INVITE_PURPOSE_LABELS;

  /** The open section (query parameter). */
  readonly tab = input<string>();
  protected readonly activeTab = computed<StudentsTab>(() => {
    const tab = this.tab();
    return isStudentsTab(tab) ? tab : 'students';
  });

  protected readonly students = signal<Student[]>([]);
  private readonly groups = signal<StudentGroup[]>([]);
  protected readonly loading = signal(true);
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly showDeactivated = new FormControl(false, { nonNullable: true });
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  private readonly includeDeactivated = toSignal(this.showDeactivated.valueChanges, { initialValue: false });

  protected readonly visibleStudents = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('ru');
    const includeDeactivated = this.includeDeactivated();
    // New rows when the groups arrive: the table re-renders the group column only for a new value.
    this.groups();
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
  }

  protected select(tab: string | number | undefined): void {
    if (isStudentsTab(tab) && tab !== this.activeTab()) {
      void this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
    }
  }

  protected loadGroups(): void {
    this.api.listGroups().subscribe((groups) => {
      this.groups.set(groups);
    });
  }

  /** Current groups of the student. */
  protected groupNames(studentId: string): string {
    return this.groups()
      .filter((group) => group.archivedAt === null && group.members.some((member) => member.id === studentId))
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
      this.replace({ ...student, pendingInvite: { purpose: invite.purpose, expiresAt: invite.expiresAt } });
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
