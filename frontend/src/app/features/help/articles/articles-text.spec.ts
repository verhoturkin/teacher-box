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

/** Reviewed board capacity guidance from stage 392; keep the migration fixture unchanged. */
const BOARD_SIZE_RU = `## Размер доски

Когда доска почти заполнена, учитель видит подсказку. Откройте меню доски → «Резервные копии» →
«Сделать копию», затем создайте новую доску в «Материалах» для следующих занятий. Копия не уменьшает
размер исходной доски. Удалённые фигуры очищаются через 30 дней; вернуть их после этого можно из
копии доски, но не отменой старого удаления.

`;
const BOARD_SIZE_EN = `## Board size

When a board is nearly full, a hint appears for the teacher. Open the board menu → “Backups” →
“Make a backup”, then create a new board in Materials for your next lessons. Making a backup does
not reduce the original board’s size. Deleted shapes are cleared after 30 days; after that, recover
them from a board backup rather than undoing the old deletion.

`;

/** Reviewed backup guidance from stage 395 (failure notices, Drive retention): [baseline, now] per edition. */
const BACKUPS: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  'teacher.ru': [
    [
      'более старые портал удаляет после создания новой.\n',
      'более старые портал удаляет после создания новой.\n\nЕсли ночная копия не получилась, портал пришлёт ' +
        'уведомление во «Входящие» и в мессенджеры (тема «Ученики, календарь и копии»). Создайте копию вручную; ' +
        'если и она не создаётся, напишите администратору портала — причина в его журнале.\n',
    ],
    [
      'и ошибку, если не ушла.\n',
      'и ошибку, если не ушла. Если копия по расписанию или ручная не ушла сама, придёт и уведомление.\n',
    ],
    [
      'там они хранятся столько же, сколько на сервере (по умолчанию две недели).',
      'там хранятся три последние копии (число задаёт администратор), более старые остаются только на сервере.',
    ],
  ],
  'teacher.en': [
    [
      'Older backups are removed after a new one is created.\n',
      'Older backups are removed after a new one is created.\n\nIf the nightly backup fails, the portal sends ' +
        'you a notification in your inbox and messengers (topic “Students, calendar and backups”). Make a ' +
        'backup by hand; if that fails too, contact the portal administrator — the reason is in their log.\n',
    ],
    [
      'The Drive panel shows the latest upload and any error.\n',
      'The Drive panel shows the latest upload and any error; when a new backup fails to upload on its own, ' +
        'you also get a notification.\n',
    ],
    [
      'Retention matches the server; pre-restore and pre-reset backups remain on the server only.',
      'It keeps the three newest backups (the administrator can change this); older ones, like ' +
        'pre-restore and pre-reset backups, stay on the server only.',
    ],
  ],
  'admin.ru': [
    [
      'на сервере и в Google Диске.\n',
      'на сервере и в Google Диске. В Google Диске, кроме того, остаются только последние копии — ' +
        '«Сколько копий хранить в Google Диске» (по умолчанию 3).\n',
    ],
  ],
  'admin.en': [
    [
      'from both the server and Google Drive.\n',
      'from both the server and Google Drive. Google Drive also keeps only the newest backups: ' +
        '“Backups to keep in Google Drive”, with a default of 3.\n',
    ],
  ],
};

/** Reviewed voice answer guidance from stage 403.2: [baseline, now] of the homework article per edition. */
const VOICE: Readonly<Record<string, readonly [string, string]>> = {
  'student.ru': [
    '3. Нажмите «Сдать».\n',
    '3. Нажмите «Сдать».\n\nОтвет можно сказать голосом: **Записать голос** включает микрофон, рядом идёт ' +
      'время записи. «Записать заново» начинает сначала, «Остановить запись» прикрепляет запись к ответу, ' +
      'как файл. Если браузер не дал доступ к микрофону, разрешите его в настройках браузера и нажмите ' +
      'снова. Голосовой ответ слушается прямо на странице — кнопкой «Прослушать» рядом с записью.\n',
  ],
  'student.en': [
    '3. Choose “Hand in”.\n',
    '3. Choose “Hand in”.\n\nYou can also answer by voice: **Record voice** turns the microphone on and ' +
      'shows how long you have been recording. “Record again” starts over, and “Stop recording” attaches ' +
      'the recording to your answer like a file. If the browser has no access to the microphone, allow it ' +
      'in the browser settings and try again. Voice recordings play right on the page: choose “Play” next ' +
      'to one.\n',
  ],
  'teacher.ru': [
    'сколько работ ещё не сдано.',
    'сколько работ ещё не сдано. Голосовой ответ ученика слушается прямо в работе: кнопка «Прослушать» ' +
      'рядом с записью.',
  ],
  'teacher.en': [
    'the student’s response and attached images.',
    'the student’s response and attached images; a voice response plays right there with “Play” next ' +
      'to it.',
  ],
};

