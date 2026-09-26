import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { aGroup } from '@testing/identity-fixtures';
import { hostElement } from '@testing/dom';
import { GroupPicker } from './group-picker';

describe('GroupPicker', () => {
  let fixture: ComponentFixture<GroupPicker>;
  let backend: HttpTestingController;
  let picked: string[][];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [GroupPicker],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupPicker);
    picked = [];
    fixture.componentInstance.picked.subscribe((ids) => picked.push(ids));
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('is hidden without current groups that have students', async () => {
    backend.expectOne('/api/teacher/groups').flush([
      aGroup({ id: 'empty', members: [] }),
      aGroup({ id: 'old', archivedAt: '2026-09-01T10:00:00Z' }),
    ]);
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('p-select')).toBeNull();
  });

  it('emits the students of the chosen group who still have access', async () => {
    const group = aGroup({
      members: [
        { id: 'a', displayName: 'Анна', status: 'ACTIVE' },
        { id: 'o', displayName: 'Олег', status: 'DEACTIVATED' },
      ],
    });
    backend.expectOne('/api/teacher/groups').flush([group]);
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('p-select')).not.toBeNull();

    fixture.componentInstance.choice.setValue(group);

    expect(picked).toEqual([['a']]);
    expect(fixture.componentInstance.choice.value).toBeNull();
  });
});
