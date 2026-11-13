import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HelpArticleText } from '../help.models';
import { ADMIN_ARTICLES as ADMIN_EN } from './admin/en';
import { ADMIN_ARTICLES as ADMIN_RU } from './admin/ru';
import { STUDENT_ARTICLES as STUDENT_EN } from './student/en';
import { STUDENT_ARTICLES as STUDENT_RU } from './student/ru';
import { TEACHER_ARTICLES as TEACHER_EN } from './teacher/en';
import { TEACHER_ARTICLES as TEACHER_RU } from './teacher/ru';

type Texts = Readonly<Record<string, HelpArticleText>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const PARSED: unknown = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'testing', 'help-articles.fixture.json'), 'utf8'),
);

/** The texts as they were when each edition was one file (stage 367.2): do not regenerate it. */
const ORIGINAL: Record<string, unknown> = isRecord(PARSED) ? PARSED : {};

/** Reviewed additions in 0.48.2; the historical migration fixture stays unchanged. */
const LOADING_RU = `## Загрузка данных

При коротком ожидании индикатор не появляется. Если загрузка занимает больше 200 мс, появляется вращающаяся фигура. Данные показываются сразу по готовности. При включённом в системе уменьшении движения фигура остаётся неподвижной.

`;
const LOADING_EN = `## Loading data

Short requests finish without a loading indicator. After 200 ms, a rotating shape appears until the data is ready. If your device uses reduced motion, the shape stays still.

`;

const EDITIONS: readonly (readonly [string, Texts])[] = [
  ['teacher.ru', TEACHER_RU],
  ['teacher.en', TEACHER_EN],
  ['student.ru', STUDENT_RU],
  ['student.en', STUDENT_EN],
  ['admin.ru', ADMIN_RU],
  ['admin.en', ADMIN_EN],
];

describe('help articles after the split into one file per topic', () => {
  it.each(EDITIONS)('%s preserves the baseline with reviewed loading guidance', (name, texts) => {
    const original = ORIGINAL[name];
    expect(isRecord(original)).toBe(true);
    expect(Object.keys(texts)).toEqual(Object.keys(isRecord(original) ? original : {}));
    if (!isRecord(original)) throw new Error(`Missing edition ${name}`);
    const topic = name.startsWith('admin.') ? 'diagnostics' : 'appearance';
    const article = original[topic];
    if (!isRecord(article) || typeof article['body'] !== 'string') {
      throw new Error(`Missing original article ${name}/${topic}`);
    }
    const guidance = name.endsWith('.ru') ? LOADING_RU : LOADING_EN;
    expect(texts).toEqual({
      ...original,
      [topic]: { ...article, body: article['body'].replace('## ', `${guidance}## `) },
    });
  });

  it('has no source line longer than 200 characters', () => {
    const long: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
          readFileSync(path, 'utf8')
            .split('\n')
            .forEach((line, index) => {
              if (line.length > 200) {
                long.push(`${path}:${String(index + 1)}`);
              }
            });
        }
      }
    };
    walk(join(process.cwd(), 'src', 'app', 'features', 'help', 'articles'));
    expect(long).toEqual([]);
  });
});
