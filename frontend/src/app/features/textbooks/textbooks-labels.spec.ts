import { aMyTextbook, aTextbook, aWorkbook } from '@testing/textbooks-fixtures';
import {
  fileText,
  isDocumentFile,
  pagesText,
  textbookDetails,
  textbookMembersText,
} from './textbooks-labels';

describe('textbooks labels', () => {
  it('describes a textbook in one line', () => {
    expect(textbookDetails(aTextbook())).toBe('Учебник · Английский · PDF, 120 с., 4,2 МБ');
    expect(textbookDetails(aWorkbook({ pageCount: null }))).toBe('Рабочая тетрадь · Word, 20 КБ');
    expect(textbookDetails(aMyTextbook({ kind: 'OTHER', course: null }))).toBe(
      'Другое · PDF, 120 с., 4,2 МБ',
    );
    expect(fileText({ format: 'IMAGE', pageCount: 1, size: 100 })).toBe('картинка, 100 Б');
    expect(pagesText(null)).toBeNull();
  });

  it('names the members, skipping those who are gone', () => {
    expect(textbookMembersText(aTextbook())).toBe('Мария, группа «ОГЭ»');
    expect(
      textbookMembersText(aTextbook({ members: [{ type: 'STUDENT', id: 'x', name: null }] })),
    ).toBe('ученикам не открыт');
  });

  it('tells a Word file by its name', () => {
    expect(isDocumentFile('a.DOCX')).toBe(true);
    expect(isDocumentFile('a.doc')).toBe(true);
    expect(isDocumentFile('a.pdf')).toBe(false);
  });
});
