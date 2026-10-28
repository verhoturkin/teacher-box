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
    TEXTBOOK: 'Textbooks',
    WORKBOOK: 'Workbooks',
    OTHER: 'Other',
  },
  search: 'Title, student or group',
  searchMine: 'Title',
  sort: {
    label: 'Sort',
    changed: 'Recently changed',
    title: 'By title',
    created: 'Newest first',
  },
  newBoard: 'New board',
  newTextbook: 'New textbook',
};
