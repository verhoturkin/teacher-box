import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HelpArticleText } from '../help.models';
import { GUARDIAN_TOPICS } from '../help-topics';
import { ADMIN_ARTICLES as ADMIN_EN } from './admin/en';
import { ADMIN_ARTICLES as ADMIN_RU } from './admin/ru';
import { GUARDIAN_ARTICLES as GUARDIAN_EN } from './guardian/en';
import { GUARDIAN_ARTICLES as GUARDIAN_RU } from './guardian/ru';
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
/** Loading rows and motion (0.53.0): teacher and student editions only. */
const MOTION_RU =
  'Списки, пока грузятся, показывают бледные строки-заготовки, а переходы между страницами и окна двигаются плавно; при уменьшении движения остаётся короткое появление.';
const MOTION_EN =
  'Lists show pale placeholder rows while they load, and page changes and dialogs move smoothly; with reduced motion they just fade in briefly.';
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
    '3. Нажмите «Сдать».\n\nОтвет можно сказать голосом: **Записать голос** включает микрофон и показывает ' +
      'время записи, красная кнопка её останавливает. Перед сдачей запись можно прослушать, «Перезаписать» ' +
      'или «Удалить»; «Сдать» отправит её вместе с ответом. Если браузер не дал доступ к микрофону, ' +
      'разрешите его в настройках браузера и нажмите снова. Сданная запись тоже слушается прямо на ' +
      'странице.\n',
  ],
  'student.en': [
    '3. Choose “Hand in”.\n',
    '3. Choose “Hand in”.\n\nYou can also answer by voice: **Record voice** turns the microphone on and ' +
      'shows the recording time; the red button stops it. Before you hand it in, play the recording back, ' +
      'or choose “Record again” or “Delete”; “Hand in” sends it with your answer. If the browser has no ' +
      'access to the microphone, allow it in the browser settings and try again. Handed-in recordings ' +
      'play right on the page.\n',
  ],
  'teacher.ru': [
    'сколько работ ещё не сдано.',
    'сколько работ ещё не сдано. Голосовой ответ ученика слушается прямо в работе.',
  ],
  'teacher.en': [
    'the student’s response and attached images.',
    'the student’s response and attached images; a voice response plays right there.',
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

/** Invitation page guidance (stage 406.1): [baseline, now] of the student login article. */
const INVITE: Readonly<Record<string, readonly [string, string]>> = {
  'student.ru': [
    'и вы в личном кабинете. Дальше',
    'и вы в личном кабинете. Логин — латиницей, цифрами, «.», «-», «_», от 3 до 50 символов. ' +
      'Если ссылка уже использована или устарела, нажмите «Войти» (или «В кабинет», если вы уже вошли) ' +
      'либо попросите учителя прислать новую. Дальше',
  ],
  'student.en': [
    'with those details. If',
    'with those details. The username is 3–50 characters: letters (a–z), numbers, dots, hyphens or ' +
      'underscores. If the link has already been used, choose “Sign in” (or “To my cabinet” if you are ' +
      'signed in). If',
  ],
};

/** Checklist keeps done steps (stage 406.2): [baseline, now] of the first-steps article. */
const CHECKLIST: Readonly<Record<string, readonly [string, string]>> = {
  'teacher.ru': [
    'в нём остаются только несделанные шаги',
    'в нём сделанные шаги отмечены галочкой',
  ],
  'teacher.en': [
    'tracks these steps and hides completed ones',
    'tracks these steps and keeps completed ones ticked',
  ],
};

/** The teacher's working hours (stage 405.3): [topic, baseline, now] per edition. */
const WORKING_HOURS: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'settings',
      '([Оплаты](/teacher/help/billing)). «Правила»',
      '([Оплаты](/teacher/help/billing)), рабочее время — часы календаря, внутри них портал предлагает' +
        ' свободное время для переноса занятия. «Правила»',
    ],
    [
      'setup',
      'устройства. Валюта, длительность',
      'устройства. Рабочее время — часы календаря и свободного времени для переноса занятий.' +
        ' Валюта, длительность',
    ],
  ],
  'teacher.en': [
    [
      'settings',
      '[Payments](/teacher/help/billing)). Under “Rules”',
      '[Payments](/teacher/help/billing)), and your working hours: the calendar shows them, and free' +
        ' times to move a lesson are offered within them. Under “Rules”',
    ],
    [
      'setup',
      'device. Then choose a currency',
      'device. Your working hours set the hours of the calendar and of free times to move a lesson.' +
        ' Then choose a currency',
    ],
  ],
};

/** Moderating a call, its chat, the board and the floating window (408.2–410.1, 421.2): [topic, baseline, now] of the call articles. */
/** The review sheet without quick phrases (421.4): [topic, baseline, now]. */
const REVIEW_SHEET: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'homework',
      '- **Комментарий ученику** и быстрые фразы под ним — «Отлично», «Есть ошибка», «Перепроверь»;',
      '- **Комментарий ученику**;',
    ],
  ],
  'teacher.en': [['homework', ' Quick comments help with common responses.', '']],
};

