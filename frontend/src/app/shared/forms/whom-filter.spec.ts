import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { WhomDirectory, WhomFilter, WhomTexts } from './whom-filter';

const texts: WhomTexts = {
  groupsOption: 'Groups',
  studentsOption: 'Students',
  whomAll: 'For: all',
  whomChosen: (name) => `For: ${name}`,
  everyone: 'All',
};

const directory: WhomDirectory = {
  listStudents: () =>
    of([
      { id: 's1', displayName: 'Anna', status: 'ACTIVE' },
      { id: 's2', displayName: 'Boris', status: 'DEACTIVATED' },
    ]),
  listGroups: () =>
    of([
      { id: 'g1', name: 'Group A', archivedAt: null, members: [{ id: 's1' }] },
      { id: 'g2', name: 'Old', archivedAt: '2026-01-01T00:00:00Z', members: [] },
    ]),
};

function filter(initial: string | null): WhomFilter {
  return runInInjectionContext(TestBed.inject(Injector), () => {
    const created = new WhomFilter(initial, texts, directory);
    created.load();
    return created;
  });
}

describe('WhomFilter', () => {
  it('lists active students and not archived groups', () => {
    const whom = filter(null);
    expect(whom.options().map((group) => group.label)).toEqual(['Groups', 'Students']);
    expect(whom.options().flatMap((group) => group.items.map((i) => i.value))).toEqual([
      'group:g1',
      'student:s1',
    ]);
    expect(whom.ids()).toBeNull();
    expect(whom.id()).toBeNull();
    expect(whom.chip().label).toBe('For: all');
    expect(whom.chip().selected).toBe(false);
  });

  it('stands for a group by its members and for a student by itself', () => {
    const whom = filter('group:g1');
    expect(whom.ids()).toEqual(new Set(['s1']));
    expect(whom.id()).toBe('g1');
    expect(whom.chip().label).toBe('For: Group A');
    whom.control.setValue('student:s1');
    expect(whom.ids()).toEqual(new Set(['s1']));
  });

  it('resets from the chip menu', () => {
    const whom = filter('student:s1');
    const items = whom.chip().items;
    items[0]?.command?.({});
    expect(whom.control.value).toBeNull();
    items[2]?.items?.[0]?.command?.({});
    expect(whom.control.value).toBe('student:s1');
  });
});
