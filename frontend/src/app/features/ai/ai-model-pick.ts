import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { RowType } from '@shared/ui/row-type.directive';
import { T } from './i18n/texts';
import { AiModelChoice } from './model-choice';

/**
 * The model the AI writes with, beside «Сгенерировать» (ADR-0057, sketch AiEditor `.pick`): a
 * compact outlined select «Claude Opus 5 ▾» that opens a menu of the models grouped by connection —
 * the default one tagged, the chosen one checked, the models of a broken connection disabled, and
 * «Настроить подключения» at the end. Hidden while there is one model or none: nothing to choose.
 */
@Component({
  selector: 'tb-ai-model-pick',
  imports: [Menu, Tag, RowType],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (choice.models().length > 1) {
      @let model = choice.chosen();
      <button
        type="button"
        class="tb-model-pick"
        [class.tb-model-pick--open]="open()"
        [class.tb-model-pick--short]="short()"
        aria-haspopup="menu"
        [attr.aria-expanded]="open() ? 'true' : 'false'"
        [attr.aria-label]="t.label(model?.label ?? '')"
        (click)="menu.toggle($event)"
      >
        <i class="tb-i tb-i-memory" aria-hidden="true"></i>
        <span class="tb-model-pick__label">{{ model?.label }}</span>
        <i class="tb-i tb-i-arrow_drop_down tb-model-pick__arrow" aria-hidden="true"></i>
      </button>
    }
    <p-menu
      #menu
      [model]="items()"
      [popup]="true"
      appendTo="body"
      [style]="menuSize"
      [ariaLabel]="t.menu"
      (onShow)="open.set(true)"
      (onHide)="open.set(false)"
    >
      <ng-template #item let-item [tbRowType]="items()">
        <a class="p-menu-item-link tb-model-item" data-pc-section="itemlink" tabindex="-1">
          @if (item.icon) {
            <i class="{{ item.icon }}" aria-hidden="true"></i>
          }
          <span class="tb-model-item__text">
            <span>{{ item.label }}</span>
            @if (item.title) {
              <small>{{ item.title }}</small>
            }
          </span>
          @if (item.badge) {
            <p-tag
              [value]="item.badge"
              [severity]="item.badgeStyleClass === 'danger' ? 'danger' : undefined"
            />
          }
        </a>
      </ng-template>
    </p-menu>
  `,
  styles: `
    :host {
      display: contents;
    }

    /*
     * M3 outlined select shrunk to 40 dp, as the «Кому» select of the homework list (design-system
     * §10, sketch Elements .select): 8 dp corners, 1 dp outline, a leading 18 dp icon and a trailing
     * drop-down arrow, padding and gaps of the sketch's select (8 / 12 dp). Ours: open, it takes the tertiary container of the AI action beside it
     * (sketch AiEditor .pick.open), in the roles «Сгенерировать» uses.
     */
    .tb-model-pick {
      display: inline-flex;
      flex: none;
      gap: var(--tb-space-2);
      align-items: center;
      min-inline-size: 0;
      block-size: 2.5rem;
      padding: 0 var(--tb-space-2) 0 var(--tb-space-3);
      border: 1px solid var(--p-md-outline);
      border-radius: var(--tb-shape-sm);
      background: transparent;
      color: var(--p-md-on-surface);
      font: var(--tb-type-label-l);
      letter-spacing: var(--tb-tracking-label-l);
      white-space: nowrap;
      cursor: pointer;

      .tb-i {
        font-size: 1.125rem;
      }

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) 8%, transparent);
      }

      &:focus-visible {
        outline: 2px solid var(--p-md-secondary);
        outline-offset: 2px;
      }
    }

    /* the same pair of roles as «Сгенерировать» beside it */
    .tb-model-pick.tb-model-pick--open {
      border-color: var(--p-md-on-tertiary-container);
      background: var(--p-md-on-tertiary-container);
      color: var(--p-md-tertiary-container);
    }

    /* open, the arrow points up (sketch: arrow_drop_up) */
    .tb-model-pick--open .tb-model-pick__arrow {
      transform: rotate(180deg);
    }

    .tb-model-pick__label {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* M3 Expressive vertical menu with supporting text; the tag follows the label (sketch AiEditor) */
    .tb-model-item {
      gap: var(--tb-space-3);
    }

    .tb-model-item__text {
      display: grid;
      flex: 1;
      min-inline-size: 0;

      > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        font: var(--tb-type-body-s);
        color: var(--p-md-on-surface-variant);
      }
    }

    /* ours: on a phone sheet the label gives way to «Сгенерировать» (sketch PhoneAi: «Opus 5 ▾») */
    .tb-model-pick--short .tb-model-pick__label {
      max-inline-size: 7rem;
    }
  `,
})
export class AiModelPick implements OnInit {
  protected readonly t = T.modelPick;
  protected readonly choice = inject(AiModelChoice);
  private readonly router = inject(Router);

  /** A phone sheet: the label is cut short so the button beside keeps its room. */
  readonly short = input(false);
  protected readonly open = signal(false);
  /** Sketch AiEditor .mmenu (300 dp) at least; wider for a long label with its tag (ours). */
  protected readonly menuSize = {
    minInlineSize: 'min(18.75rem, calc(100vw - 2rem))',
    maxInlineSize: 'calc(100vw - 2rem)',
  };

  protected readonly items = computed<MenuItem[]>(() => {
    const chosen = this.choice.chosen()?.id;
    const groups = this.choice
      .providers()
      .filter((provider) => provider.models.length > 0)
      .map((provider): MenuItem => {
        const broken = provider.state === 'FAILED';
        return {
          label: provider.name,
          items: provider.models.map((model) => ({
            id: model.id,
            label: model.label,
            title: broken ? this.t.broken : undefined,
            badge: broken
              ? T.connections.states.FAILED
              : model.default
                ? T.connections.defaultModel
                : undefined,
            badgeStyleClass: broken ? 'danger' : undefined,
            disabled: broken,
            styleClass: model.id === chosen ? 'tb-menu-item--selected' : undefined,
            command: () => {
              this.choice.choose(model);
            },
          })),
        };
      });
    // M3 on the web: a divider between the groups; «Настроить подключения» closes the last one
    const manage: MenuItem[] = [
      { separator: true },
      {
        label: this.t.manage,
        icon: 'tb-i tb-i-settings',
        command: () => {
          void this.router.navigateByUrl('/teacher/settings/ai');
        },
      },
    ];
    return groups.flatMap((group, index) => {
      const last = index === groups.length - 1;
      const shown = last ? { ...group, items: [...(group.items ?? []), ...manage] } : group;
      return index === 0 ? [shown] : [{ separator: true }, shown];
    });
  });

  ngOnInit(): void {
    this.choice.load();
  }
}