const CALL_MODERATION: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'calls',
      '- **Выйти из звонка**',
      '- **Управление участником** — на плитке другого участника откройте меню «⋮». «Выключить' +
        ' микрофон» отключает ему звук (он сможет включить его снова); «Удалить из звонка»' +
        ' спросит подтверждение, после чего участник увидит, почему звонок закончился, и сможет' +
        ' войти снова.\n- **Доска ученика** — в меню «Настройки звонка» выберите участника: его' +
        ' доски откроются в новой вкладке, звонок продолжится.\n- **Чат** — сообщения всем участникам звонка; число на кнопке —' +
        ' непрочитанные. Чат видят только участники звонка, после звонка он не сохраняется.' +
        '\n- **Поверх других окон** — в Chrome и Edge на компьютере звонок переходит в маленькое' +
        ' окно поверх других вкладок и программ: название звонка, плитки, микрофон, камера и' +
        ' «Выйти», а вы работайте в портале: откройте доску, задания, расписание. «Вернуть во' +
        ' вкладку» или закрытие окна вернёт звонок в портал. В других браузерах и на телефоне' +
        ' звонок остаётся в большом окне — для работы рядом откройте портал в новой вкладке.' +
        '\n- **Выйти из звонка**',
    ],
    // 421.2: one floating mode, the mini window is gone
    [
      'calls',
      '- **Свернуть** — звонок продолжится в маленьком окне в углу, а вы работайте в портале:' +
        ' откройте доску, задания, расписание. Окно можно перетащить в другой угол. «Развернуть»' +
        ' вернёт большое окно.\n',
      '',
    ],
  ],
  'teacher.en': [
    [
      'calls',
      '- **Leave call:**',
      '- **Moderate:** on another participant’s tile, open the “⋮” menu. “Turn off microphone”' +
        ' mutes them (they can turn it on again); “Remove from call” asks for confirmation, then' +
        ' the person sees why the call ended and can rejoin.\n- **Student’s board:** in the call “Settings” menu, pick a participant: their' +
        ' boards open in a new tab and the call carries on.\n- **Chat:** message everyone in the' +
        ' call; the number on the button shows unread messages. Only people in the call see the' +
        ' chat, and it isn’t saved after the call.\n- **Float over other windows:** in Chrome and' +
        ' Edge on a computer, the call moves to a small window above other tabs and apps, with' +
        ' the call name, tiles, microphone, camera and Leave call, so you can use boards,' +
        ' assignments or other portal pages. “Back to the tab” or closing that window brings the' +
        ' call back to the portal. In other browsers and on a phone, the call stays in the full' +
        ' window; open the portal in another tab to work alongside it.\n- **Leave call:**',
    ],
    [
      'calls',
      '- **Minimise:** keep the call in a small movable window while using boards, assignments' +
        ' or other portal pages. On a phone it becomes a bar above the bottom navigation.' +
        ' “Expand” restores the full window.\n',
      '',
    ],
  ],
  'student.ru': [
    [
      'lesson',
      '«Выйти из звонка» — красная кнопка.',
      '«Чат» открывает переписку со всеми в звонке, число на кнопке — непрочитанные сообщения;' +
        ' после звонка чат не сохраняется. В Chrome и Edge на компьютере «Поверх других окон»' +
        ' переносит звонок в маленькое окно над другими вкладками и программами — откройте' +
        ' доску или задание, разговор продолжится; «Вернуть во вкладку» вернёт его. В других' +
        ' браузерах откройте портал в новой вкладке. «Выйти из звонка» — красная кнопка.',
    ],
    [
      'lesson',
      ', а «Свернуть» оставит звонок в маленьком окне — откройте доску или задание, разговор' +
        ' продолжится.',
      '.',
    ],
  ],
  'student.en': [
    [
      'lesson',
      '- choose “Leave call” to leave.',
      '- choose “Chat” to message everyone in the call; the number on the button shows unread' +
        ' messages, and the chat isn’t saved after the call;\n- choose “Float over other windows”' +
        ' in Chrome or Edge on a computer to keep talking in a small window above other tabs and' +
        ' apps while you use a board or work on an assignment; “Back to the tab” brings it back.' +
        ' In other browsers, open the portal in another tab;\n- choose “Leave call” to leave.',
    ],
    [
      'lesson',
      '- choose “Minimise” to keep talking while you use a board or work on an assignment;\n' +
        '- choose “Expand” to return to the full call window;\n',
      '',
    ],
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

/** The pane drag handle (424.1): one paragraph in the appearance article of the teacher. */
const PANE_HANDLE: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'appearance',
      'выйти из портала.\n',
      'выйти из портала.\n\nНа большом экране границу между двумя панелями, например списком учеников и ' +
        'карточкой ученика, можно перетащить за ручку, чтобы сделать панель шире; двойной щелчок по ручке ' +
        'возвращает обычную ширину. Ширина запоминается на этом устройстве.\n',
    ],
  ],
  'teacher.en': [
    [
      'appearance',
      'Settings and Help near the bottom.\n',
      'Settings and Help near the bottom.\n\nOn a large screen, drag the handle between two panes, such as ' +
        'the student list and the student card, to widen one of them; double-click it to go back to the ' +
        'standard width. The portal remembers the width on this device.\n',
    ],
  ],
};

/** Typed or picked dates and times, the clock (425.5): one paragraph in the schedule article. */
const DATE_TIME: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'schedule',
      '## Нерабочее время\n',
      '**Дата и время.** Их можно вписать (например, «17.11.2026», «14:30» или «1430») или выбрать: ' +
        'значок календаря открывает календарь в окне по центру экрана, значок часов — циферблат со временем.\n\n## Нерабочее время\n',
    ],
  ],
  'teacher.en': [
    [
      'schedule',
      '## Time off\n',
      '**Date and time.** Type the date and time (for example “17.11.2026”, “14:30” or “1430”) or pick them: the ' +
        'calendar icon opens a calendar in a dialog, and the clock icon opens a dial.\n\n## Time off\n',
    ],
  ],
  'student.ru': [
    [
      'schedule',
      'Учитель получит запрос и ответит',
      'Дату и время можно вписать (например, «17.11.2026», «14:30» или «1430») или выбрать: ' +
        'значок календаря открывает календарь в окне по центру экрана, значок часов — циферблат со временем.\n\nУчитель получит запрос и ответит',
    ],
  ],
  'student.en': [
    [
      'schedule',
      'Your teacher will receive the request',
      'Type the date and time (for example “17.11.2026”, “14:30” or “1430”) or pick them: the calendar ' +
        'icon opens a calendar in a dialog, and the clock icon opens a dial.\n\nYour teacher will receive the request',
    ],
  ],
};

/** A tap on a whole notification row opens it (429.2): [topic, baseline, now] of the notifications article. */
const TAP_ROW: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'notifications',
      'проведите по нему пальцем влево или вправо.',
      'проведите по нему пальцем влево или вправо. Нажатие на само уведомление открывает связанную ' +
        'страницу (занятие, задание) и закрывает окно; уведомление без ссылки просто читается.',
    ],
  ],
  'teacher.en': [
    [
      'notifications',
      'swipe an item left or right to mark it as read.',
      'swipe an item left or right to mark it as read. Tapping a notification opens the page it is ' +
        'about (a lesson, a task) and closes the panel; a notification with no link is just for reading.',
    ],
  ],
};

