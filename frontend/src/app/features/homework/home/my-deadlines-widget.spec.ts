import { formatDate } from '@angular/common';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { myHomeworkSummary, myTask } from '@testing/homework-fixtures';
import { testProviders } from '@testing/setup';
import { MyHomeworkSummary, MyTask } from '../data-access/homework.models';
import { MyDeadlinesWidget } from './my-deadlines-widget';

describe('MyDeadlinesWidget', () => {
  let fixture: ComponentFixture<MyDeadlinesWidget>;
  let backend: HttpTestingController;

  async function render(summary: MyHomeworkSummary, tasks: MyTask[] | null = []): Promise<void> {
    TestBed.configureTestingModule({ imports: [MyDeadlinesWidget], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyDeadlinesWidget);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    const request = backend.expectOne('/api/me/homework');
    if (tasks === null) {
      request.flush(null, { status: 500, statusText: 'Error' });
    } else {
      request.flush(tasks);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('says when nothing is open and hides the reviewed ones', async () => {
    await render(myHomeworkSummary());

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Открытых заданий нет');
    expect(text).not.toContain('Проверено недавно');
  });

  it('lists open tasks with «Открыть» and «Исправить»', async () => {
    await render(
      myHomeworkSummary({
        open: 3,
        upcoming: [
          myTask({ title: 'Вчера', overdue: true }),
          myTask({ taskId: 't-2', title: 'Доработать', status: 'RETURNED' }),
          myTask({ taskId: 't-3', title: 'Когда-нибудь', dueAt: null }),
        ],
      }),
    );

    const text = readableText(hostElement(fixture));
    // Deadlines are shown in the time zone of the browser.
    const due = formatDate('2026-09-10T15:00:00Z', 'dd.MM.yyyy HH:mm', 'en-US');
    expect(text).toContain(`Вчера до ${due} · Просрочено Открыть`);
    expect(text).toContain(`Доработать до ${due} Исправить`);
    expect(text).toContain('Когда-нибудь без срока');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    buttonByText(hostElement(fixture), 'Исправить').click();
    expect(navigate).toHaveBeenCalledWith(['/cabinet/homework', 't-2']);
  });

  it('shows the three latest reviewed tasks with their grades', async () => {
    const reviewed = (id: string, day: string, grade: string | null): MyTask =>
      myTask({
        taskId: id,
        title: `Работа ${id}`,
        status: 'ACCEPTED',
        grade,
        reviewedAt: `2026-09-${day}T10:00:00Z`,
      });
    await render(myHomeworkSummary(), [
      reviewed('a', '01', '3'),
      reviewed('b', '04', null),
      reviewed('c', '03', '5'),
      reviewed('d', '02', '4'),
      myTask({ taskId: 'e', title: 'Открытая', status: 'SUBMITTED' }),
    ]);

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Проверено недавно');
    expect(text.indexOf('Работа b')).toBeLessThan(text.indexOf('Работа c'));
    expect(text).toContain('Принято · 5');
    expect(text).not.toContain('Работа a');
    expect(text).not.toContain('Открытая');
  });

  it('hides the reviewed ones when their list failed to load', async () => {
    await render(myHomeworkSummary(), null);

    expect(readableText(hostElement(fixture))).not.toContain('Проверено недавно');
  });
});
