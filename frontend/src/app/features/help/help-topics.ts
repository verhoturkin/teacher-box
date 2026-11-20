import { T } from './i18n/texts';

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
  'textbooks',
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
  'textbooks',
  'billing',
  'bot',
  'appearance',
] as const;
export const GUARDIAN_TOPICS = ['start', 'view', 'requests', 'notifications', 'bot'] as const;
export const ADMIN_TOPICS = ['diagnostics', 'backups', 'settings'] as const;

export type TeacherTopic = (typeof TEACHER_TOPICS)[number];
export type StudentTopic = (typeof STUDENT_TOPICS)[number];
export type GuardianTopic = (typeof GUARDIAN_TOPICS)[number];
export type AdminTopic = (typeof ADMIN_TOPICS)[number];

/** Areas of the portal with their own help: the teacher, the student's cabinet, the parent's family cabinet, the administrator. */
export type HelpArea = 'teacher' | 'cabinet' | 'guardian' | 'admin';

/** An article: its area and topic, e.g. `teacher/schedule`. */
export type HelpTopic =
  | `teacher/${TeacherTopic}`
  | `cabinet/${StudentTopic}`
  | `guardian/${GuardianTopic}`
  | `admin/${AdminTopic}`;

/** The topics of an area in the order of the contents. */
export const HELP_TOPICS: Readonly<Record<HelpArea, readonly string[]>> = {
  teacher: TEACHER_TOPICS,
  cabinet: STUDENT_TOPICS,
  guardian: GUARDIAN_TOPICS,
  admin: ADMIN_TOPICS,
};

export function isHelpArea(value: unknown): value is HelpArea {
  return value === 'teacher' || value === 'cabinet' || value === 'guardian' || value === 'admin';
}

/** `teacher/schedule` → `/teacher/help/schedule`. */
export function helpUrl(topic: HelpTopic): string {
  const [area, id] = topic.split('/');
  return `/${area ?? ''}/help/${id ?? ''}`;
}

/**
 * The parent's article for a «?» of the student's page shown in the family cabinet: the login and
 * account → «Вход и дети», the schedule → «Перенос и отмена», the rest → «Что видно родителю».
 */
export function guardianTopicOf(topic: HelpTopic): HelpTopic {
  if (!topic.startsWith('cabinet/')) {
    return topic;
  }
  switch (topic) {
    case 'cabinet/login':
      return 'guardian/start';
    case 'cabinet/schedule':
      return 'guardian/requests';
    case 'cabinet/bot':
      return 'guardian/bot';
    default:
      return 'guardian/view';
  }
}

/** `/teacher/help/schedule` → `teacher/schedule`; `null` for any other link. */
export function helpTopicOf(href: string): string | null {
  const match = /^\/(teacher|cabinet|guardian|admin)\/help\/([\w-]+)$/.exec(href);
  const area = match?.[1];
  const id = match?.[2];
  return isHelpArea(area) && id !== undefined && HELP_TOPICS[area].includes(id)
    ? `${area}/${id}`
    : null;
}

/**
 * The titles of the articles: the name of a «?» is «Справка: <title>», so that the buttons of a
 * page are told apart (WCAG 2.4.6). A test keeps them equal to the titles of the articles.
 */
export const HELP_TITLES: Readonly<Record<HelpTopic, string>> = T.titles;