/** Two cards of Today, no debt rows (427.1): [topic, baseline, now] of the first-steps article. */
const TWO_CARDS: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'first-steps',
      'в конце карточки «Нужно сделать» есть список',
      'под карточками дел есть список',
    ],
    [
      'first-steps',
      '- **Нужно сделать** — неотмеченные занятия, запросы учеников, работы на проверку и долги. Нажмите ' +
        'на нужную запись, чтобы перейти к действию. Здесь же можно отметить занятие «Проведено» или ' +
        '«Пропуск».\n- **Финансы** — поступления за месяц и долги учеников.',
      '- **Отметить занятия** — прошедшие занятия без отметки и под ними запросы учеников на перенос или ' +
        'отмену. Отметьте занятие «Проведено» или «Пропуск» прямо в строке, у группы — отметьте ' +
        'посещаемость.\n- **Проверить работы** — сданные работы, которые ждут проверки. Нажмите ' +
        '«Проверить», чтобы открыть работу.\n\nУ каждой карточки свой счётчик. Карточка без дел ' +
        'скрывается; если дел нет совсем, вы увидите «Срочных дел нет». Длинный список показывает, ' +
        'сколько записей ещё осталось.\n\n- **Финансы** — поступления за месяц, общий долг и число ' +
        'должников. Кто именно должен, смотрите в разделе «Оплаты».',
    ],
  ],
  'teacher.en': [
    ['first-steps', 'checklist under “To do” on', 'checklist under the task cards on'],
    [
      'first-steps',
      '- **To do** brings together lessons awaiting an outcome, student requests, submissions to review ' +
        'and outstanding balances. Choose “Completed” or “Missed” to record an outcome; for groups, ' +
        'record attendance. Long lists show a count of additional items.\n- **The monthly summary** ' +
        'shows payments received this month and outstanding balances.',
      '- **Mark lessons** lists past lessons awaiting an outcome, with student requests to move or ' +
        'cancel a lesson below them. Choose “Completed” or “Missed” in the row to record an outcome; ' +
        'for groups, record attendance.\n- **Review submissions** lists work waiting for your review. ' +
        'Choose “Review” to open it.\n\nEach card has its own count and disappears when there is ' +
        'nothing in it; when both are clear, you will see “Nothing urgent”. Long lists show a count of ' +
        'additional items.\n\n- **The monthly summary** shows payments received this month, the total ' +
        'outstanding and how many students owe. See “Payments” for who they are.',
    ],
  ],
  'student.en': [
    [
      'appearance',
      'recent feedback, your lesson credit and materials.',
      'recent feedback, and your lesson credit.',
    ],
  ],
};

/** One lesson, one row on Today (432.2): [topic, baseline, now] of the first-steps article. */
const ONE_ROW: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'first-steps',
      'Это главная страница учителя: ближайшее занятие,',
      'Это главная страница учителя: занятия на сегодня,',
    ],
    [
      'first-steps',
      '- **Следующее занятие** — время начала и длительность, ученик или группа, тема и доски. Нажмите ' +
        '«Начать урок» (во время занятия — «Войти в урок»). После окончания карточка покажет следующее ' +
        'занятие.\n- **Занятия сегодня** — список под карточкой следующего занятия: время, с кем и ' +
        'статус; ближайшее занятие выделено. На телефоне этот список и итоги недели тоже доступны в ' +
        'общей ленте.',
      '- **Занятия сегодня** — время, с кем и статус каждого занятия. Текущее или ближайшее раскрыто: ' +
        '«Идёт · ещё 25 мин» или «Через 40 мин», время окончания, ученик или группа, тема и последняя ' +
        'доска. Если у занятия есть звонок, там же кнопка «Начать урок» (во время занятия — «Войти в ' +
        'урок»). После окончания раскроется следующее. Если сегодня занятий нет, список называется ' +
        '«Ближайшее занятие» и показывает его день.',
    ],
  ],
  'teacher.en': [
    [
      'first-steps',
      'Your next lesson appears first, with its time, duration, topic, boards and “Start lesson” ' +
        'button. The button changes to “Join lesson” while the lesson is running. Before and during a ' +
        'lesson, the card shows a countdown or the time remaining. After it ends, the next lesson ' +
        'appears automatically.\n\n- **Lessons today** lists the day’s lessons and their status, with ' +
        'the next one highlighted.',
      '- **Lessons today** lists the day’s lessons and their status. The current or next lesson is ' +
        'expanded: a countdown or the time remaining, the end time, the student or group, the topic and ' +
        'the last board used. If the lesson has a call, “Start lesson” is there too (“Join lesson” ' +
        'while it is running). When it ends, the next lesson expands. With no lessons today, the card ' +
        'is called “Next lesson” and shows its day.',
    ],
  ],
};

/** «Позвать» on Today (432.3): [topic, baseline, now] of the calls article. */
const SUMMON: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'calls',
      '## Во время звонка',
      '## Позвать ученика\n\nЕсли урок уже идёт, а ученика в звонке нет, на главной странице в строке урока появится «… ещё не в звонке» и кнопка «Позвать» (у группы — «Позвать остальных»). Ученик получит уведомление в кабинет и мессенджеры с кнопкой входа в звонок. Позвать одного ученика можно раз в три минуты. Если уроки идут по внешней ссылке, кнопки нет: портал не знает, кто в звонке.\n\n## Во время звонка',
    ],
  ],
  'teacher.en': [
    [
      'calls',
      '## Call controls',
      '## Call in a student\n\nIf a lesson has started and a student hasn’t joined the call, their lesson row on the home page shows “… hasn’t joined the call yet” with “Call in” (“Call in the rest” for a group). The student gets a notification in their account and messengers with a button to join. You can call in the same student once every three minutes. Lessons with an external link have no button, as the portal can’t tell who is in the call.\n\n## Call controls',
    ],
  ],
};

/** Who waits in the call (450.1): [topic, baseline, now] of the calls and lesson articles. */
const CALL_PRESENCE: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'calls',
      'Позвать одного ученика можно раз в три минуты. Если уроки',
      'Позвать одного ученика можно раз в три минуты. Когда ученик войдёт, строка сменится на «… ждёт в звонке» (у группы — «Все ждут в звонке»), а кнопка исчезнет; когда войдёте и вы, строка пропадёт. Если уроки',
    ],
  ],
  'teacher.en': [
    [
      'calls',
      'student once every three minutes. Lessons with',
      'student once every three minutes. Once they join, the row says “… is waiting in the call” (“Everyone is waiting in the call” for a group) and the button goes; when you join too, the line disappears. Lessons with',
    ],
  ],
  'student.ru': [
    [
      'lesson',
      'сколько осталось. Перенести',
      'сколько осталось. Если учитель уже в звонке портала, на карточке появится «Учитель ждёт в звонке». Перенести',
    ],
  ],
  'student.en': [
    [
      'lesson',
      'during the lesson, it shows the time remaining. Once',
      'during the lesson, it shows the time remaining. If your teacher is already in the portal call, the card says “Your teacher is waiting in the call”. Once',
    ],
  ],
};

/** Google Calendar setup in a dialog (437.1): [topic, baseline, now] of the calendars article. */
const CALENDAR_SETUP: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'calendars',
      '«Настройки» → «Занятия» → «Google Календарь» → подключите аккаунт. Тогда:',
      '«Настройки» → «Занятия» → «Google Календарь» → «Подключить Google». В первый раз откроется окно с шагами в Google Cloud: выполните их, вставьте Client ID и Client secret и сохраните. Затем снова нажмите «Подключить Google» и разрешите доступ. Тогда:',
    ],
  ],
  'teacher.en': [
    [
      'calendars',
      'Open “Settings” → “Lessons” → “Google Calendar” and connect your account.',
      'Open “Settings” → “Lessons” → “Google Calendar” and click “Connect Google”. The first time, a window shows the Google Cloud steps: follow them, paste the Client ID and Client secret, and save. Then click “Connect Google” again and allow access.',
    ],
  ],
};

