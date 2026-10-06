import { MediaRef } from './call-engine';
import { elapsedText, gridSize, miniView, stageLayout } from './call-layout';
import { aParticipant as person } from '@testing/meetings-fixtures';

const VIDEO: MediaRef = { id: 'v', attach: () => undefined, detach: () => undefined };

describe('call layout', () => {
  const me = person({ id: 'me', local: true });
  const anna = person({ id: 'anna', local: false, name: 'Анна' });
  const boris = person({ id: 'boris', local: false, name: 'Борис' });

  it('puts this user alone, a pair with an inset, or a grid', () => {
    expect(stageLayout([me])).toEqual({
      kind: 'alone',
      main: { participant: me, screen: false },
      inset: null,
      tiles: [],
    });
    expect(stageLayout([])).toMatchObject({ kind: 'alone', main: null });
    expect(stageLayout([me, anna])).toEqual({
      kind: 'pair',
      main: { participant: anna, screen: false },
      inset: me,
      tiles: [],
    });
    expect(stageLayout([me, anna, boris])).toMatchObject({
      kind: 'grid',
      tiles: [anna, boris, me],
    });
    expect(stageLayout([anna, boris]).tiles).toEqual([anna, boris]);
  });

  it('puts a shared screen on the stage, the screen of another first', () => {
    const sharingMe = { ...me, screen: VIDEO };
    const sharingAnna = { ...anna, screen: VIDEO };

    expect(stageLayout([sharingMe, anna])).toMatchObject({
      kind: 'screen',
      main: { participant: sharingMe, screen: true },
      tiles: [anna, sharingMe],
    });
    expect(stageLayout([sharingMe, sharingAnna]).main?.participant).toBe(sharingAnna);
    expect(stageLayout([sharingAnna]).tiles).toEqual([sharingAnna]);
  });

  it('shows in the mini window a screen, a speaker, a camera, anyone, then this user', () => {
    expect(miniView([me, anna, { ...boris, screen: VIDEO }])?.screen).toBe(true);
    expect(miniView([me, anna, { ...boris, speaking: true }])?.participant.id).toBe('boris');
    expect(miniView([me, anna, { ...boris, camera: VIDEO }])?.participant.id).toBe('boris');
    expect(miniView([me, anna, boris])?.participant.id).toBe('anna');
    expect(miniView([me])?.participant.id).toBe('me');
    expect(miniView([])).toBeNull();
  });

  it('makes the grid as square as possible, two columns on a phone', () => {
    expect(gridSize(1, false)).toEqual({ columns: 1, rows: 1 });
    expect(gridSize(3, false)).toEqual({ columns: 2, rows: 2 });
    expect(gridSize(5, false)).toEqual({ columns: 3, rows: 2 });
    expect(gridSize(10, true)).toEqual({ columns: 2, rows: 5 });
    expect(gridSize(0, true)).toEqual({ columns: 1, rows: 1 });
  });

  it('counts the time of the call', () => {
    expect(elapsedText(-5)).toBe('0:00');
    expect(elapsedText(65_000)).toBe('1:05');
    expect(elapsedText(3_725_000)).toBe('1:02:05');
  });
});
