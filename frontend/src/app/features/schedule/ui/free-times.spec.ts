import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { FreeTimes } from './free-times';

describe('FreeTimes', () => {
  let fixture: ComponentFixture<FreeTimes>;
  let backend: HttpTestingController;
  const at = (hours: number, minutes = 0): Date => new Date(2030, 9, 2, hours, minutes);
  const URL = '/api/me/schedule/free-times?date=2030-10-02&lessonId=l-1';

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FreeTimes], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FreeTimes);
    fixture.componentRef.setInput('lessonId', 'l-1');
    fixture.componentRef.setInput('date', at(9));
    fixture.componentRef.setInput('minutes', 60);
  });

  afterEach(() => {
    backend.verify();
  });

  async function load(url: string, starts: Date[]): Promise<void> {
    fixture.detectChanges();
    backend.expectOne(url).flush(starts.map((start) => start.toISOString()));
    await fixture.whenStable();
  }

  it('collapses consecutive starts into windows and picks the start of one', async () => {
    const picked: Date[] = [];
    fixture.componentInstance.picked.subscribe((time) => picked.push(time));
    await load(URL, [
      at(9),
      at(9, 15),
      at(9, 30),
      at(9, 45),
      at(10),
      at(10, 15),
      at(10, 30),
      at(13),
    ]);

    const buttons = hostElement(fixture).querySelectorAll('button');
    expect(Array.from(buttons, (button) => button.textContent.trim())).toEqual([
      '09:00–11:30',
      '13:00–14:00',
    ]);
    buttonByText(hostElement(fixture), '13:00–14:00').click();

    expect(picked).toEqual([at(13)]);
  });

  it('says when the typed time fits no window, and only then', async () => {
    fixture.componentRef.setInput('selected', at(11));
    await load(URL, [at(9), at(9, 15), at(10)]);
    expect(readableText(hostElement(fixture))).toContain('Это время занято');

    fixture.componentRef.setInput('selected', at(9, 10));
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).not.toContain('Это время занято');
  });

  it('uses the teacher endpoint and draws nothing for a day without free time or on a failure', async () => {
    fixture.componentRef.setInput('asTeacher', true);
    await load('/api/teacher/schedule/free-times?date=2030-10-02&lessonId=l-1', []);
    expect(hostElement(fixture).querySelector('button')).toBeNull();

    fixture.componentRef.setInput('date', new Date(2030, 9, 3));
    fixture.detectChanges();
    backend
      .expectOne('/api/teacher/schedule/free-times?date=2030-10-03&lessonId=l-1')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('button')).toBeNull();
    expect(readableText(hostElement(fixture))).not.toContain('Это время занято');
  });
});
