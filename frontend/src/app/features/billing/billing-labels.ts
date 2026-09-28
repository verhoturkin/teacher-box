import { LessonStatus } from './data-access/billing.models';

export const LESSON_STATUS_LABELS: Readonly<Record<LessonStatus, string>> = {
  CONDUCTED: 'Проведено',
  MISSED: 'Пропуск (оплачивается)',
  CANCELLED: 'Отменено',
};
