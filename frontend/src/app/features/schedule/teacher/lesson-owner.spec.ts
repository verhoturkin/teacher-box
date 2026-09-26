import { ownerIds, ownerOptions, ownerValue } from './lesson-owner';

describe('lesson owner', () => {
  const students = [{ id: 's-1', displayName: 'Иван' }];

  it('lists groups before students', () => {
    expect(ownerOptions(students, [{ id: 'g-1', name: 'ОГЭ' }])).toEqual([
      { label: 'Группы', items: [{ label: 'ОГЭ', value: 'group:g-1' }] },
      { label: 'Ученики', items: [{ label: 'Иван', value: 'student:s-1' }] },
    ]);
    expect(ownerOptions(students, [])).toEqual([{ label: 'Ученики', items: [{ label: 'Иван', value: 'student:s-1' }] }]);
  });

  it('turns a choice into the ids of a request and back', () => {
    expect(ownerIds('group:g-1')).toEqual({ studentId: null, groupId: 'g-1' });
    expect(ownerIds('student:s-1')).toEqual({ studentId: 's-1', groupId: null });
    expect(ownerValue({ studentId: null, groupId: 'g-1' })).toBe('group:g-1');
    expect(ownerValue({ studentId: 's-1', groupId: null })).toBe('student:s-1');
    expect(ownerValue({ studentId: null, groupId: null })).toBeNull();
  });
});
