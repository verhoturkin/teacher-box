import { TestBed } from '@angular/core/testing';
import { ADMIN_ARTICLES } from './articles/admin';
import { STUDENT_ARTICLES } from './articles/student';
import { TEACHER_ARTICLES } from './articles/teacher';
import { HelpLibrary, searchArticles } from './help-library';
import { HelpArticleText } from './help.models';
import { HELP_TITLES, HELP_TOPICS, HelpArea, helpUrl, isHelpArea } from './help-topics';

const TEXTS: Record<HelpArea, Readonly<Record<string, HelpArticleText>>> = {
  teacher: TEACHER_ARTICLES,
  cabinet: STUDENT_ARTICLES,
  admin: ADMIN_ARTICLES,
};

describe('HelpLibrary', () => {
  let library: HelpLibrary;

  beforeEach(() => {
    library = TestBed.inject(HelpLibrary);
  });

  it('has an article for every topic of every area, in the order of the contents', async () => {
    for (const area of ['teacher', 'cabinet', 'admin'] as const) {
      const articles = await library.articles(area);
      expect(articles.map((article) => article.id)).toEqual([...HELP_TOPICS[area]]);
      for (const article of articles) {
        expect(article.title).not.toBe('');
        expect(article.summary).not.toBe('');
        expect(article.body.trim().length).toBeGreaterThan(100);
      }
    }
    expect(Object.keys(TEXTS.teacher).sort()).toEqual([...HELP_TOPICS.teacher].sort());
  });

  it('names the help buttons by the titles of the articles', () => {
    expect(Object.keys(HELP_TITLES)).toHaveLength(
      Object.values(HELP_TOPICS).reduce((count, topics) => count + topics.length, 0),
    );
    for (const [topic, title] of Object.entries(HELP_TITLES)) {
      const [area, id] = topic.split('/');
      expect(isHelpArea(area) ? TEXTS[area][id ?? '']?.title : undefined, topic).toBe(title);
    }
  });

  it('links inside the articles lead to existing articles', () => {
    const links: string[] = [];
    for (const texts of Object.values(TEXTS)) {
      for (const text of Object.values(texts)) {
        for (const match of text.body.matchAll(/\]\((\/[^)]*)\)/g)) {
          links.push(match[1] ?? '');
        }
      }
    }
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      const [, area, help, topic] = link.split('/');
      expect(isHelpArea(area), link).toBe(true);
      expect(help, link).toBe('help');
      expect(isHelpArea(area) && HELP_TOPICS[area].includes(topic ?? ''), link).toBe(true);
    }
  });

  it('finds an article by its topic', async () => {
    expect((await library.article('teacher/groups'))?.title).toBe('Группы');
    expect((await library.article('cabinet/bot'))?.title).toBe('Бот в мессенджере');
    expect((await library.article('admin/diagnostics'))?.id).toBe('diagnostics');
    expect(await library.article('teacher/missing')).toBeNull();
    expect(await library.article('other/faq')).toBeNull();
    expect(helpUrl('teacher/schedule')).toBe('/teacher/help/schedule');
  });

  it('searches every word in titles and texts', async () => {
    const articles = await library.articles('teacher');

    expect(searchArticles(articles, '  ')).toHaveLength(articles.length);
    expect(searchArticles(articles, 'ТЕЛЕМОСТ').map((article) => article.id)).toContain('meetings');
    expect(searchArticles(articles, 'группа цена').map((article) => article.id)).toContain(
      'groups',
    );
    expect(searchArticles(articles, 'абракадабра')).toEqual([]);
  });
});
