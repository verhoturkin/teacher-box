import { countOf } from '@shared/text/plural';

/** Texts of the AI assistant (ADR-0035). */
export const ru = {
  features: {
    HOMEWORK_DRAFT: 'Черновики заданий',
    REVIEW_DRAFT: 'Черновики проверки',
  },
  openAiCompatible: 'OpenAI-совместимый API',
  statuses: {
    SUCCEEDED: 'Готово',
    FAILED: 'Ошибка',
    REFUSED: 'Отказ модели',
  },
  usage: {
    title: 'ИИ-помощник',
    notConfigured: 'ИИ-помощник не настроен',
    notConfiguredHint:
      'Это настраивает администратор портала. Чтобы получать черновики заданий и проверок, попросите его подключить ИИ-помощника.',
    model: 'Модель',
    usageIn: (month: string) => `Использование за ${month}`,
    tokens: (used: string) => `Токенов: ${used}`,
    ofLimit: (limit: string) => `из ${limit}`,
    noLimit: '(без лимита)',
    used: 'Израсходовано токенов за месяц',
    requestCount: (count: number) => countOf(count, 'запрос', 'запроса', 'запросов'),
    tokenCount: (count: number) => countOf(count, 'токен', 'токена', 'токенов'),
    recent: 'Последние запросы',
    noRequests: 'Запросов в этом месяце не было',
    when: 'Когда',
    what: 'Что',
    result: 'Результат',
    tokensColumn: 'Токены',
    time: 'Время',
    seconds: (seconds: string) => `${seconds} с`,
  },
  draft: {
    title: 'Черновик задания с ИИ',
    topic: 'Тема',
    topicPlaceholder: 'например, сложение дробей',
    level: 'Уровень ученика',
    levelPlaceholder: 'например, 6 класс, базовый',
    count: 'Количество задач',
    wishes: 'Пожелания',
    wishesPlaceholder: 'формат, типы задач, на что обратить внимание',
    hint: 'Черновик заменит название и текст задания — вы сможете их отредактировать.',
    generate: 'Сгенерировать',
    failed: 'Не удалось получить черновик. Попробуйте ещё раз',
  },
};
