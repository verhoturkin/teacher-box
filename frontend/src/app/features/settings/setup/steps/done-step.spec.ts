import { buttonByText, hostElement, readableText } from '@testing/dom';
import { portalSettings } from '@testing/portal-fixtures';
import { lessonRules } from '@testing/schedule-fixtures';
import { renderStep, savedSetup } from '@testing/setup-fixtures';
import { SetupDonePreview, SetupDoneStep } from './done-step';

describe('SetupDoneStep', () => {
  it('shows the next steps with their states and opens the chosen one', async () => {
    const fixture = await renderStep(SetupDoneStep, {
      states: {
        student: { state: 'Уже есть: 2 ученика', done: true },
        google: { state: 'Нужно подключить заново', done: false },
      },
      pending: false,
    });
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);
    const host = hostElement(fixture);
    const text = readableText(host);
    expect(text).toContain('Уже есть: 2 ученика');
    expect(text).toContain('Нужно подключить заново');
    expect(host.querySelectorAll('.tb-setup__card-state .tb-i-check_circle')).toHaveLength(1);
    expect(host.querySelectorAll('.tb-setup__card--hero')).toHaveLength(1);

    buttonByText(host, 'Добавить первого ученика').click();
    expect(opened).toHaveBeenCalledWith({
      link: '/teacher/students',
      query: { create: 'student' },
    });
  });

  it('holds the cards while the setup finishes', async () => {
    const fixture = await renderStep(SetupDoneStep, { states: {}, pending: true });
    const buttons = [...hostElement(fixture).querySelectorAll('button')];
    expect(buttons).toHaveLength(4);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });
});

describe('SetupDonePreview', () => {
  it('sums up what was set up and edits a step', async () => {
    const fixture = await renderStep(SetupDonePreview, {
      saved: savedSetup({
        portal: portalSettings({
          name: 'Английский с Еленой',
          address: 'https://school.example.com',
        }),
        currency: 'EUR',
        price: 2500,
        rules: lessonRules({
          defaultDurationMinutes: 90,
          lateCancellationMinutes: 0,
          reminderMinutes: [60],
          horizonWeeks: 4,
        }),
        dueSoon: 360,
      }),
    });
    const edit = vi.fn();
    fixture.componentInstance.edit.subscribe(edit);
    const host = hostElement(fixture);
    const text = readableText(host);
    expect(text).toContain('Английский с Еленой · school.example.com');
    expect(text).toContain('1 ч 30 мин · 25 €');
    expect(text).toContain('Поздняя отмена нет');
    expect(text).toContain('Напоминания за 1 ч');
    expect(text).toContain('напомнить за 6 ч');

    buttonByText(host, 'Изменить: Часовой пояс').click();
    expect(edit).toHaveBeenCalledWith('time');
  });

  it('lists the reminders and the late cancellations as saved', async () => {
    const fixture = await renderStep(SetupDonePreview, { saved: savedSetup() });
    const text = readableText(hostElement(fixture));
    expect(text).toContain('за 24 ч и за 1 ч');
    expect(text).toContain('Teacher Box ·');
  });

  it('shows nothing before the server answers', async () => {
    const fixture = await renderStep(SetupDonePreview, { saved: null });
    expect(hostElement(fixture).querySelectorAll('.tb-tile')).toHaveLength(0);
  });
});
