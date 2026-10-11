import type { Translation } from '@core/i18n/language';
import { countOf } from '@shared/text/plural';
import type { ru } from './ru';

export const en: Translation<typeof ru> = {
  features: {
    HOMEWORK_DRAFT: 'Assignment drafts',
    REVIEW_DRAFT: 'Review drafts',
  },
  openAiCompatible: 'OpenAI-compatible API',
  statuses: {
    SUCCEEDED: 'Done',
    FAILED: 'Error',
    REFUSED: 'Refused by the model',
  },
  usage: {
    title: 'AI assistant',
    notConfigured: 'The AI assistant is not set up',
    notConfiguredHint:
      'The portal administrator sets it up. Ask them to connect the AI assistant to get drafts of assignments and reviews.',
    model: 'Model',
    usageIn: (month: string) => `Usage in ${month}`,
    tokens: (used: string) => `Tokens: ${used}`,
    ofLimit: (limit: string) => `of ${limit}`,
    noLimit: '(no limit)',
    used: 'Tokens used this month',
    requestCount: (count: number) => countOf(count, 'request', 'requests', 'requests'),
    tokenCount: (count: number) => countOf(count, 'token', 'tokens', 'tokens'),
    recent: 'Recent requests',
    noRequests: 'No requests this month',
    when: 'When',
    what: 'What',
    result: 'Result',
    tokensColumn: 'Tokens',
    time: 'Time',
    seconds: (seconds: string) => `${seconds} s`,
  },
  draft: {
    title: 'Assignment draft by AI',
    topic: 'Topic',
    topicPlaceholder: 'e.g. adding fractions',
    level: 'Student’s level',
    levelPlaceholder: 'e.g. grade 6, basic',
    count: 'Number of tasks',
    wishes: 'Wishes',
    wishesPlaceholder: 'format, types of tasks, what to focus on',
    hint: 'The draft replaces the title and the text of the assignment — you can edit them.',
    generate: 'Generate',
    failed: 'Could not get a draft. Try again',
  },
};
