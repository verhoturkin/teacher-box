import { PEER_COLORS, collaborators } from './board-presence';

describe('collaborators', () => {
  it('shows the others with their names, colours and cursors', () => {
    const shown = collaborators([
      { id: 'p-1', name: 'Учитель', color: 1 },
      {
        id: 'p-2',
        name: 'Ученица',
        color: PEER_COLORS.length,
        pointer: { x: 3, y: 4, tool: 'laser', button: 'down' },
      },
      { id: '', name: 'Без id', color: 0 },
    ]);

    expect([...shown.keys()]).toEqual(['p-1', 'p-2']);
    expect(shown.get([...shown.keys()][0] ?? fail())).toEqual({
      id: 'p-1',
      socketId: 'p-1',
      username: 'Учитель',
      color: PEER_COLORS[1],
    });
    expect(shown.get([...shown.keys()][1] ?? fail())).toMatchObject({
      color: PEER_COLORS[0],
      pointer: { x: 3, y: 4, tool: 'laser' },
      button: 'down',
    });
  });
});

function fail(): never {
  throw new Error('No collaborator');
}
