import {
  Course,
  LessonPlan,
  LessonPlanSummary,
  MyTextbook,
  Textbook,
} from '@features/textbooks/parts';

export function aTextbook(overrides: Partial<Textbook> = {}): Textbook {
  return {
    id: 'tb-1',
    kind: 'TEXTBOOK',
    title: 'Spotlight 5',
    courseId: 'c-1',
    courseName: 'Английский',
    pageCount: 120,
    format: 'PDF',
    filename: 'Spotlight 5.pdf',
    contentType: 'application/pdf',
    size: 4_404_019,
    hasCover: true,
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
    courseId: null,
    courseName: null,
    pageCount: 48,
    format: 'DOCUMENT',
    filename: 'Тетрадь.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 20_480,
    hasCover: false,
    members: [],
    ...overrides,
  });
}

export function aMyTextbook(overrides: Partial<MyTextbook> = {}): MyTextbook {
  return {
    id: 'tb-1',
    kind: 'TEXTBOOK',
    title: 'Spotlight 5',
    courseName: 'Английский',
    pageCount: 120,
    format: 'PDF',
    filename: 'Spotlight 5.pdf',
    size: 4_404_019,
    hasCover: true,
    groupNames: ['ОГЭ'],
    updatedAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

export function aCourse(overrides: Partial<Course> = {}): Course {
  return { id: 'c-1', name: 'Английский', position: 0, version: 0, ...overrides };
}

export function aPlanSummary(overrides: Partial<LessonPlanSummary> = {}): LessonPlanSummary {
  return {
    id: 'p-1',
    title: 'Present Simple',
    courseId: 'c-1',
    bank: true,
    sourceId: null,
    uses: 3,
    updatedAt: '2026-11-01T10:00:00Z',
    version: 0,
    ...overrides,
  };
}

export function aLessonPlan(overrides: Partial<LessonPlan> = {}): LessonPlan {
  return {
    id: 'p-1',
    title: 'Present Simple',
    body: '1. Разминка',
    courseId: 'c-1',
    bank: true,
    sourceId: null,
    uses: 0,
    textbooks: [
      {
        id: 'tb-1',
        title: 'Spotlight 5',
        kind: 'TEXTBOOK',
        format: 'PDF',
        pageCount: 120,
        pages: '12-14',
      },
    ],
    videos: [],
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    version: 0,
    ...overrides,
  };
}
