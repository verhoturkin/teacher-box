import { callOwnerOf } from './call-links';

const OWNER = '01a0de87-6fdd-7428-8555-bed8116f54f9';
const ORIGINS = ['http://localhost:4200', 'https://school.example.org'];

describe('callOwnerOf', () => {
  it('finds the owner in a link of this portal', () => {
    expect(callOwnerOf(`https://school.example.org/call/${OWNER}`, ORIGINS)).toBe(OWNER);
    expect(callOwnerOf(`http://localhost:4200/call/${OWNER}`, ORIGINS)).toBe(OWNER);
  });

  it('leaves other links alone', () => {
    expect(callOwnerOf(`https://other.example.org/call/${OWNER}`, ORIGINS)).toBeNull();
    expect(callOwnerOf('https://school.example.org/call/room', ORIGINS)).toBeNull();
    expect(callOwnerOf(`https://school.example.org/cabinet/${OWNER}`, ORIGINS)).toBeNull();
    expect(callOwnerOf('https://telemost.yandex.ru/j/1', ORIGINS)).toBeNull();
    expect(callOwnerOf('not a link', ORIGINS)).toBeNull();
  });
});
