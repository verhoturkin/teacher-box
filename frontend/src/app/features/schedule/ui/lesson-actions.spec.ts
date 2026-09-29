import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { ChangeKind } from '../data-access/schedule.models';
import { LessonActions } from './lesson-actions';

describe('LessonActions', () => {
  let fixture: ComponentFixture<LessonActions>;
  let asked: ChangeKind[];

  async function render(inputs: {
    joinUrl?: string | null;
    group?: boolean;
    requests?: boolean;
    stacked?: boolean;
  }): Promise<HTMLElement> {
    TestBed.configureTestingModule({ imports: [LessonActions], providers: testProviders() });
    fixture = TestBed.createComponent(LessonActions);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    asked = [];
    fixture.componentInstance.ask.subscribe((kind) => asked.push(kind));
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('shows the meeting and both requests in a row', async () => {
    const host = await render({ joinUrl: 'https://telemost.yandex.ru/j/1' });

    expect(readableText(host)).toContain('Войти в урок');
    expect(host.style.display).toBe('contents');
    buttonByText(host, 'Перенести').click();
    buttonByText(host, 'Отменить').click();
    expect(asked).toEqual(['RESCHEDULE', 'CANCEL']);
    expect(host.querySelector('p-button.tb-button-steady')).not.toBeNull();
  });

  it('says «Не приду» for a group lesson and hides the requests when they are not allowed', async () => {
    const host = await render({ group: true });
    expect(readableText(host)).toContain('Не приду');

    fixture.componentRef.setInput('requests', false);
    await fixture.whenStable();
    expect(readableText(host)).not.toContain('Перенести');
  });

  it('stacks the meeting over a connected group of the requests', async () => {
    const host = await render({ joinUrl: 'https://telemost.yandex.ru/j/1', stacked: true });

    expect(host.classList).toContain('tb-lesson-actions--stacked');
    expect(host.style.display).toBe('flex');
    const group = requireElement(host, '.tb-button-group[role="group"]', HTMLElement);
    expect(group.querySelectorAll('p-button')).toHaveLength(2);
    expect(group.querySelector('p-button.tb-tonal')?.textContent).toContain('Отменить');
    expect(group.querySelector('p-button.tb-button-steady')).toBeNull();
  });
});