/** Free times of the day offered as chips in the move dialogs (stage 405.2). */
const FREE_TIMES: Record<string, readonly [string, string]> = {
  'teacher.ru': [
    '(или укажите своё). Если',
    '(или выберите своё: свободные окна дня вроде «9:00–11:30» подставляют начало, можно ввести любое; занятое время подсветится подсказкой). Если',
  ],
  'teacher.en': [
    'approve the suggested time or enter another. The portal',
    'approve the suggested time or pick another: the free windows of the day such as “9:00–11:30” fill in the start, or type any time yourself; a hint warns if it is taken. The portal',
  ],
  'student.ru': [
    'Выберите свободное время: попросить',
    'Под полем даты портал показывает свободные окна выбранного дня вроде «9:00–11:30»: нажмите на окно, чтобы подставить его начало, или введите любое время. Если время занято, под полем появится подсказка. Попросить',
  ],
  'student.en': [
    'Choose a free time; the portal',
    'Below the date field the portal offers the free windows of the chosen day such as “9:00–11:30”: tap one to fill in its start, or type any time yourself. If the time is taken, a hint says so. The portal',
  ],
};

const DISK_USAGE_RU = [
  'журнал и настройки без паролей и личных данных.',
  ' В «Ресурсах» видно, сколько занимают база данных, файлы, копии на сервере и восстановления.' +
    ' Метка «Меньше последней копии» значит, что следующая копия может не поместиться:' +
    ' освободите место или удалите старые копии.',
] as const;
const DISK_USAGE_EN = [
  'redacted settings and system information.',
  ' “Resources” shows how much space the database, files, backups on the server and restores' +
    ' take up. “Less than the last backup” means the next backup may not fit: free up some space' +
    ' or delete old backups.',
] as const;

const EDITIONS: readonly (readonly [string, Texts])[] = [
  ['teacher.ru', TEACHER_RU],
  ['teacher.en', TEACHER_EN],
  ['student.ru', STUDENT_RU],
  ['student.en', STUDENT_EN],
  ['admin.ru', ADMIN_RU],
  ['admin.en', ADMIN_EN],
];

describe('help articles after the split into one file per topic', () => {
  it.each(EDITIONS)('%s preserves the baseline with reviewed guidance', (name, texts) => {
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
    let body = article['body'].replace('## ', `${guidance}## `);
    if (name.startsWith('admin.')) {
      const [anchor, disk] = name.endsWith('.ru') ? DISK_USAGE_RU : DISK_USAGE_EN;
      expect(body).toContain(anchor);
      body = body.replace(anchor, anchor + disk);
    }
    const expected: Record<string, unknown> = { ...original, [topic]: { ...article, body } };
    if (name.startsWith('teacher.')) {
      const boards = original['boards'];
      if (!isRecord(boards) || typeof boards['body'] !== 'string') {
        throw new Error(`Missing original article ${name}/boards`);
      }
      const boardGuidance = name.endsWith('.ru') ? BOARD_SIZE_RU : BOARD_SIZE_EN;
      expected['boards'] = {
        ...boards,
        body: boards['body'].replace('## ', `${boardGuidance}## `),
      };
    }
    const backups = original['backups'];
    const backupGuidance = BACKUPS[name];
    if (backupGuidance && (!isRecord(backups) || typeof backups['body'] !== 'string')) {
      throw new Error(`Missing original article ${name}/backups`);
    }
    if (backupGuidance && isRecord(backups) && typeof backups['body'] === 'string')
      expected['backups'] = {
        ...backups,
        body: backupGuidance.reduce(
          (body, [before, after]) => body.replace(before, after),
          backups['body'],
        ),
      };
    const voice = VOICE[name];
    const homework = original['homework'];
    if (voice && isRecord(homework) && typeof homework['body'] === 'string') {
      expect(homework['body']).toContain(voice[0]);
      expected['homework'] = { ...homework, body: homework['body'].replace(...voice) };
    }
    const free = FREE_TIMES[name];
    const schedule = original['schedule'];
    if (free && isRecord(schedule) && typeof schedule['body'] === 'string') {
      expect(schedule['body']).toContain(free[0]);
      expected['schedule'] = { ...schedule, body: schedule['body'].replace(...free) };
    }
    expect(texts).toEqual(expected);
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
