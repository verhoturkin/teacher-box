/**
 * Topics of the help (ADR: none — a part of the interface). Links to the help are typed with
 * {@link HelpTopic}, so a link to a missing article does not compile.
 */
export const TEACHER_TOPICS = [
  'first-steps',
  'setup',
  'students',
  'groups',
  'schedule',
  'calls',
  'meetings',
  'boards',
  'homework',
  'ai',
  'billing',
  'notifications',
  'bot',
  'calendars',
  'settings',
  'appearance',
  'backups',
  'faq',
] as const;
export const STUDENT_TOPICS = [
  'login',
  'schedule',
  'lesson',
  'homework',
  'billing',
  'bot',
  'appearance',
] as const;
export const ADMIN_TOPICS = ['diagnostics', 'backups', 'settings'] as const;

export type TeacherTopic = (typeof TEACHER_TOPICS)[number];
export type StudentTopic = (typeof STUDENT_TOPICS)[number];
export type AdminTopic = (typeof ADMIN_TOPICS)[number];

/** Areas of the portal with their own help: the teacher, the student's cabinet, the administrator. */
export type HelpArea = 'teacher' | 'cabinet' | 'admin';

/** An article: its area and topic, e.g. `teacher/schedule`. */
export type HelpTopic =
  `teacher/${TeacherTopic}` | `cabinet/${StudentTopic}` | `admin/${AdminTopic}`;

/** The topics of an area in the order of the contents. */
export const HELP_TOPICS: Readonly<Record<HelpArea, readonly string[]>> = {
  teacher: TEACHER_TOPICS,
  cabinet: STUDENT_TOPICS,
  admin: ADMIN_TOPICS,
};

export function isHelpArea(value: unknown): value is HelpArea {
  return value === 'teacher' || value === 'cabinet' || value === 'admin';
}

/** `teacher/schedule` → `/teacher/help/schedule`. */
export function helpUrl(topic: HelpTopic): string {
  const [area, id] = topic.split('/');
  return `/${area ?? ''}/help/${id ?? ''}`;
}

/**
 * The titles of the articles: the name of a «?» is «Справка: <title>», so that the buttons of a
 * page are told apart (WCAG 2.4.6). A test keeps them equal to the titles of the articles.
 */
export const HELP_TITLES: Readonly<Record<HelpTopic, string>> = {
  'teacher/first-steps': 'Первые шаги',
  'teacher/setup': 'Первоначальная настройка',
  'teacher/students': 'Ученики и приглашения',
  'teacher/groups': 'Группы',
  'teacher/schedule': 'Расписание и запросы',
  'teacher/calls': 'Звонки',
  'teacher/meetings': 'Видеовстречи',
  'teacher/boards': 'Доски',
  'teacher/homework': 'Домашние задания',
  'teacher/ai': 'ИИ-помощник',
  'teacher/billing': 'Оплаты',
  'teacher/notifications': 'Уведомления и боты',
  'teacher/bot': 'Что умеет бот',
  'teacher/calendars': 'Календари',
  'teacher/settings': 'Настройки',
  'teacher/appearance': 'Оформление и телефон',
  'teacher/backups': 'Резервные копии и полный сброс',
  'teacher/faq': 'Частые вопросы',
  'cabinet/login': 'Вход и пароль',
  'cabinet/schedule': 'Расписание и перенос',
  'cabinet/lesson': 'Урок и доска',
  'cabinet/homework': 'Задания',
  'cabinet/billing': 'Оплаты',
  'cabinet/bot': 'Бот в мессенджере',
  'cabinet/appearance': 'Телефон и тема',
  'admin/diagnostics': 'Журнал и диагностика',
  'admin/backups': 'Резервные копии и адрес портала',
  'admin/settings': 'Настройки портала',
};
