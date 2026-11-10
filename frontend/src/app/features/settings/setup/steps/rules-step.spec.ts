import { FormControl, FormGroup } from '@angular/forms';
import { hostElement, readableText } from '@testing/dom';
import { renderStep, savedSetup } from '@testing/setup-fixtures';
import { RulesForm, SetupRulesPreview, SetupRulesStep } from './rules-step';

describe('SetupRulesStep', () => {
  it('shows the rules and submits by Enter', async () => {
    const form: RulesForm = new FormGroup({
      late: new FormControl<number | null>(24),
      dueSoon: new FormControl<number | null>(24),
      horizon: new FormControl<number | null>(12),
    });
    const fixture = await renderStep(SetupRulesStep, { form, reminders: [1440, 60] });
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    const host = hostElement(fixture);
    for (const id of ['#setup-late', '#setup-due-soon', '#setup-horizon', '#setup-reminders']) {
      expect(host.querySelector(id)).not.toBeNull();
    }
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(submitted).toHaveBeenCalled();
  });
});

describe('SetupRulesPreview', () => {
  it('explains the saved rules on examples', async () => {
    const fixture = await renderStep(SetupRulesPreview, {
      values: { late: null, dueSoon: null, horizon: null },
      reminders: [1440, 60],
      saved: savedSetup(),
    });
    const text = readableText(hostElement(fixture));
    expect(text).toContain(
      'Урок в четверг в 10:00. Ученик отменил в среду в 20:00 — это поздняя отмена',
    );
    expect(text).toContain('в среду в 10:00 и в четверг в 9:00. Вам — только в 9:00');
  });

  it('follows the fields as they are typed', async () => {
    const fixture = await renderStep(SetupRulesPreview, {
      values: { late: 0, dueSoon: 6, horizon: 4 },
      reminders: [60],
      saved: savedSetup(),
    });
    const text = readableText(hostElement(fixture));
    expect(text).toContain('Поздних отмен не будет');
    expect(text).toContain('Сообщение придёт ученику и вам в четверг в 9:00');
    expect(text).toContain('ученику напомнят в пятницу в 12:00');
    expect(text).toContain('на 4 недели вперёд');
  });

  it('shows nothing of the server before it answers', async () => {
    const fixture = await renderStep(SetupRulesPreview, {
      values: {},
      reminders: [],
      saved: null,
    });
    expect(readableText(hostElement(fixture))).toContain('Поздних отмен не будет');
  });
});