/** «Написать всем» left the Students page for «Создать» (448.11): [topic, baseline, now] of the notifications article. */
const WRITE_ALL: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'notifications',
      '«Написать всем» на странице «Ученики», «Создать» → «Сообщение» на любой странице',
      '«Создать» → «Сообщение» на любой странице',
    ],
  ],
  'teacher.en': [
    [
      'notifications',
      'Choose “Message all” on the Students page, “Create” → “Message”,',
      'Choose “Create” → “Message” on any page,',
    ],
  ],
};

/** The current lesson across the top of Today (448.10): [topic, baseline, now] of the first-steps article. */
const HERO_ROW: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'first-steps',
      'После окончания раскроется следующее. Если',
      'После окончания раскроется следующее. На широком экране оно стоит отдельной яркой карточкой во всю ширину над остальными. Если',
    ],
  ],
  'teacher.en': [
    [
      'first-steps',
      'When it ends, the next lesson expands. With',
      'When it ends, the next lesson expands. On a wide screen it sits in its own bright card across the top. With',
    ],
  ],
};

/** Parents on the student card (453.1, ADR-0069). */
const PARENTS: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'students',
      '«Новое приглашение» или «Сбросить пароль».',
      '«Новое приглашение» или «Сбросить пароль». Между видеовстречей и входом — карточка **«Родители»** (см. ниже).',
    ],
    [
      'students',
      '## Теги учеников',
      '## Родители\n\nУ ученика может быть до двух родителей. Родитель входит в портал со своим логином и видит всё, что видит ребёнок, — расписание, задания с ответами и комментариями, оплаты, — но ничего не меняет.\n\n1. Откройте карточку ученика → «Профиль» → «Родители» → **Пригласить родителя**.\n2. **Нового** — впишите имя и нажмите «Пригласить»: портал покажет ссылку-приглашение, отправьте её родителю. По ссылке родитель увидит имена детей, придумает логин и пароль.\n3. **Уже в портале** — родитель другого ученика, например брата или сестры: выберите его и нажмите «Привязать». Ссылка не нужна.\n\nВ строке родителя видно «Приглашение до …» или «Входит как …». Кнопка со ссылкой выдаёт новое приглашение или сбрасывает пароль. **Отвязать** убирает родителя у этого ученика; если других детей у него нет, его вход отключается.\n\nПока у ученика есть родитель, в той же карточке есть переключатель **«Оплаты видит только родитель»**. Включите его, если платит родитель: ученик не увидит баланс и историю оплат и не получит напоминаний о долге. Ученик видит в «Моём аккаунте», кто его родители.\n\n## Теги учеников',
    ],
  ],
  'teacher.en': [
    [
      'students',
      'video meeting changes apply immediately. “Portal access”',
      'video meeting changes apply immediately. “Parents” lists the student’s parents (see below). “Portal access”',
    ],
    [
      'students',
      '## Student tags',
      '## Parents\n\nA student can have up to two parents. A parent signs in with their own username and sees what the child sees: lessons, homework with answers and comments, and payments. They cannot change anything.\n\n1. Open the student’s Profile tab → “Parents” → **Invite a parent**.\n2. **Someone new**: enter their name and choose “Invite”. Copy the invitation link and send it to the parent. The invitation names their children; the parent chooses a username and password.\n3. **Already on the portal**: pick a parent of another student, such as a brother or sister, and choose “Link”. No link is needed.\n\nEach parent’s entry shows when their invitation expires or the username they sign in with. The link button issues a new invitation or a password reset. **Unlink** removes the parent from this student; if they have no other children on the portal, their account is deactivated.\n\nWhile the student has a parent, the same card has the **Only parents see payments** switch. Turn it on if the parent pays: the student will no longer see their balance, payment history or debt reminders. Students can see who their parents are in “My account”.\n\n## Student tags',
    ],
  ],
};

/** Parents in the student's schedule and payments articles (455.1): [topic, baseline, now] per edition. */
const PARENT_NOTES: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'student.ru': [
    [
      'schedule',
      'даже если оно повторяется каждую неделю.',
      'даже если оно повторяется каждую неделю.\n\nЗапрос мог отправить и ваш родитель: тогда у него пометка «Запрос родителя (Имя)». Отозвать его можно так же, как свой, а ответ учителя придёт вам обоим.',
    ],
    [
      'billing',
      '«Оплаты» показывает сводку вверху и историю ниже.',
      '«Оплаты» показывает сводку вверху и историю ниже. Если учитель скрыл оплаты (их тогда видит родитель), раздела «Оплаты» в кабинете нет.',
    ],
  ],
  'student.en': [
    [
      'schedule',
      'applies only to the date you selected.',
      'applies only to the date you selected.\n\nYour parent may have sent a request too: it is marked “Parent’s request (Name)”. You can withdraw it just like your own, and your teacher’s reply goes to you both.',
    ],
    [
      'billing',
      '“Payments” shows your balance, lesson price and transaction history.',
      '“Payments” shows your balance, lesson price and transaction history. If your teacher has hidden payments (a parent sees them instead), there is no “Payments” section.',
    ],
  ],
};

/** Parents' requests, notifications and bot menu (454.3): [topic, baseline, now] per edition. */
const PARENT_REQUESTS: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'students',
      'оплаты, — но ничего не меняет.',
      'оплаты, — и получает уведомления ребёнка (что именно — выбирает сам). Сдать задание за ребёнка он не может, а попросить перенести или отменить занятие — может.',
    ],
    [
      'schedule',
      'Ученик может попросить отменить или перенести занятие — в личном кабинете или через бота. Запрос',
      'Ученик или его родитель может попросить отменить или перенести занятие — в личном кабинете или через бота; запрос родителя помечен «от родителя» с его именем, а ваш ответ получат и ученик, и родитель. Запрос',
    ],
    [
      'bot',
      '## Как пользоваться',
      '## Для родителей\n\nРасписание детей, баланс каждого ребёнка, перенос и отмена занятия ребёнка — если детей несколько, бот спросит, для кого.\n\n## Как пользоваться',
    ],
  ],
  'teacher.en': [
    [
      'students',
      'and payments. They cannot change anything.',
      'and payments, and gets the child’s notifications (choosing which ones). They cannot hand in work, but they can request a reschedule or cancellation.',
    ],
    [
      'schedule',
      'Students can request a reschedule or cancellation in the portal or bot. Requests',
      'Students and their parents can request a reschedule or cancellation in the portal or bot. A parent’s request is marked “from a parent” with their name, and both the student and the parent get your reply. Requests',
    ],
    [
      'bot',
      '## Using the bot',
      '## Parent actions\n\nParents can view their children’s schedules and balances, and request a reschedule or cancellation for a child. If they have more than one child, the bot asks which one.\n\n## Using the bot',
    ],
  ],
};

