import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { testProviders } from '@testing/setup';
import { OwnerOption } from './owner-option';
import { TeacherColors } from './teacher-colors';

describe('OwnerOption', () => {
  function render(value: string): HTMLElement {
    TestBed.configureTestingModule({ providers: testProviders() });
    TestBed.inject(TeacherColors).load();
    const backend = TestBed.inject(HttpTestingController);
    backend.expectOne('/api/teacher/students').flush([aStudent({ id: 's-1', color: 'RED' })]);
    backend.expectOne('/api/teacher/groups').flush([aGroup({ id: 'g-1', color: 'BLUE' })]);
    const fixture = TestBed.createComponent(OwnerOption);
    fixture.componentRef.setInput('name', 'Аня');
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return hostElement(fixture);
  }

  it.each([
    ['student:s-1', 'red'],
    ['s-1', 'red'],
    ['group:g-1', 'blue'],
  ])('colours the avatar of %s', (value, color) => {
    const root = render(value);
    expect(root.querySelector('tb-avatar')?.getAttribute('data-tb-label')).toBe(color);
    expect(root.textContent).toContain('Аня');
  });
});
