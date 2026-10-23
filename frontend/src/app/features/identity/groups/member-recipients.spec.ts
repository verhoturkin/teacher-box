import { aGroup } from '@testing/identity-fixtures';
import { memberRecipients } from './member-recipients';

describe('memberRecipients', () => {
  const groups = [
    aGroup({
      id: 'g-1',
      members: [
        { id: 's-1', displayName: 'Anna', status: 'ACTIVE' },
        { id: 's-2', displayName: 'Boris', status: 'DEACTIVATED' },
      ],
    }),
    aGroup({
      id: 'g-2',
      members: [
        { id: 's-1', displayName: 'Anna', status: 'ACTIVE' },
        { id: 's-3', displayName: 'Vera', status: 'ACTIVE' },
      ],
    }),
    aGroup({ id: 'old', archivedAt: '2026-01-01T00:00:00Z' }),
  ];
  it('deduplicates overlaps and excludes deactivated, archived and unavailable recipients', () => {
    expect(
      memberRecipients(
        [
          { kind: 'STUDENT', id: 's-1' },
          { kind: 'GROUP', id: 'g-1' },
          { kind: 'GROUP', id: 'g-2' },
          { kind: 'GROUP', id: 'old' },
          { kind: 'GROUP', id: 'missing' },
          { kind: 'STUDENT', id: 'unknown' },
        ],
        groups,
        ['s-1', 's-2', 's-3'],
      ),
    ).toEqual(['s-1', 's-3']);
  });
  it('retains an explicit choice when a group is removed and clears a snapshot with its last group', () => {
    expect(memberRecipients([{ kind: 'STUDENT', id: 's-1' }], groups, ['s-1'])).toEqual(['s-1']);
    expect(memberRecipients([], groups, ['s-1'])).toEqual([]);
  });
});