/** The lesson heroes show the elapsed bar and an action row (457.1): [topic, baseline, now]. */
const HERO_BAR: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'first-steps',
      'над остальными. Если',
      'над остальными: во время урока на ней полоса прошедшего времени, внизу — доска, «Позвать» и кнопка входа. Если',
    ],
  ],
  'teacher.en': [
    [
      'first-steps',
      'across the top. With',
      'across the top: during the lesson it shows a bar of the time passed, and below are the board, “Call in” and the join button. With',
    ],
  ],
  'student.ru': [
    ['lesson', 'сколько осталось. Если', 'сколько осталось и полосу прошедшего времени. Если'],
  ],
  'student.en': [
    [
      'lesson',
      'it shows the time remaining. If',
      'it shows the time remaining and a bar of the time passed. If',
    ],
  ],
};

/** Automatic YouTube captions of a new link (459.2): [topic, baseline, now] of the homework article. */
const AUTO_CAPTIONS: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'homework',
      '«Настроить» открывает окно видео поверх редактора (на телефоне — во весь экран): название, «Субтитры YouTube» (если субтитров несколько — на разных языках, авторские и автоматические, — выберите нужные',
      'Для ссылки YouTube портал сразу берёт субтитры на языке ролика (авторские, иначе автоматические) — под плиткой появится «Субтитры: английский, автоматические · Сменить язык». «Сменить язык» открывает меню дорожек; расшифровку, которую вы правили, портал заменит только после вопроса, а готовую никогда не перезапрашивает. Если субтитров нет или их не удалось получить, под плиткой будет «У видео нет субтитров» или «Не удалось получить субтитры · Повторить». «Настроить» открывает окно видео поверх редактора (на телефоне — во весь экран): название, «Субтитры YouTube» (выбрать дорожку',
    ],
  ],
  'teacher.en': [
    [
      'homework',
      'Select the settings button on a tile to open the video in a window over the editor (full screen on a phone). There you can rename the video, import YouTube captions (if several tracks are available, choose one',
      'For a YouTube link, the portal imports the captions in the video’s language straight away (the creator’s, otherwise auto-generated ones), and the tile shows “Captions: English, auto-generated · Change language”. “Change language” lists the tracks; if you have edited the transcript, the portal asks before replacing it, and it never re-imports an existing transcript. If there are no captions or they can’t be fetched, the tile says “This video has no captions” or “Couldn’t get the captions · Retry”. Select the settings button on a tile to open the video in a window over the editor (full screen on a phone). There you can rename the video, import YouTube captions (choose a track',
    ],
  ],
};

