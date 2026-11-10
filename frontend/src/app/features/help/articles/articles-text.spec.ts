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

const EDITIONS: readonly (readonly [string, Texts])[] = [
  ['teacher.ru', TEACHER_RU],
  ['teacher.en', TEACHER_EN],
  ['student.ru', STUDENT_RU],
  ['student.en', STUDENT_EN],
  ['admin.ru', ADMIN_RU],
  ['admin.en', ADMIN_EN],
];

describe('help articles after the split into one file per topic', () => {
  it.each(EDITIONS)('%s keeps its topics, their order and every text', (name, texts) => {
    const original = ORIGINAL[name];
    expect(isRecord(original)).toBe(true);
    expect(Object.keys(texts)).toEqual(Object.keys(isRecord(original) ? original : {}));
    expect(texts).toEqual(original);
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
