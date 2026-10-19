import { HttpTestingController } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';
import { hostElement } from '@testing/dom';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { testProviders } from '@testing/setup';
import { ChipColors } from './chip-colors';
import { TeacherColors } from './teacher-colors';

describe('TeacherColors', () => {
  let colors: TeacherColors;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    colors = TestBed.inject(TeacherColors);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  function openTeacherArea(): void {
    colors.load();
    backend
      .expectOne('/api/teacher/students')
      .flush([aStudent({ id: 's-1', color: 'RED' }), aStudent({ id: 's-2' })]);
    backend.expectOne('/api/teacher/groups').flush([aGroup({ id: 'g-1', color: 'PURPLE' })]);
  }

  it('looks up the colours of the students and groups it loaded', () => {
    openTeacherArea();

    expect(colors.student('s-1')).toBe('RED');
    expect(colors.student('s-2')).toBeNull();
    expect(colors.student(null)).toBeNull();
    expect(colors.group('g-1')).toBe('PURPLE');
    expect(colors.group(undefined)).toBeNull();
    expect(colors.owner('s-1', null)).toBe('RED');
    expect(colors.owner('s-1', 'g-1')).toBe('PURPLE');
    expect([...colors.all('group').keys()]).toEqual(['g-1']);
  });

  it('remembers a colour saved in a dialog', () => {
    openTeacherArea();

    colors.rememberStudent({ id: 's-2', color: 'BLUE' });
    colors.rememberStudent({ id: 's-1', color: null });
    colors.rememberGroup({ id: 'g-1', color: 'PURPLE' });
    colors.rememberGroup({ id: 'g-2', color: 'LIME' });

    expect(colors.student('s-2')).toBe('BLUE');
    expect(colors.student('s-1')).toBeNull();
    expect(colors.group('g-1')).toBe('PURPLE');
    expect(colors.group('g-2')).toBe('LIME');
  });

  it('leaves the lists without colours when they do not load', () => {
    colors.load();
    backend.expectOne('/api/teacher/students').flush(null, { status: 500, statusText: 'Error' });
    backend.expectOne('/api/teacher/groups');

    expect(colors.student('s-1')).toBeNull();
  });
});

@Component({
  imports: [ReactiveFormsModule, MultiSelect, ChipColors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-multiselect
      [formControl]="ids"
      [options]="options"
      optionLabel="name"
      optionValue="id"
      display="chip"
      [tbChipColors]="kind()"
    />
  `,
})
class Host {
  readonly colors = inject(TeacherColors);
  readonly ids = new FormControl(['a', 'b']);
  readonly kind = signal<'student' | 'group'>('student');
  readonly options = [
    { id: 'a', name: 'Анна' },
    { id: 'b', name: 'Борис' },
  ];
}

describe('ChipColors', () => {
  it('paints the chips of the chosen students and follows their colours', async () => {
    TestBed.configureTestingModule({ imports: [Host], providers: testProviders() });
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    host.colors.rememberStudent({ id: 'b', color: 'VIOLET' });
    fixture.detectChanges();
    await fixture.whenStable();

    const labels = (): (string | null)[] =>
      Array.from(hostElement(fixture).querySelectorAll('.p-multiselect-chip'), (chip) =>
        chip.getAttribute('data-tb-label'),
      );
    expect(labels()).toEqual([null, 'violet']);

    host.colors.rememberStudent({ id: 'a', color: 'ORANGE' });
    host.colors.rememberStudent({ id: 'b', color: null });
    fixture.detectChanges();
    expect(labels()).toEqual(['orange', null]);

    host.colors.rememberGroup({ id: 'b', color: 'CYAN' });
    host.kind.set('group');
    fixture.detectChanges();
    expect(labels()).toEqual([null, 'cyan']);

    host.ids.setValue(['b']);
    fixture.detectChanges();
    expect(labels()).toEqual(['cyan']);
  });
});
