import { HttpTestingController } from '@angular/common/http/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { CHILD_ID, SECOND_CHILD_ID, familyChild } from '@testing/family-fixtures';
import { testProviders } from '@testing/setup';
import { Family, familyScope, firstName } from './family';

describe('Family', () => {
  let family: Family;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    TestBed.inject(AuthService).acceptSession(authResponse('GUARDIAN'));
    family = TestBed.inject(Family);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('loads the children once per sign-in and knows the current one', () => {
    const loaded: number[] = [];
    family.load().subscribe((children) => loaded.push(children.length));
    backend
      .expectOne('/api/guardian/children')
      .flush([familyChild(), familyChild({ id: SECOND_CHILD_ID, displayName: 'Маша' })]);
    family.load().subscribe((children) => loaded.push(children.length));
    backend.expectNone('/api/guardian/children');
    expect(loaded).toEqual([2, 2]);

    family.current.set(SECOND_CHILD_ID);
    expect(family.child()?.displayName).toBe('Маша');
    expect(family.label(CHILD_ID)).toBe('red');
    expect(family.label(SECOND_CHILD_ID)).toBe('lime');
    expect(family.label('unknown')).toBe('red');

    // another parent signs in on the same tab: the list is theirs, asked again
    TestBed.inject(AuthService).acceptSession({
      ...authResponse('GUARDIAN'),
      user: { ...authResponse('GUARDIAN').user, id: 'other' },
    });
    expect(family.children()).toEqual([]);
    family.load().subscribe();
    backend.expectOne('/api/guardian/children').flush([]);
  });

  it('takes a failure for no children and asks again next time', () => {
    let children: readonly unknown[] | null = null;
    family.load().subscribe((list) => (children = list));
    backend
      .expectOne('/api/guardian/children')
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(children).toEqual([]);
    family.load().subscribe();
    backend.expectOne('/api/guardian/children').flush([familyChild()]);
    expect(family.children()).toHaveLength(1);
  });

  it('gives the scope of the child of the address', () => {
    const scope = runInInjectionContext(TestBed.inject(Injector), familyScope);
    expect(scope.api()).toBe('/api/guardian/students/');
    family.current.set(CHILD_ID);
    expect(scope.api()).toBe(`/api/guardian/students/${CHILD_ID}`);
    expect(scope.area()).toBe(`/family/${CHILD_ID}`);
    expect(scope.feed).toBe('/api/guardian/schedule/feed');
    expect(scope.readOnly).toBe(true);
  });

  it('takes the first word of a name', () => {
    expect(firstName('  Петя Смирнов ')).toBe('Петя');
    expect(firstName('Маша')).toBe('Маша');
  });
});
