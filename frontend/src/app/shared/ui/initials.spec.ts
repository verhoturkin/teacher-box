import { InitialsPipe } from './initials';

describe('InitialsPipe', () => {
  const pipe = new InitialsPipe();

  it('takes the first letters of the first two words', () => {
    expect(pipe.transform('Анна Смирнова')).toBe('АС');
    expect(pipe.transform('  борис   петров  иванович ')).toBe('БП');
    expect(pipe.transform('Мария')).toBe('М');
    expect(pipe.transform('Группа «ОГЭ»')).toBe('ГО');
    expect(pipe.transform('— 9 класс')).toBe('9К');
  });

  it('gives nothing for no name', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