/** Courses (460.2): [topic, baseline, now] of the textbooks, students, groups and homework articles. */
const COURSES: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'textbooks',
      '3. Выберите вид — «Учебник», «Рабочая тетрадь» или «Другое» — и курс (например, «Английский, 5 класс»): курсы других учебников портал подскажет.',
      '3. Выберите вид — «Учебник», «Рабочая тетрадь» или «Другое» — и **Курс** из списка (или «Без курса»). Курсы заводятся в окне «Курсы» (см. ниже).',
    ],
    [
      'textbooks',
      '5. В общем поле «Ученики и группы» найдите и отметьте тех, кому открыт учебник. Метки можно убрать крестиком, весь выбор — очистить. Учебник группы видят все её ученики.',
      '5. В общем поле «Ученики и группы» найдите и отметьте тех, кому открыт учебник. Метки можно убрать крестиком, весь выбор — очистить. Учебник группы видят все её ученики. Пункт **«Ученики курса»** открывает учебник всем, чей текущий курс — этот, и участникам групп с этим курсом; новый ученик курса увидит учебник сразу. Сам курс учебник никому не открывает.\n\n## Курсы\n\nКурс — программа вроде «Английский A2» или «ОГЭ математика». Им отмечают учебники, задания, учеников и группы. В «Материалах» под строкой поиска — чипы курсов «Все · <курсы> · Без курса»: они отбирают учебники, выбранный курс остаётся в адресе страницы. «⋮» рядом с чипами → **Курсы** (пока курсов нет — кнопка «Курсы»):\n\n- впишите название и нажмите «Добавить» — курс встанет в конец списка;\n- ✎ — переименовать (Enter сохраняет, Esc отменяет);\n- перетащите курс за ручку (или стрелками ↑ ↓ на ней) — в этом порядке идут чипы и списки;\n- 🗑 — удалить после подтверждения: учебники, задания, ученики и группы останутся, но без курса, а учебники «Ученикам курса» для них закроются.\n\nТекущий курс ученика или группы выбирается в их карточке: «Профиль» → «Курс» ([Ученики и приглашения](/teacher/help/students)).',
    ],
    [
      'textbooks',
      'Каждый учебник — карточка: сверху обложка (первая страница PDF или сама картинка; у файла Word обложки нет — там значок формата), под ней название, вид, курс и кому открыт. Фильтры — «Все», «Учебники», «Рабочие тетради», «Другое», поиск находит учебник по названию. Нажмите на название, чтобы открыть учебник в новой вкладке (PDF и картинки открываются в браузере, файл Word скачивается). В меню «⋮» карточки:',
      'Каждый учебник — карточка: сверху обложка (первая страница PDF или сама картинка; у файла Word обложки нет — там значок формата), под ней название, вид, курс и кому открыт. Фильтры — «Все», «Учебники», «Рабочие тетради», «Другое» и чипы курсов, поиск находит учебник по названию и курсу. Нажмите на название, чтобы открыть учебник в новой вкладке (PDF и картинки открываются в браузере, файл Word скачивается). В меню «⋮» карточки:',
    ],
    [
      'textbooks',
      '- **Изменить** — вид, название, курс, страницы Word, учеников и группы;',
      '- **Изменить** — вид, название, курс, страницы Word, учеников, группы и «Учеников курса»;',
    ],
    [
      'students',
      'Вкладка **Профиль** — всё, что вы знаете об ученике, меняется прямо на ней. «Данные ученика»: имя, почта, телефон, заметка (видна только вам), тема по умолчанию и цвет — поменяйте поля и нажмите «Сохранить» под ними («Отмена» вернёт сохранённое). Ниже — цена занятия (своя «Сохранить»), **видеовстреча** (действия в ней сохраняются сразу, [Видеовстречи](/teacher/help/meetings)) и «Вход в кабинет»: логин (его ученик выбирает сам, поэтому он только для просмотра), до какого дня действует ссылка и кнопка новой ссылки — «Новое приглашение» или «Сбросить пароль». Между видеовстречей и входом — карточка **«Родители»** (см. ниже).',
      'Вкладка **Профиль** — всё, что вы знаете об ученике, меняется прямо на ней. «Данные ученика»: имя, почта, телефон, заметка (видна только вам), тема по умолчанию и цвет — поменяйте поля и нажмите «Сохранить» под ними («Отмена» вернёт сохранённое). Ниже — **Курс** (текущий курс ученика, сохраняется сразу после выбора, [Учебники](/teacher/help/textbooks); он же — чип в шапке карточки), цена занятия (своя «Сохранить»), **видеовстреча** (действия в ней сохраняются сразу, [Видеовстречи](/teacher/help/meetings)) и «Вход в кабинет»: логин (его ученик выбирает сам, поэтому он только для просмотра), до какого дня действует ссылка и кнопка новой ссылки — «Новое приглашение» или «Сбросить пароль». Между видеовстречей и входом — карточка **«Родители»** (см. ниже).',
    ],
    [
      'groups',
      '2. Впишите название, отметьте учеников и нажмите «Создать».',
      '2. Впишите название, отметьте учеников, при желании выберите **Курс** и нажмите «Создать».',
    ],
    [
      'groups',
      '- **Профиль** — название, тема по умолчанию и цвет («Сохранить» под полями), цена занятия для каждого участника и видеовстреча.',
      '- **Профиль** — название, тема по умолчанию и цвет («Сохранить» под полями), **курс** группы (сохраняется сразу, виден чипом в шапке; участникам открыты учебники «Ученикам курса»), цена занятия для каждого участника и видеовстреча.',
    ],
    [
      'homework',
      '3. В «Кому» добавьте учеников и группы. Ученик из нескольких групп получит задание один раз. Если снять группу, личный выбор ученика сохранится. «К следующему занятию» ставит срок на начало ближайшего занятия этих учеников — выберите другой срок, если нужно.',
      '3. В «Кому» добавьте учеников и группы. Ученик из нескольких групп получит задание один раз. Если снять группу, личный выбор ученика сохранится. «К следующему занятию» ставит срок на начало ближайшего занятия этих учеников — выберите другой срок, если нужно. Под «Кому» — **Курс** задания (виден, когда в «Материалах» заведены курсы, [Учебники](/teacher/help/textbooks)); он сохраняется вместе с заданием.',
    ],
  ],
  'teacher.en': [
    [
      'textbooks',
      '3. Choose Textbook, Workbook or Other, and optionally enter a course. Existing course names are suggested.',
      '3. Choose Textbook, Workbook or Other, and pick a **Course** from the list, or “No course”. Courses are managed in the Courses dialog (see below).',
    ],
    [
      'textbooks',
      '5. Select students and groups to share it with. Remove a chip to deselect a recipient, or clear the selection. Group sharing includes all current members.',
      '5. Select students and groups to share it with. Remove a chip to deselect a recipient, or clear the selection. Group sharing includes all current members. Choose **Students of a course** to share it with everyone whose current course it is and with the members of groups on that course; a student who joins the course sees it straight away. Setting the textbook’s course alone shares it with nobody.\n\n## Courses\n\nA course is a programme such as “English A2” or “GCSE Maths”. Textbooks, assignments, students and groups can be marked with one. Below the search field in Materials, the course chips “All · <courses> · No course” filter the textbooks; the chosen course stays in the page address. Choose ⋮ next to the chips → **Courses** (or the Courses button while there are none) to:\n\n- add a course: type its name and choose “Add”; it goes to the end of the list;\n- rename it with ✎ (Enter saves, Esc cancels);\n- drag it by its handle, or use ↑ and ↓ on the handle, to set the order of the chips and lists;\n- delete it after confirming: its textbooks, assignments, students and groups stay without a course, and textbooks shared with its students close to them.\n\nSet a student’s or a group’s current course on their Profile tab → “Course” ([Students and invitations](/teacher/help/students)).',
    ],
    [
      'textbooks',
      'Search by title and select a resource to open it. PDFs and images open in the browser; Word files download. The ⋮ menu provides:',
      'Search by title or course, filter by course and select a resource to open it. PDFs and images open in the browser; Word files download. The ⋮ menu provides:',
    ],
    [
      'textbooks',
      '- **Edit:** change its type, title, course, Word page count and sharing.',
      '- **Edit:** change its type, title, course, Word page count and sharing, including students of a course.',
    ],
    [
      'students',
      '- **Profile:** name, email, phone, private note, default topic and colour. Save these fields together. The lesson price has its own Save button; video meeting changes apply immediately. “Parents” lists the student’s parents (see below). “Portal access” shows the read-only username and invitation or reset link details.',
      '- **Profile:** name, email, phone, private note, default topic and colour. Save these fields together. **Course** is the student’s current course: it saves as soon as you choose it and appears as a chip in the card header (see [Textbooks](/teacher/help/textbooks)). The lesson price has its own Save button; video meeting changes apply immediately. “Parents” lists the student’s parents (see below). “Portal access” shows the read-only username and invitation or reset link details.',
    ],
    [
      'groups',
      '2. Enter a name, select the students and choose “Create”.',
      '2. Enter a name, select the students, optionally choose a **Course**, and choose “Create”.',
    ],
    [
      'groups',
      '- **Profile:** name, default topic, colour, price per member and video meeting link.',
      '- **Profile:** name, default topic, colour, the group’s **course** (saved as soon as you choose it and shown as a chip in the header; members see textbooks shared with students of the course), price per member and video meeting link.',
    ],
    [
      'homework',
      '3. Under “To”, add students and groups. Students in more than one selected group receive the assignment once. Removing a group keeps any students also selected individually. “By the next lesson” sets the due date to the start of those students’ next lesson; pick another option if you prefer.',
      '3. Under “To”, add students and groups. Students in more than one selected group receive the assignment once. Removing a group keeps any students also selected individually. “By the next lesson” sets the due date to the start of those students’ next lesson; pick another option if you prefer. Below “To”, choose the assignment’s **Course** (shown once you have courses in Materials, see [Textbooks](/teacher/help/textbooks)); it is saved with the assignment.',
    ],
  ],
};

