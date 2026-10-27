import type { Translation } from '@core/i18n/language';
import { countOf } from '@shared/text/plural';
import type { ru } from './ru';

export const en: Translation<typeof ru> = {
  common: {
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    retry: 'Retry',
    add: 'Add',
    create: 'Create',
    back: 'Back',
    clearSearch: 'Clear search',
    next: 'Next',
    done: 'Done',
    send: 'Send',
    open: 'Open',
    copy: 'Copy',
    copied: 'Copied',
    yes: 'Yes',
    no: 'No',
    loading: 'Loading…',
    actions: 'Actions',
    moreCount: (count: number) => `${String(count)} more`,
    student: 'Student',
    group: 'Group',
    date: 'Date',
    status: 'Status',
    comment: 'Comment',
    title: 'Title',
    noTitle: 'Untitled',
    unknownStudent: 'Student',
    minutes: (count: number) => `${String(count)}\u00A0min`,
    lessons: (count: number) => countOf(count, 'lesson', 'lessons', 'lessons'),
    students: (count: number) => countOf(count, 'student', 'students', 'students'),
  },
  dialog: {
    discardTitle: 'Discard changes?',
    discardText: 'The data you entered will not be saved.',
    discard: 'Discard',
  },
  fields: {
    required: 'Fill in the field',
    email: 'Invalid email address',
    minLength: (length: number) =>
      `At least ${countOf(length, 'character', 'characters', 'characters')}`,
    maxLength: (length: number) =>
      `At most ${countOf(length, 'character', 'characters', 'characters')}`,
    min: (value: number) => `At least ${String(value)}`,
    max: (value: number) => `At most ${String(value)}`,
    pattern: 'Invalid format',
    checkValue: 'Check the value',
  },
  load: {
    loading: 'Loading',
    failed: (what: string) => `Could not load ${what}`,
    data: 'the data',
    unknownError: 'Something went wrong. Try again now or a little later',
  },
  password: {
    show: 'Show password',
    hide: 'Hide password',
  },
  messengers: {
    TELEGRAM: 'Telegram',
    VK: 'VK',
    MAX: 'MAX',
  },
  fileSize: {
    bytes: 'B',
    units: ['KB', 'MB', 'GB'],
  },
};
