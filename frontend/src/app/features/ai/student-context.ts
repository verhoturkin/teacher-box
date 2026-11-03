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
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { quietContext } from '@core/http/api-error.interceptor';
import { IdentityApi, StudentTag } from '@features/identity/parts';
import { InputChip } from '@shared/ui/input-chip';
import { ContextItem } from './data-access/ai.models';
import { T } from './i18n/texts';

/** Limits of the `context` of a draft request (`ai` module). */
const MAX_ITEMS = 10;
const MAX_VALUE = 120;

/** A value of a tag the recipients have (for a text tag the text is its id), and how many of them have it. */
export interface ContextShare {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

/** An AI tag of the recipients as a chip: «Класс: 7 · 8». */
export interface ContextChip {
  readonly tagId: string;
  readonly name: string;
  /** The values set on the recipients, in the tag's order. */
  readonly shares: readonly ContextShare[];
  readonly value: string;
  /** The recipients differ and the teacher picked no value. */
  readonly mixed: boolean;
  /** «All values» fits a request: the joined value is within 120 characters. */
  readonly all: boolean;
}

/**
 * What the AI takes into account about the recipients (ADR-0055): their tags marked «Учитывать в ИИ» with a
 * value set. The teacher removes a chip or picks one value of a mixed tag for the requests of this editor or
 * review only; the students' tags stay as they are.
 */
export class StudentContext {
  private readonly identity = inject(IdentityApi);
  private readonly tags = signal<readonly StudentTag[]>([]);
  private readonly profiles = signal<ReadonlyMap<string, Readonly<Record<string, string>>>>(
    new Map(),
  );
  private loaded = false;
  private readonly removed = signal<ReadonlySet<string>>(new Set());
  /** The value picked of a mixed tag, by the tag. */
  private readonly picked = signal<ReadonlyMap<string, string>>(new Map());

  /** Loads the tags and the students' values once; without them there are no chips. */
  load(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    const ignore = (): void => {
      // the draft goes without the context
    };
    this.identity.listTags(quietContext()).subscribe({
      next: (tags) => {
        this.tags.set(tags.filter((tag) => tag.useInAi));
      },
      error: ignore,
    });
    this.identity.listStudents(quietContext()).subscribe({
      next: (students) => {
        this.profiles.set(new Map(students.map((student) => [student.id, student.tags])));
      },
      error: ignore,
    });
  }

  chips(studentIds: readonly string[]): ContextChip[] {
    const profiles = studentIds.map((id) => this.profiles().get(id) ?? {});
    return this.tags().flatMap((tag) => {
      if (this.removed().has(tag.id)) {
        return [];
      }
      // a text tag: its distinct texts in the order of the recipients
      const values =
        tag.kind === 'TEXT'
          ? [...new Set(profiles.flatMap((profile) => profile[tag.id] ?? []))].map((text) => ({
              id: text,
              label: text,
            }))
          : tag.values;
      const shares = values
        .map((value) => ({
          id: value.id,
          label: value.label,
          count: profiles.filter((profile) => profile[tag.id] === value.id).length,
        }))
        .filter((share) => share.count > 0);
      if (shares.length === 0) {
        return [];
      }
      const joined = shares.map((share) => share.label).join(' · ');
      const all = joined.length <= MAX_VALUE;
      const picked = shares.find((share) => share.id === this.picked().get(tag.id));
      // too long to send all: the most common value until the teacher picks one
      const shown =
        picked ??
        (all ? undefined : shares.reduce((top, share) => (share.count > top.count ? share : top)));
      return [
        {
          tagId: tag.id,
          name: tag.name,
          shares,
          value: shown?.label ?? joined,
          mixed: picked === undefined && shares.length > 1,
          all,
        },
      ];
    });
  }

  /** The pairs a draft request takes, within its limits (a value is never over 120 characters, see `all`). */
  context(studentIds: readonly string[]): ContextItem[] {
    return this.chips(studentIds)
      .slice(0, MAX_ITEMS)
      .map((chip) => ({ name: chip.name, value: chip.value }));
  }

