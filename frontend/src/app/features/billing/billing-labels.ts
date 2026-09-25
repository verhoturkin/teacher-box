import { LessonStatus, PaymentMethod } from './data-access/billing.models';

export const LESSON_STATUS_LABELS: Readonly<Record<LessonStatus, string>> = {
  CONDUCTED: 'Проведено',
  MISSED: 'Пропуск (оплачивается)',
  CANCELLED: 'Отменено',
};

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  CASH: 'Наличные',
  CARD: 'Карта',
  TRANSFER: 'Перевод',
  OTHER: 'Другое',
};

export const PAYMENT_METHOD_OPTIONS: { readonly label: string; readonly value: PaymentMethod }[] = [
  { label: PAYMENT_METHOD_LABELS.TRANSFER, value: 'TRANSFER' },
  { label: PAYMENT_METHOD_LABELS.CASH, value: 'CASH' },
  { label: PAYMENT_METHOD_LABELS.CARD, value: 'CARD' },
  { label: PAYMENT_METHOD_LABELS.OTHER, value: 'OTHER' },
];

export const CHARGED_STATUS_OPTIONS: {
  readonly label: string;
  readonly value: Exclude<LessonStatus, 'CANCELLED'>;
}[] = [
  { label: 'Проведено', value: 'CONDUCTED' },
  { label: 'Пропуск', value: 'MISSED' },
];
