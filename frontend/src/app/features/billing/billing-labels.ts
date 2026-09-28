import { LessonStatus } from './data-access/billing.models';

export const LESSON_STATUS_LABELS: Readonly<Record<LessonStatus, string>> = {
  CONDUCTED: 'Проведено',
  MISSED: 'Пропуск (оплачивается)',
  CANCELLED: 'Отменено',
};

export const CHARGED_STATUS_OPTIONS: {
  readonly label: string;
  readonly value: Exclude<LessonStatus, 'CANCELLED'>;
}[] = [
  { label: 'Проведено', value: 'CONDUCTED' },
  { label: 'Пропуск', value: 'MISSED' },
];
