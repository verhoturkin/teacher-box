import { CountPipe, countOf, plural } from './plural';

describe('plural', () => {
  it('agrees the noun with the number', () => {
    const forms = (count: number): string => plural(count, 'токен', 'токена', 'токенов');

    expect([1, 2, 4, 5, 11, 12, 21, 22, 25, 100, 101, 111].map(forms)).toEqual([
      'токен',
      'токена',
      'токена',
      'токенов',
      'токенов',
      'токенов',
      'токен',
      'токена',
      'токенов',
      'токенов',
      'токен',
      'токенов',
    ]);
  });

  it('joins the number and the noun with a non-breaking space', () => {
    expect(countOf(22, 'запрос', 'запроса', 'запросов')).toBe('22 запроса');
    expect(new CountPipe().transform(1, 'запрос', 'запроса', 'запросов')).toBe('1 запрос');
    expect(countOf(1500, 'токен', 'токена', 'токенов')).toContain(' токенов');
  });
});