  remove(tagId: string): void {
    this.removed.update((removed) => new Set(removed).add(tagId));
  }

  /** One value of a mixed tag; `null` keeps all of them. */
  pick(tagId: string, valueId: string | null): void {
    this.picked.update((picked) => {
      const next = new Map(picked);
      if (valueId === null) {
        next.delete(tagId);
      } else {
        next.set(tagId, valueId);
      }
      return next;
    });
  }
}

/**
 * «Учитываю об учениках»: M3 input chips of the context (`StudentContext`), each with «×»; a mixed value is in
 * the warning tone (ours: M3 publishes none) and its label opens a menu of the values. `row` — one scrolling row
 * (the phone sheet). Nothing while there is nothing to send.
 */
@Component({
  selector: 'tb-ai-context-chips',
  imports: [InputChip, Menu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chips().length > 0) {
      <div class="tb-ai-context" role="group" [attr.aria-label]="t.label">
        <span class="tb-ai-context__label" aria-hidden="true">{{ t.label }}</span>
        <div class="tb-ai-context__chips" [class.tb-ai-context__chips--row]="row()">
          @for (chip of chips(); track chip.tagId) {
            <tb-input-chip
              [class.tb-ai-context__mixed]="chip.mixed"
              [label]="chip.name + ': ' + chip.value"
              [removeLabel]="t.remove(chip.name)"
              [menu]="chip.shares.length > 1"
              (opened)="open(chip, $event)"
              (removed)="state().remove(chip.tagId)"
            >
              <i lead class="tb-i tb-i-sell tb-ai-context__icon" aria-hidden="true"></i>
            </tb-input-chip>
          }
        </div>
        <small class="tb-hint">
          @for (chip of chips(); track chip.tagId) {
            @if (chip.mixed) {
              {{ mixed(chip) }}
            }
          }
          {{ t.hint }}
        </small>
      </div>
    }
    <p-menu #menu [popup]="true" [model]="items()" appendTo="body" />
  `,
  styles: `
    :host {
      display: block;
    }

    .tb-ai-context {
      display: grid;
      gap: var(--tb-space-2);
      min-width: 0;
    }

    .tb-ai-context__label {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
    }

    .tb-ai-context__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    /* the phone sheet: one row that scrolls (M3 allows a horizontally scrollable list of input chips) */
    .tb-ai-context__chips--row {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;

      tb-input-chip {
        flex: none;
      }
    }

    .tb-ai-context__icon {
      color: var(--p-md-primary);
    }

    /* ours: the recipients differ — the warning tone, M3 has no such chip */
    tb-input-chip.tb-ai-context__mixed {
      border-color: var(--p-md-warning);
      background: var(--p-md-warning-container);
      color: var(--p-md-on-warning-container);

      .tb-ai-context__icon {
        color: inherit;
      }
    }
  `,
})
export class AiContextChips implements OnInit {
  protected readonly t = T.context;
  private readonly menu = viewChild.required<Menu>('menu');
  readonly state = input.required<StudentContext>();
  /** The recipients of the draft. */
  readonly students = input<readonly string[]>([]);
  readonly row = input(false);
  protected readonly chips = computed(() => this.state().chips(this.students()));
  protected readonly items = signal<MenuItem[]>([]);

  ngOnInit(): void {
    this.state().load();
  }

  protected mixed(chip: ContextChip): string {
    return this.t.mixed(
      chip.name,
      chip.shares.map((share) => this.t.share(share.count, share.label)).join(', '),
    );
  }

  protected open(chip: ContextChip, event: Event): void {
    this.items.set([
      ...chip.shares.map((share) => ({
        label: this.t.option(share.label, share.count),
        command: () => {
          this.state().pick(chip.tagId, share.id);
        },
      })),
      ...(chip.all
        ? [
            {
              label: this.t.all(chip.shares.map((share) => share.label).join(' · ')),
              command: () => {
                this.state().pick(chip.tagId, null);
              },
            },
          ]
        : []),
    ]);
    this.menu().toggle(event);
  }
}
