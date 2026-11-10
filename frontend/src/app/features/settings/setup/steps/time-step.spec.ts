import { FormControl, FormGroup } from '@angular/forms';
import { hostElement, readableText } from '@testing/dom';
import { renderStep, savedSetup } from '@testing/setup-fixtures';
import { lessonRules } from '@testing/schedule-fixtures';
import { SetupTimePreview, SetupTimeStep, TimeForm } from './time-step';

describe('SetupTimeStep', () => {
  it('shows the zone, the length, the currency and the price and submits by Enter', async () => {
    const form: TimeForm = new FormGroup({
      zone: new FormControl('Europe/Moscow', { nonNullable: true }),
      duration: new FormControl<number | null>(60),
      currency: new FormControl('RUB', { nonNullable: true }),
      price: new FormControl<number | null>(null),
    });
    const fixture = await renderStep(SetupTimeStep, { form, locked: false, currency: null });
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    const host = hostElement(fixture);
    for (const id of ['#setup-zone', '#setup-duration', '#setup-currency', '#setup-price']) {
      expect(host.querySelector(id)).not.toBeNull();
    }
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(submitted).toHaveBeenCalled();
  });
});

describe('SetupTimePreview', () => {
  it('shows a lesson with its length and price and the report in the chosen zone', async () => {
    const fixture = await renderStep(SetupTimePreview, {
      values: { zone: 'Asia/Novosibirsk', duration: 90, price: 25 },
      currency: 'EUR',
      saved: savedSetup(),
    });
    const text = readableText(hostElement(fixture));
    expect(text).toContain('18:00–19:30 · 25');
    expect(text).toContain('€');
    expect(text).toContain('Asia/Novosibirsk (UTC+7)');
  });

  it('takes the saved length and shows no price while there is none', async () => {
    const fixture = await renderStep(SetupTimePreview, {
      values: { zone: 'Europe/Moscow', duration: null, price: null },
      currency: null,
      saved: savedSetup({ rules: lessonRules({ defaultDurationMinutes: 45 }) }),
    });
    const text = readableText(hostElement(fixture));
    expect(text).toContain('18:00–18:45');
    expect(text).not.toContain('18:45 ·');
    expect(text).toContain('₽');
  });
});
