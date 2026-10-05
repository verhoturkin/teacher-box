import { LessonStatus } from './data-access/billing.models';

/** Short: they are tags, a tag does not wrap and has to fit a table on a tablet. */
export const LESSON_STATUS_LABELS: Readonly<Record<LessonStatus, string>> = {
  CONDUCTED: 'Проведено',
  MISSED: 'Пропуск',
  CANCELLED: 'Отменено',
};

/** The hint of a status tag where its short label leaves something out. */
export const LESSON_STATUS_HINTS: Readonly<Partial<Record<LessonStatus, string>>> = {
  MISSED: 'Пропуск (оплачивается)',
};