/** Lesson plans and their bank (461.3): [topic, baseline, now] of the textbooks article. */
const PLANS: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'textbooks',
      'Ученик видит открытые ему учебники в своём разделе «Материалы» и может их скачать.',
      'Ученик видит открытые ему учебники в своём разделе «Материалы» и может их скачать.\n\n## Планы уроков\n\nВкладка **«Планы»** «Материалов» — банк планов уроков: оригиналы, из которых урок получает свою копию. На карточке — название, курс и «Использовано N раз» (сколько уроков взяли копию). Чипы курсов и поиск работают и здесь.\n\n1. «Новый план» — откроется редактор плана: название, **Курс**, текст плана (Markdown, переключатель «Текст · Просмотр»).\n2. **Учебники** — «Добавить учебник», выберите учебник и страницы (пусто — весь учебник). Если у плана есть курс, предлагаются только учебники этого курса. ✎ меняет страницы, ✕ убирает учебник; до 20 учебников.\n3. **Видео** — вставьте ссылку (до 5 видео). У видео YouTube расшифровка подставится сама, на языке видео; «Сменить язык» выбирает другие субтитры. Ученик видит расшифровку, только если включено «Показывать расшифровку ученику».\n4. План сохраняется сам через секунду-другую после каждой правки («сохранено · ЧЧ:ММ»). **«Готово»** сохраняет остальное и возвращает в «Материалы».\n\nВ меню «⋮» карточки: **Изменить** — открыть редактор; **Удалить…** — убрать план из банка после подтверждения (планы уроков, сделанные из него, останутся). Правка оригинала в банке не меняет копии на уроках.\n\nПлан, составленный для урока, попадает в банк сам при первом «Готово». В его редакторе в «⋮» — **«Сохранить в банк»** (оригинала ещё нет) или **«Обновить в банке»** (оригинал заменится этим планом, портал спросит подтверждение).',
    ],
  ],
  'teacher.en': [
    [
      'textbooks',
      'Students find shared resources under Materials and can download them. For assignment-specific page access, see [Homework](/teacher/help/homework).',
      'Students find shared resources under Materials and can download them. For assignment-specific page access, see [Homework](/teacher/help/homework).\n\n## Lesson plans\n\nThe **Plans** tab of Materials is the bank of lesson plans: the originals a lesson takes its own copy from. Each card shows the title, the course and how many times it was used. The course chips and the search work here too.\n\n1. Choose “New plan” to open the plan editor: a title, a **Course** and the plan text (Markdown, with “Text · Preview”).\n2. **Textbooks**: choose “Attach a textbook”, then the textbook and its pages (leave blank for the whole textbook). When the plan has a course, only that course’s textbooks are offered. ✎ changes the pages, ✕ removes the textbook; up to 20 textbooks.\n3. **Videos**: paste a link (up to 5 videos). A YouTube video gets its transcript automatically, in the video’s language; “Change language” picks other captions. Students see a transcript only when “Show transcript to students” is on.\n4. The plan saves itself a moment after each change (“saved · HH:MM”). **Done** saves the rest and takes you back to Materials.\n\nThe card’s “⋮” menu has **Edit**, which opens the editor, and **Delete…**, which removes the plan from the bank after you confirm (lesson plans made from it stay). Editing a bank original does not change the copies on lessons.\n\nA plan written for a lesson goes into the bank automatically the first time you choose Done. Its editor’s “⋮” menu has **Save to bank** (no original yet) or **Update in bank** (the original is replaced with this plan after you confirm).',
    ],
  ],
};

/** The lesson plan in the lesson card (461.4): [topic, baseline, now] of the schedule and textbooks articles. */
const LESSON_PLAN: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'schedule',
      '## Итоги урока',
      '## План урока\n\nВ карточке занятия — раздел «План урока». Пока плана нет, нажмите **«Составить»** — откроется редактор плана этого урока; курс подставится из курса ученика или группы. План сохраняется сам и сразу привязывается к уроку; «Готово» возвращает в расписание. **«Из банка»** — выберите план из банка и нажмите «Взять»: урок получит свою копию, оригинал в банке не изменится. У отменённого занятия нового плана не бывает.\n\nКогда план есть, в карточке видны его название, страницы учебников и видео. «Открыть» — редактор плана урока; «⋮» → **«Убрать из урока»** после подтверждения убирает план и удаляет копию этого урока (оригинал в банке остаётся). Ученики занятия и их родители видят план в своей карточке занятия: текст, страницы учебников и видео; расшифровку — только если вы её показываете. Подробнее о планах — в статье «Учебники».\n\n## Итоги урока',
    ],
    [
      'textbooks',
      'План, составленный для урока, попадает в банк сам при первом «Готово».',
      'План урока составляют из карточки занятия («Составить» или «Из банка», см. «Расписание и запросы»). План, составленный для урока, попадает в банк сам при первом «Готово».',
    ],
  ],
  'teacher.en': [
    [
      'schedule',
      '## Share a lesson summary',
      '## Lesson plan\n\nA lesson’s details have a Lesson plan section. With no plan yet, choose **Write** to open the editor of this lesson’s plan; the course is filled in from the student’s or group’s course. The plan saves itself and is attached to the lesson straight away; Done takes you back to the schedule. Choose **From bank**, pick a plan and choose Use: the lesson gets its own copy and the bank original stays as it is. A cancelled lesson cannot take a new plan.\n\nOnce a lesson has a plan, its details show the title, the textbook pages and the videos. Open takes you to the plan editor. In the “⋮” menu, **Remove from lesson** removes the plan after you confirm and deletes this lesson’s copy; the bank original stays. Students in the lesson and their parents see the plan in their lesson details: the text, the textbook pages and the videos, with a transcript only when you show it. See Textbooks for more about plans.\n\n## Share a lesson summary',
    ],
    [
      'textbooks',
      'A plan written for a lesson goes into the bank automatically the first time you choose Done.',
      'Lesson plans are made from a lesson’s details (Write or From bank; see Schedule and requests). A plan written for a lesson goes into the bank automatically the first time you choose Done.',
    ],
  ],
  'student.ru': [
    [
      'schedule',
      '## Групповые занятия',
      '## План урока\n\nЕсли учитель подготовил план занятия, он виден в карточке занятия в разделе «План урока»: текст плана, страницы учебников (их можно открыть или скачать) и видео с плеером. Расшифровку видео видно, только если учитель её показывает.\n\n## Групповые занятия',
    ],
  ],
  'student.en': [
    [
      'schedule',
      '## Group lessons',
      '## Lesson plan\n\nIf your teacher has prepared a plan for a lesson, you’ll find it in the lesson details under Lesson plan: the plan text, the textbook pages (open or download them) and the videos with a player. A video transcript appears only when your teacher shows it.\n\n## Group lessons',
    ],
  ],
};

