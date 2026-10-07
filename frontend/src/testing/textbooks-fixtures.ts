import { MyTextbook, Textbook } from '@features/textbooks/parts';

export function aTextbook(overrides: Partial<Textbook> = {}): Textbook {
  return {
    id: 'tb-1',
    kind: 'TEXTBOOK',
    title: 'Spotlight 5',
    course: 'Английский',
    pageCount: 120,
    format: 'PDF',
    filename: 'Spotlight 5.pdf',
    contentType: 'application/pdf',
    size: 4_404_019,
    members: [
      { type: 'STUDENT', id: 's-1', name: 'Мария' },
      { type: 'GROUP', id: 'g-1', name: 'ОГЭ' },
    ],
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
    version: 0,
    ...overrides,
  };
}

export function aWorkbook(overrides: Partial<Textbook> = {}): Textbook {
  return aTextbook({
    id: 'tb-2',
    kind: 'WORKBOOK',
    title: 'Рабочая тетрадь',
    course: null,
    pageCount: 48,
    format: 'DOCUMENT',
    filename: 'Тетрадь.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 20_480,
    members: [],
    ...overrides,
  });
}

export function aMyTextbook(overrides: Partial<MyTextbook> = {}): MyTextbook {
  return {
    id: 'tb-1',
    kind: 'TEXTBOOK',
    title: 'Spotlight 5',
    course: 'Английский',
    pageCount: 120,
    format: 'PDF',
    filename: 'Spotlight 5.pdf',
    size: 4_404_019,
    groupNames: ['ОГЭ'],
    updatedAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}
