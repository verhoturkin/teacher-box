import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { MultiSelect } from 'primeng/multiselect';
import { MemberPicker, MemberPickerOption, MemberSelection } from '../parts';
import { hostElement, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { FieldErrors } from '@shared/ui/field-errors';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MemberPicker, ReactiveFormsModule, FieldErrors],
  template: `<form tbFieldErrors>
    <div class="tb-field">
      <label for="members">Получатели</label>
      <tb-member-picker
        inputId="members"
        [formControl]="control"
        [students]="students"
        [groups]="groups"
        [selectionLimit]="limit"
      />
    </div>
  </form>`,
})
class Host {
  readonly control = new FormControl<readonly MemberSelection[]>([], {
    nonNullable: true,
    validators: Validators.required,
  });
  students: MemberPickerOption[] = [
    { id: 'same', name: 'Анна', detail: 'anna1' },
    { id: 'other', name: 'Анна', detail: 'anna2' },
    { id: 'old', name: 'Борис', unavailable: true },
  ];
  groups: MemberPickerOption[] = [{ id: 'same', name: 'Анна' }];
  limit: number | undefined;
}

describe('MemberPicker', () => {
  let fixture: ComponentFixture<Host>;
  let control: Host['control'];
  let select: MultiSelect;

  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn();
    TestBed.configureTestingModule({ imports: [Host], providers: testProviders() });
    fixture = TestBed.createComponent(Host);
    control = fixture.componentInstance.control;
    await fixture.whenStable();
    select = fixture.debugElement.query(By.directive(MultiSelect)).injector.get(MultiSelect);
  });

  afterEach(() => {
    fixture.destroy();
  });

  async function open(): Promise<void> {
    requireElement(hostElement(fixture), '.p-multiselect-label-container', HTMLElement).click();
    await fixture.whenStable();
  }

  async function choose(text: string): Promise<void> {
    const option = [...document.querySelectorAll<HTMLElement>('.p-multiselect-option')].find(
      (item) => item.textContent.includes(text),
    );
    expect(option).toBeDefined();
    option?.click();
    await fixture.whenStable();
  }

  it('searches namesakes and distinguishes students from groups with the same ID', async () => {
    await open();
    expect(document.body.textContent).toContain('Ученики');
    expect(document.body.textContent).toContain('Группы');
    await choose('Ученик: Анна (anna1)');
    await choose('Группа: Анна');
    expect(control.value).toEqual([
      { kind: 'STUDENT', id: 'same' },
      { kind: 'GROUP', id: 'same' },
    ]);
    typeInto(requireElement(document.body, '.p-multiselect-filter', HTMLInputElement), 'anna2');
    await fixture.whenStable();
    expect(document.querySelectorAll('.p-multiselect-option')).toHaveLength(1);
    await choose('anna2');
    expect(control.value).toHaveLength(3);
    expect(hostElement(fixture).textContent).toContain('Группа: Анна');
  });

  it('preserves prefilled unavailable values, deduplicates typed IDs and clears them', async () => {
    control.setValue([
      { kind: 'GROUP', id: 'gone' },
      { kind: 'GROUP', id: 'gone' },
      { kind: 'STUDENT', id: 'old' },
    ]);
    await fixture.whenStable();
    expect(hostElement(fixture).textContent).toContain('Группа: gone — Недоступно');
    expect(hostElement(fixture).textContent).toContain('Ученик: Борис — Недоступно');
    expect(select.value).toHaveLength(2);
    requireElement(hostElement(fixture), '.p-chip-remove-icon', Element).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    await fixture.whenStable();
    expect(control.value).toEqual([{ kind: 'STUDENT', id: 'old' }]);
    requireElement(hostElement(fixture), '.p-multiselect-clear-icon', Element).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    await fixture.whenStable();
    expect(control.value).toEqual([]);
    expect(control.touched).toBe(true);
  });

  it('keeps archived options disabled and supports a one-recipient limit', async () => {
    fixture.componentInstance.limit = 1;
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    await open();
    await choose('Борис');
    expect(control.value).toEqual([]);
    await choose('anna1');
    await choose('Группа: Анна');
    expect(control.value).toEqual([{ kind: 'STUDENT', id: 'same' }]);
  });

  it('keeps groups independent when an explicit student choice is removed', async () => {
    await open();
    await choose('anna1');
    await choose('Группа: Анна');
    await choose('anna1');
    expect(control.value).toEqual([{ kind: 'GROUP', id: 'same' }]);
  });

  it('supports empty options, a disabled form control and resetting to null', async () => {
    fixture.componentInstance.students = [];
    fixture.componentInstance.groups = [];
    fixture.changeDetectorRef.markForCheck();
    control.disable();
    await fixture.whenStable();
    expect(select.disabled()).toBe(true);
    control.enable();
    await fixture.whenStable();
    await open();
    expect(document.querySelectorAll('.p-multiselect-option')).toHaveLength(0);
    const picker = fixture.debugElement
      .query(By.directive(MemberPicker))
      .injector.get(MemberPicker);
    picker.writeValue(null);
    await fixture.whenStable();
    expect(select.value).toEqual([]);
  });

  it('uses the portal field errors and keyboard opening/closing', async () => {
    control.markAllAsTouched();
    await fixture.whenStable();
    const combobox = requireElement(hostElement(fixture), '[role="combobox"]', HTMLElement);
    expect(combobox.getAttribute('aria-invalid')).toBe('true');
    expect(combobox.getAttribute('aria-required')).toBe('true');
    expect(hostElement(fixture).querySelector('p-multiselect.p-invalid')).not.toBeNull();
    expect(hostElement(fixture).querySelector('.tb-field__error')).not.toBeNull();
    combobox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }),
    );
    await fixture.whenStable();
    expect(combobox.getAttribute('aria-expanded')).toBe('true');
    requireElement(document.body, '.p-multiselect-filter', HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    );
    await fixture.whenStable();
    expect(combobox.getAttribute('aria-expanded')).toBe('false');
  });
});
