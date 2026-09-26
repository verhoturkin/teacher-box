import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
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
import { MoneyPipe } from '@shared/money/money.pipe';
import { RowType } from '@shared/ui/row-type.directive';
import { IdentityApi } from '../data-access/identity-api';
import { Student, StudentGroup } from '../data-access/identity.models';
import { GroupFormDialog, SavedGroup } from './group-form-dialog';

/** Teacher: groups of students taught together, their members and lesson prices. */
@Component({
  selector: 'tb-groups-panel',
  imports: [
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
    GroupFormDialog,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <div class="tb-toolbar">
        <p-button label="Создать группу" icon="pi pi-users" (onClick)="openCreate()" />
        <label class="tb-switch" for="show-archived">
          <p-toggleswitch inputId="show-archived" [formControl]="showArchived" />
          Показывать архив
        </label>
      </div>

      <p-table [value]="visibleGroups()" [loading]="loading()" dataKey="id" [rowHover]="true">
        <ng-template #header>
          <tr>
            <th>Группа</th>
            <th>Ученики</th>
            <th>Цена занятия</th>
            <th class="tb-actions-column"><span class="tb-sr-only">Действия</span></th>
          </tr>
        </ng-template>
        <ng-template #body let-group [tbRowType]="visibleGroups()">
          <tr>
            <td>
              <span class="tb-strong">{{ group.name }}</span>
              @if (group.archivedAt) {
                <p-tag value="В архиве" severity="secondary" class="tb-group-tag" />
              }
            </td>
            <td>
              @if (group.members.length === 0) {
                <span class="tb-muted">Пока никого</span>
              } @else {
                {{ memberNames(group) }}
              }
            </td>
            <td>
              @if (priceOf(group.id); as price) {
                {{ price | money: currency() }}
              } @else {
                <span class="tb-muted">—</span>
              }
            </td>
            <td class="tb-actions-column">
              <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" pTooltip="Изменить"
                [ariaLabel]="'Изменить группу: ' + group.name" (onClick)="openEdit(group)" />
              @if (group.archivedAt) {
                <p-button icon="pi pi-replay" [text]="true" [rounded]="true" pTooltip="Вернуть из архива"
                  [ariaLabel]="'Вернуть из архива: ' + group.name" (onClick)="restore(group)" />
              } @else {
                <p-button icon="pi pi-inbox" [text]="true" [rounded]="true" pTooltip="В архив"
                  [ariaLabel]="'В архив: ' + group.name" (onClick)="confirmArchive(group)" />
              }
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="4" class="tb-empty">
              {{ groups().length === 0 ? 'Групп пока нет. Создайте группу, если занимаетесь с несколькими учениками сразу.' : 'Все группы в архиве' }}
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
    <p-confirmdialog key="groups" />
  `,
  styles: `
    .tb-group-tag {
      margin-inline-start: 0.5rem;
    }
  `,
})
export class GroupsPanel implements OnInit {
  private readonly api = inject(IdentityApi);
  private readonly billing = inject(BillingApi);
  private readonly confirmation = inject(ConfirmationService);

  /** A group was created, changed or archived. */
  readonly changed = output();

  protected readonly groups = signal<StudentGroup[]>([]);
  protected readonly students = signal<Student[]>([]);
  private readonly prices = signal<ReadonlyMap<string, number>>(new Map());
  protected readonly currency = signal('RUB');
  protected readonly loading = signal(true);
  protected readonly showArchived = new FormControl(false, { nonNullable: true });
  private readonly includeArchived = toSignal(this.showArchived.valueChanges, { initialValue: false });
  protected readonly visibleGroups = computed(() =>
    this.groups().filter((group) => this.includeArchived() || group.archivedAt === null),
  );

  protected readonly formVisible = signal(false);
  protected readonly edited = signal<StudentGroup | null>(null);
  protected readonly editedPrice = computed(() => {
    const group = this.edited();
    return group === null ? null : this.priceOf(group.id);
  });

  ngOnInit(): void {
    forkJoin({
      groups: this.api.listGroups(),
      students: this.api.listStudents(),
      prices: this.billing.groupPrices(),
    }).subscribe({
      next: ({ groups, students, prices }) => {
        this.groups.set(groups);
        this.students.set(students);
        this.currency.set(prices.currency);
        this.prices.set(new Map(prices.prices.map((price) => [price.groupId, price.lessonPrice])));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
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
    this.confirmation.confirm({
      key: 'groups',
      header: 'Убрать группу в архив?',
      message: `Регулярные занятия группы «${group.name}» остановятся, будущие занятия отменятся. Проведённые занятия и оплаты сохранятся.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'В архив',
      rejectLabel: 'Отмена',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.api.archiveGroup(group.id).subscribe((saved) => {
          this.replace(saved);
        });
      },
    });
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
      Number(a.archivedAt !== null) - Number(b.archivedAt !== null) || a.name.localeCompare(b.name, 'ru'),
  );
}
