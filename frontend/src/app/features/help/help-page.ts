import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { HelpArticleView } from './help-article-view';
import { HelpLibrary, searchArticles } from './help-library';
import { HelpArticle } from './help.models';
import { HelpArea } from './help-topics';
import { PageHeader } from '@shared/ui/page-header';

/**
 * The help of an area (`/<area>/help/<topic>`): the chosen article, then the contents with search.
 */
@Component({
  selector: 'tb-help-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Card,
    IconField,
    InputIcon,
    InputText,
    HelpArticleView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Справка" />
    <div class="tb-help">
      <p-card #article class="tb-help__article-card" styleClass="tb-help__article">
        @if (current(); as article) {
          @if (missing()) {
            <p class="tb-muted">Такой статьи нет — вот «{{ article.title }}».</p>
          }
          <h2 class="tb-help__title">{{ article.title }}</h2>
          <tb-help-article [body]="article.body" />
        }
      </p-card>
      <p-card styleClass="tb-help__contents">
        <p-iconfield>
          <p-inputicon styleClass="pi pi-search" />
          <input
            pInputText
            [formControl]="search"
            placeholder="Поиск по справке"
            aria-label="Поиск по справке"
          />
        </p-iconfield>
        <nav aria-label="Статьи справки">
          <ul class="tb-help__list">
            @for (article of found(); track article.id) {
              <li>
                <a
                  [routerLink]="['/', area(), 'help', article.id]"
                  [class.tb-help__current]="article.id === current()?.id"
                  (click)="showArticle()"
                >
                  {{ article.title }}
                </a>
                <small class="tb-muted">{{ article.summary }}</small>
              </li>
            } @empty {
              @if (loaded()) {
                <li class="tb-muted">Ничего не нашлось. Попробуйте другие слова.</li>
              }
            }
          </ul>
        </nav>
      </p-card>
    </div>
  `,
  styles: `
    /* One column (ADR-0021): the article first, the contents follow it */
    .tb-help {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
      max-width: var(--tb-content-narrow);
    }

    /* M3 list: the current article on the secondary container */
    .tb-help__list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: var(--tb-space-3) calc(-1 * var(--tb-space-3)) 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--tb-space-2) var(--tb-space-3);
        border-radius: var(--tb-shape-md);

        &:has(.tb-help__current) {
          background: var(--p-md-secondary-container);
        }

        a {
          font: var(--tb-type-title-s);
        }

        small {
          font: var(--tb-type-body-s);
        }
      }
    }

    .tb-help__current {
      color: var(--p-md-on-secondary-container);
    }

    .tb-help__title {
      margin-top: 0;
      font: var(--tb-type-headline-s);
    }
  `,
})
export class HelpPage {
  private readonly library = inject(HelpLibrary);

  /** Route data: whose help. */
  readonly area = input.required<HelpArea>();
  /** Route parameter: the article. */
  readonly topic = input<string>();

  protected readonly articles = signal<HelpArticle[]>([]);
  protected readonly loaded = signal(false);
  readonly search = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  protected readonly found = computed(() => searchArticles(this.articles(), this.query()));
  protected readonly current = computed(() => {
    const topic = this.topic();
    const all = this.articles();
    return all.find((article) => article.id === topic) ?? all[0] ?? null;
  });
  protected readonly missing = computed(() => {
    const topic = this.topic();
    return (
      this.loaded() &&
      topic !== undefined &&
      this.articles().every((article) => article.id !== topic)
    );
  });

  private readonly article = viewChild.required('article', { read: ElementRef });

  constructor() {
    effect(() => {
      const area = this.area();
      void this.library.articles(area).then((articles) => {
        this.articles.set(articles);
        this.loaded.set(true);
      });
    });
  }

  /** An article chosen in the contents under it: the page goes up to the article. */
  showArticle(): void {
    const article: unknown = this.article().nativeElement;
    if (article instanceof HTMLElement && typeof article.scrollIntoView === 'function') {
      article.scrollIntoView({ block: 'start' });
    }
  }
}
