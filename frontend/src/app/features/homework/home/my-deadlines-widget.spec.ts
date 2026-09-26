import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { hostElement, readableText } from '@testing/dom';
import { myHomeworkSummary, myTask } from '@testing/homework-fixtures';
import { MyHomeworkSummary } from '../data-access/homework.models';
import { MyDeadlinesWidget } from './my-deadlines-widget';

describe('MyDeadlinesWidget', () => {
  let fixture: ComponentFixture<MyDeadlinesWidget>;

  async function render(summary: MyHomeworkSummary): Promise<void> {
    TestBed.configureTestingModule({ imports: [MyDeadlinesWidget], providers: [provideRouter([]), providePrimeNG()] });
    fixture = TestBed.createComponent(MyDeadlinesWidget);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('says when nothing is open', async () => {
    await render(myHomeworkSummary());

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Открытых заданий нет');
    expect(text).toContain('Открыто: 0 Все задания');
  });

  it('lists open tasks by deadline', async () => {
    await render(
      myHomeworkSummary({
        open: 3,
        overdue: 1,
        upcoming: [
          myTask({ title: 'Вчера', overdue: true }),
          myTask({ taskId: 't-2', title: 'Доработать', status: 'RETURNED' }),
          myTask({ taskId: 't-3', title: 'Когда-нибудь', dueAt: null }),
        ],
      }),
    );

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Вчера Просрочено до');
    expect(text).toContain('Доработать На доработку до');
    expect(text).toContain('Когда-нибудь без срока');
    expect(text).toContain('Открыто: 3, просрочено: 1');
    expect(hostElement(fixture).querySelector('a')?.getAttribute('href')).toBe('/cabinet/homework/t-1');
  });
});
