import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
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

/** The help of an area: contents, search and the chosen article (`/<area>/help/<topic>`). */
@Component({
  selector: 'tb-help-page',
  imports: [ReactiveFormsModule, RouterLink, Card, IconField, InputIcon, InputText, HelpArticleView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Справка</h1>
    <div class="tb-help">
      <p-card styleClass="tb-help__contents">
        <p-iconfield>
          <p-inputicon styleClass="pi pi-search" />
          <input pInputText [formControl]="search" placeholder="Поиск по справке" aria-label="Поиск по справке" />
        </p-iconfield>
        <nav aria-label="Статьи справки">
          <ul class="tb-help__list">
            @for (article of found(); track article.id) {
              <li>
                <a [routerLink]="['/', area(), 'help', article.id]" [class.tb-help__current]="article.id === current()?.id">
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
      <p-card styleClass="tb-help__article">
        @if (current(); as article) {
          @if (missing()) {
            <p class="tb-muted">Такой статьи нет — вот «{{ article.title }}».</p>
          }
          <h2 class="tb-help__title">{{ article.title }}</h2>
          <tb-help-article [body]="article.body" />
        }
      </p-card>
    </div>
  `,
  styles: `
    .tb-help {
      display: grid;
      grid-template-columns: minmax(14rem, 20rem) minmax(0, 1fr);
      gap: 1rem;
      align-items: start;

      @media (max-width: 768px) {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .tb-help__list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin: 1rem 0 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        flex-direction: column;
      }
    }

    .tb-help__current {
      font-weight: 600;
    }

    .tb-help__title {
      margin-top: 0;
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
    return this.loaded() && topic !== undefined && this.articles().every((article) => article.id !== topic);
  });

  constructor() {
    effect(() => {
      const area = this.area();
      void this.library.articles(area).then((articles) => {
        this.articles.set(articles);
        this.loaded.set(true);
      });
    });
  }
}
