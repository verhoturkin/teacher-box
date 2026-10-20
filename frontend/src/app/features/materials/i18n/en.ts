import type { Translation } from '@core/i18n/language';
import type { ru } from './ru';

export const en: Translation<typeof ru> = {
  title: 'Materials',
  what: 'the materials',
  tabs: 'Kind of materials',
  boards: 'Boards',
  textbooks: 'Textbooks',
  filters: 'Materials filter',
  chips: {
    all: 'All',
    portal: 'On the portal',
    external: 'External',
    member: 'Student or group',
    TEXTBOOK: 'Textbooks',
    WORKBOOK: 'Workbooks',
    OTHER: 'Other',
  },
  search: 'Title, student or group',
  searchMine: 'Title',
  member: {
    label: 'Whose materials',
    placeholder: 'Choose a student or a group',
    students: 'Students',
    groups: 'Groups',
  },
  sort: {
    label: 'Sort',
    changed: 'Recently changed',
    title: 'By title',
    created: 'Newest first',
  },
  newBoard: 'New board',
  newTextbook: 'New textbook',
};
