import { plural } from '@shared/text/plural';

/** Texts of `materials` (ADR-0035). */
export const ru = {
  title: 'Материалы',
  what: 'материалы',
  places: 'Разделы материалов',
  all: 'Все материалы',
  none: 'Без курса',
  boards: 'Доски',
  count: (count: number) =>
    `${String(count)} ${plural(count, 'материал', 'материала', 'материалов')}`,
  tabs: 'Вид материалов',
  textbooks: 'Учебники',
  plans: 'Планы',
  assignments: 'Задания',
  filter: {
    label: 'Фильтр',
    all: 'Все',
    portal: 'На портале',
    external: 'Внешние',
    TEXTBOOK: 'Учебники',
    WORKBOOK: 'Рабочие тетради',
    OTHER: 'Другое',
  },
  /** The student's page: the chips of the boards. */
  filters: 'Фильтр материалов',
  chips: {
    all: 'Все',
    portal: 'На портале',
    external: 'Внешние',
    TEXTBOOK: 'Учебники',
    WORKBOOK: 'Рабочие тетради',
    OTHER: 'Другое',
  },
  search: 'Название, ученик или группа',
  searchTemplates: 'Название или курс',
  searchMine: 'Название',
  sort: {
    label: 'Сортировка',
    changed: 'Сначала изменённые',
    title: 'По названию',
    created: 'Сначала новые',
  },
  create: 'Создать',
  createMenu: {
    textbook: 'Учебник',
    plan: 'План урока',
    assignment: 'Задание',
    board: 'Доска',
  },
};