/** Homework at lessons and the bank of assignments (462.2): [topic, baseline, now] of the schedule and homework articles. */
const LESSON_HOMEWORK: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'teacher.ru': [
    [
      'schedule',
      '## Итоги урока\n\nИтоги начавшегося',
      '## Домашнее задание к уроку\n\nВ карточке занятия под планом — раздел «Домашнее задание»: привязанные к уроку задания с их состоянием («Не выдано», «Выдано», «На проверке»). **«Задать»** открывает редактор задания для этого урока: ученики занятия уже выбраны, курс взят из плана (или из курса ученика или группы), страницы учебников и видео плана уже добавлены — уберите лишнее, срок — к следующему занятию. Задание привязывается к уроку при первом сохранении. **«Привязать»** — выберите недавнее задание учеников занятия, которое ещё не привязано ни к одному уроку, или задание из банка: из банка ученикам занятия создаётся черновик-копия, его можно открыть, поправить и выдать. «⋮» → **«Отвязать»** убирает задание из урока, само задание остаётся. У отменённого занятия новых заданий не бывает.\n\n## Итоги урока\n\nИтоги начавшегося',
    ],
    [
      'schedule',
      'прошли» по теме, заданиям и вашим словам',
      'прошли» по теме, заданиям, привязанным к уроку, и вашим словам',
    ],
    [
      'homework',
      '## Удалить задание\n',
      '## Банк заданий\n\nБанк — оригиналы заданий для повторного использования, вкладка «Задания» в «Материалах» (с фильтром по курсу). Задание попадает в банк само, когда вы впервые его выдаёте; задание, взятое из банка, новых оригиналов не добавляет. В «⋮» редактора — **«Сохранить в банк»**, а если оригинал уже есть — **«Обновить в банке»**: после подтверждения оригинал заменится этим заданием, уже выданные копии не изменятся. «Новое задание» в «Материалах» сразу создаёт задание банка: у него нет учеников и срока, «Готово» возвращает в «Материалы». На карточке — «Использовано N раз»; «⋮» → «Изменить», «Удалить…» (задания учеников, сделанные из оригинала, останутся). Взять задание из банка для урока — «Привязать» в карточке занятия (см. «Расписание и запросы»).\n\n## Удалить задание\n',
    ],
  ],
  'teacher.en': [
    [
      'schedule',
      '## Share a lesson summary',
      '## Lesson homework\n\nBelow the plan, a lesson’s details have a Homework section listing the assignments linked to the lesson and their status (Not set, Set, To review). **Set** opens the assignment editor for this lesson: the lesson’s students are already chosen, the course comes from the plan (or from the student’s or group’s course), the plan’s textbook pages and videos are already added — remove what you don’t need — and the due date is the next lesson. The assignment is linked to the lesson when it is first saved. **Link** lets you pick a recent assignment of the lesson’s students that isn’t linked to any lesson yet, or an assignment from the bank: a bank assignment becomes a draft copy for the lesson’s students, which you can open, edit and set. In the “⋮” menu, **Unlink** takes the assignment off the lesson; the assignment itself stays. A cancelled lesson cannot take new homework.\n\n## Share a lesson summary',
    ],
    [
      'schedule',
      'uses the lesson topic, assignments and your notes',
      'uses the lesson topic, the assignments linked to the lesson and your notes',
    ],
    [
      'homework',
      '## Add a quiz\n',
      '## Assignment bank\n\nThe bank keeps assignment originals for reuse, on the Assignments tab of Materials (with the course filter). An assignment goes into the bank automatically the first time you set it; one taken from the bank adds no new original. In the editor’s “⋮” menu, choose **Save to bank**, or **Update in bank** when an original exists: after you confirm, the original is replaced with this assignment, and copies already set stay as they are. New assignment in Materials creates a bank assignment straight away: it has no students or due date, and Done takes you back to Materials. Each card shows how many times it was used; its “⋮” menu has Edit and Delete… (students’ assignments made from it stay). To use a bank assignment for a lesson, choose Link in the lesson’s details (see Schedule and requests).\n\n## Add a quiz\n',
    ],
  ],
};

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
    const ru = name.endsWith('.ru');
    const motion = name.startsWith('admin.')
      ? ''
      : `${ru ? MOTION_RU : MOTION_EN}

`;
    const guidance = (ru ? LOADING_RU : LOADING_EN) + motion;
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
    const invite = INVITE[name];
    const login = original['login'];
    if (invite && isRecord(login) && typeof login['body'] === 'string') {
      expect(login['body']).toContain(invite[0]);
      expected['login'] = { ...login, body: login['body'].replace(...invite) };
    }
    const checklist = CHECKLIST[name];
    const first = original['first-steps'];
    if (checklist && isRecord(first) && typeof first['body'] === 'string') {
      expect(first['body']).toContain(checklist[0]);
      expected['first-steps'] = { ...first, body: first['body'].replace(...checklist) };
    }
    for (const [topic, before, after] of [
      ...(WORKING_HOURS[name] ?? []),
      ...(CALL_MODERATION[name] ?? []),
      ...(REVIEW_SHEET[name] ?? []),
      ...(PANE_HANDLE[name] ?? []),
      ...(DATE_TIME[name] ?? []),
      ...(TWO_CARDS[name] ?? []),
      ...(TAP_ROW[name] ?? []),
      ...(ONE_ROW[name] ?? []),
      ...(SUMMON[name] ?? []),
      ...(CALENDAR_SETUP[name] ?? []),
      ...(WRITE_ALL[name] ?? []),
      ...(HERO_ROW[name] ?? []),
      ...(CALL_PRESENCE[name] ?? []),
      ...(PARENTS[name] ?? []),
      ...(PARENT_REQUESTS[name] ?? []),
      ...(PARENT_NOTES[name] ?? []),
      ...(HERO_BAR[name] ?? []),
      ...(AUTO_CAPTIONS[name] ?? []),
      ...(COURSES[name] ?? []),
      ...(PLANS[name] ?? []),
      ...(LESSON_PLAN[name] ?? []),
      ...(LESSON_HOMEWORK[name] ?? []),
    ]) {
      // several reviews of one topic apply in turn
      const reviewed = expected[topic];
      if (isRecord(reviewed) && typeof reviewed['body'] === 'string') {
        expect(reviewed['body']).toContain(before);
        expected[topic] = { ...reviewed, body: reviewed['body'].replace(before, after) };
      }
    }
    expect(texts).toEqual(expected);
  });

  it('has the parent’s articles in both languages with links to existing articles (455.1)', () => {
    for (const texts of [GUARDIAN_RU, GUARDIAN_EN]) {
      expect(Object.keys(texts).sort()).toEqual([...GUARDIAN_TOPICS].sort());
      for (const text of Object.values(texts)) {
        expect(text.title).not.toBe('');
        for (const [, topic] of text.body.matchAll(/\]\(\/guardian\/help\/([\w-]+)\)/g)) {
          expect(GUARDIAN_TOPICS as readonly string[]).toContain(topic);
        }
      }
    }
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
