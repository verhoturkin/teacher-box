import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Menu } from 'primeng/menu';
import { RadioButton } from 'primeng/radiobutton';
import { Tag } from 'primeng/tag';
import { Snackbar } from '@core/snackbar/snackbar';
import { Confirm } from '@shared/ui/confirm';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { AiApi } from './data-access/ai-api';
import { AiModel, AiProvider } from './data-access/ai.models';
import { T } from './i18n/texts';
import { AiModelDialog, EFFORTS } from './ai-model-dialog';
import { AiProviderDialog } from './ai-provider-dialog';
import { AiSetup } from './ai-setup';
import { KIND_ICONS, STATE_SEVERITY } from './ai-labels';

function isEffort(value: string): value is (typeof EFFORTS)[number] {
  return (EFFORTS as readonly string[]).includes(value);
}

/**
 * «Подключения» of «ИИ-помощник» (sketch Ai, ADR-0057): one segmented list per connection — its kind,
 * name, models, key and route, the state of its check — with its models nested as rows whose radio
 * picks the default model; «⋮» of a connection changes, rechecks or deletes it, «⋮» of a model makes
 * it the default, changes or deletes it; «Добавить модель» and «Добавить» open `AiProviderDialog`.
 */
@Component({
  selector: 'tb-ai-connections-card',
  imports: [
    FormsModule,
    Button,
    Card,
    Menu,
    RadioButton,
    Tag,
    EmptyState,
    LoadStateView,
    AiProviderDialog,
    AiModelDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="ai-connections" styleClass="tb-section-card tb-section-card--flow">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text">{{ t.title }}</span>
          @if (setup.providers().length > 0) {
            <div class="tb-card-title__actions">
              <p-button
                [label]="t.add"
                icon="tb-i tb-i-add"
                severity="secondary"
                (onClick)="dialog().openNew()"
              />
            </div>
          }
        </div>
      </ng-template>
      <tb-load-state [state]="setup.state" [compact]="true" (retry)="setup.load()">
        @if (setup.providers().length === 0) {
          <tb-empty-state
            [compact]="true"
            icon="tb-i-auto_awesome"
            [title]="t.empty"
            [hint]="t.emptyHint"
          >
            <p-button [label]="t.addFirst" icon="tb-i tb-i-add" (onClick)="dialog().openNew()" />
          </tb-empty-state>
        } @else {
          <p class="tb-muted">{{ t.hint }}</p>
          @for (provider of setup.providers(); track provider.id) {
            <ul class="tb-list tb-list--own-trail tb-ai-conn" [attr.aria-label]="provider.name">
              <li class="tb-ai-conn__provider">
                <span class="tb-list__lead" aria-hidden="true"
                  ><i class="tb-i {{ icons[provider.kind] }}"></i
                ></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ provider.name }}</span>
                  <span class="tb-list__supporting">{{ summary(provider) }}</span>
                  @if (provider.state === 'FAILED' && provider.stateDetail) {
                    <small class="tb-negative tb-ai-conn__error">{{ provider.stateDetail }}</small>
                  }
                </div>
                <div class="tb-list__trail tb-list__trail--icons">
                  <p-tag [value]="t.states[provider.state]" [severity]="severity[provider.state]" />
                  <p-button
                    icon="tb-i tb-i-more_vert"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [ariaLabel]="t.providerActions(provider.name)"
                    aria-haspopup="menu"
                    (onClick)="openProviderMenu(provider, $event)"
                  />
                </div>
              </li>
              @for (model of provider.models; track model.id) {
                <li class="tb-ai-conn__model">
                  <p-radiobutton
                    class="tb-list__lead tb-ai-conn__radio"
                    name="ai-default-model"
                    [inputId]="'ai-default-' + model.id"
                    [value]="model.id"
                    [ngModel]="defaultId()"
                    (ngModelChange)="makeDefault(model)"
                  />
                  <label class="tb-list__text" [for]="'ai-default-' + model.id">
                    <span class="tb-list__title">{{ model.label }}</span>
                    @if (modelHint(model); as hint) {
                      <span class="tb-list__supporting">{{ hint }}</span>
                    }
                  </label>
                  <div class="tb-list__trail tb-list__trail--icons">
                    @if (model.default) {
                      <p-tag [value]="t.defaultModel" />
                    }
                    <p-button
                      icon="tb-i tb-i-more_vert"
                      [text]="true"
                      [rounded]="true"
                      severity="secondary"
                      [ariaLabel]="t.modelActions(model.label)"
                      aria-haspopup="menu"
                      (onClick)="openModelMenu(provider, model, $event)"
                    />
                  </div>
                </li>
              } @empty {
                <li class="tb-ai-conn__model">
                  <span class="tb-list__lead tb-ai-conn__radio" aria-hidden="true"
                    ><i class="tb-i tb-i-info"></i
                  ></span>
                  <div class="tb-list__text">
                    <span class="tb-list__supporting">{{ t.noModels }}</span>
                  </div>
                </li>
              }
              <li class="tb-ai-conn__add">
                <p-button
                  [label]="t.addModel"
                  icon="tb-i tb-i-add"
                  [text]="true"
                  (onClick)="dialog().openModels(provider)"
                />
              </li>
            </ul>
          }
        }
      </tb-load-state>
    </p-card>
    <p-menu #providerMenu [model]="providerItems()" [popup]="true" appendTo="body" />
    <p-menu #modelMenu [model]="modelItems()" [popup]="true" appendTo="body" />
    <tb-ai-provider-dialog />
    <tb-ai-model-dialog />
  `,
  styles: `
    .tb-ai-conn + .tb-ai-conn {
      margin-block-start: var(--tb-space-2);
    }

    /* the connection heads its group: surface container, a step darker than the model rows (sketch) */
    .tb-ai-conn > li.tb-ai-conn__provider {
      background: var(--p-md-surface-container);
    }

    /* the radio stands centred in the lead column under the connection's icon: the models read as nested */
    .tb-ai-conn__radio {
      justify-self: center;
      background: none;
    }

    .tb-ai-conn__model {
      cursor: pointer;

      label {
        cursor: inherit;
      }
    }

    .tb-ai-conn__add {
      min-block-size: 3rem;
      padding-block: var(--tb-space-1);

      /* the text button starts where the model names do (sketch) */
      > p-button {
        grid-column: 2 / -1;
        justify-self: start;
        margin-inline-start: calc(-1 * var(--tb-space-3));
      }
    }

    /* model ids have no spaces («deepseek/deepseek-v4»): they break anywhere rather than run under the tag */
    .tb-ai-conn :is(.tb-list__title, .tb-list__supporting) {
      overflow-wrap: anywhere;
    }

    .tb-ai-conn__error {
      display: block;
      overflow-wrap: anywhere;
    }
  `,
})
export class AiConnectionsCard {
  protected readonly t = T.connections;
  protected readonly icons = KIND_ICONS;
  protected readonly severity = STATE_SEVERITY;
  protected readonly setup = inject(AiSetup);
  private readonly api = inject(AiApi);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);

  protected readonly dialog = viewChild.required(AiProviderDialog);
  private readonly modelDialog = viewChild.required(AiModelDialog);
  private readonly providerMenu = viewChild.required<Menu>('providerMenu');
  private readonly modelMenu = viewChild.required<Menu>('modelMenu');

  protected readonly defaultId = computed(() => this.setup.settings()?.defaultModelId ?? null);
  private readonly menuProvider = signal<AiProvider | null>(null);
  private readonly menuModel = signal<{ provider: AiProvider; model: AiModel } | null>(null);

  protected readonly providerItems = computed<MenuItem[]>(() => {
    const provider = this.menuProvider();
    return provider === null
      ? []
      : [
          {
            label: this.t.edit,
            icon: 'tb-i tb-i-edit',
            command: () => {
              this.dialog().openEdit(provider);
            },
          },
          {
            label: this.t.recheck,
            icon: 'tb-i tb-i-refresh',
            command: () => {
              this.recheck(provider);
            },
          },
          {
            label: this.t.delete,
            icon: 'tb-i tb-i-delete',
            styleClass: 'tb-menu-item--danger',
            command: () => {
              void this.deleteProvider(provider);
            },
          },
        ];
  });

  protected readonly modelItems = computed<MenuItem[]>(() => {
    const chosen = this.menuModel();
    if (chosen === null) {
      return [];
    }
    const { provider, model } = chosen;
    return [
      ...(model.default
        ? []
        : [
            {
              label: this.t.makeDefault,
              icon: 'tb-i tb-i-check_circle',
              command: () => {
                this.makeDefault(model);
              },
            },
          ]),
      {
        label: this.t.edit,
        icon: 'tb-i tb-i-edit',
        command: () => {
          this.modelDialog().open(provider, model);
        },
      },
      {
        label: this.t.delete,
        icon: 'tb-i tb-i-delete',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          void this.deleteModel(provider, model);
        },
      },
    ];
  });

  /** «2 модели · ключ …a7f2 · через прокси». */
  protected summary(provider: AiProvider): string {
    let key: string = this.t.noKey;
    if (provider.keySet) {
      key = provider.keyEnding === null ? this.t.keySet : this.t.key(provider.keyEnding);
    }
    return [
      this.t.models(provider.models.length),
      key,
      provider.proxy === null ? this.t.direct : this.t.viaProxy,
    ].join(' · ');
  }

  /** «claude-opus-5 · усилие: высокое»; the id only when the label differs from it. */
  protected modelHint(model: AiModel): string {
    const effort = model.effort;
    const parts = model.label === model.modelId ? [] : [model.modelId];
    if (effort !== null && isEffort(effort)) {
      parts.push(this.t.effort(T.efforts[effort]));
    }
    return parts.join(' · ');
  }

  protected openProviderMenu(provider: AiProvider, event: Event): void {
    this.menuProvider.set(provider);
    this.providerMenu().toggle(event);
  }

  protected openModelMenu(provider: AiProvider, model: AiModel, event: Event): void {
    this.menuModel.set({ provider, model });
    this.modelMenu().toggle(event);
  }

  protected makeDefault(model: AiModel): void {
    if (model.default) {
      return;
    }
    this.setup.makeDefault(model.id).subscribe(() => {
      this.snackbar.success(this.t.defaultSaved(model.label));
    });
  }

  private recheck(provider: AiProvider): void {
    this.api.recheckProvider(provider.id).subscribe((checked) => {
      this.setup.put(checked);
      if (checked.state === 'FAILED') {
        this.snackbar.error(this.t.checkFailed(checked.stateDetail ?? ''));
      } else {
        this.snackbar.success(this.t.checked);
      }
    });
  }

  /**
   * The connection that holds the default model goes only when nothing else could be the default:
   * then the AI is off until a new connection; otherwise the teacher picks another default first.
   */
  private async deleteProvider(provider: AiProvider): Promise<void> {
    const holdsDefault = provider.models.some((model) => model.default);
    const others = this.setup.models().length > provider.models.length;
    if (holdsDefault && others) {
      this.snackbar.error(this.t.deleteDefault);
      return;
    }
    if (
      !(await this.confirm.danger({
        header: this.t.deleteHeader,
        message: this.t.deleteMessage(provider.name),
        acceptLabel: this.t.deleteAccept,
      }))
    ) {
      return;
    }
    const remove = (): void => {
      this.api.deleteProvider(provider.id).subscribe(() => {
        this.setup.remove(provider.id);
        this.snackbar.success(this.t.deleted);
      });
    };
    if (holdsDefault) {
      this.setup.clearDefault().subscribe(remove);
    } else {
      remove();
    }
  }

  private async deleteModel(provider: AiProvider, model: AiModel): Promise<void> {
    if (
      await this.confirm.danger({
        header: this.t.deleteModelHeader,
        message: model.default
          ? this.t.deleteDefaultModel(model.label)
          : this.t.deleteModelMessage(model.label),
        acceptLabel: this.t.deleteAccept,
      })
    ) {
      this.api.deleteModel(provider.id, model.id).subscribe(() => {
        this.setup.removeModel(model.id);
        this.snackbar.success(this.t.modelDeleted);
      });
    }
  }
}
