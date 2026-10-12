import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aGroup } from '@testing/identity-fixtures';
import { hostElement } from '@testing/dom';
import { GroupPicker } from './group-picker';
import { testProviders } from '@testing/setup';

describe('GroupPicker', () => {
  let fixture: ComponentFixture<GroupPicker>;
  let backend: HttpTestingController;
  let picked: string[][];
  let dropped: string[][];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [GroupPicker],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupPicker);
    picked = [];
    dropped = [];
    fixture.componentInstance.picked.subscribe((ids) => picked.push(ids));
    fixture.componentInstance.dropped.subscribe((ids) => dropped.push(ids));
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('is hidden without current groups that have students', async () => {
    backend
      .expectOne('/api/teacher/groups')
      .flush([
        aGroup({ id: 'empty', members: [] }),
        aGroup({ id: 'old', archivedAt: '2026-09-01T10:00:00Z' }),
      ]);
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('p-multiselect')).toBeNull();
  });

  it('adds the students of chosen groups and removes those of a group taken off', async () => {
    backend.expectOne('/api/teacher/groups').flush([
      aGroup({
        id: 'g1',
        members: [
          { id: 'a', displayName: 'Анна', status: 'ACTIVE' },
          { id: 'o', displayName: 'Олег', status: 'DEACTIVATED' },
          { id: 'b', displayName: 'Борис', status: 'ACTIVE' },
        ],
      }),
      aGroup({ id: 'g2', members: [{ id: 'b', displayName: 'Борис', status: 'ACTIVE' }] }),
    ]);
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('p-multiselect')).not.toBeNull();
    const picker = fixture.componentInstance;

    picker.choose(['g1']);
    picker.choose(['g1', 'g2']);
    expect(picked).toEqual([['a', 'b'], ['b']]);

    picker.choose(['g2']);
    expect(dropped).toEqual([['a']]);
    expect(picker.selected()).toEqual(['g2']);

    picker.choose([]);
    expect(dropped).toEqual([['a'], ['b']]);
  });
});
