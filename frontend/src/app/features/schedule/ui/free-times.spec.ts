import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { FreeTimes } from './free-times';

describe('FreeTimes', () => {
  let fixture: ComponentFixture<FreeTimes>;
  let backend: HttpTestingController;
  const slot = new Date(2026, 9, 2, 17, 15);

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FreeTimes], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FreeTimes);
    fixture.componentRef.setInput('lessonId', 'l-1');
    fixture.componentRef.setInput('date', slot);
  });

  afterEach(() => {
    backend.verify();
  });

  it('asks the student endpoint for the day and offers the times as chips', async () => {
    const picked: Date[] = [];
    fixture.componentInstance.picked.subscribe((time) => picked.push(time));
    fixture.detectChanges();
    const request = backend.expectOne('/api/me/schedule/free-times?date=2026-10-02&lessonId=l-1');
    request.flush([slot.toISOString()]);
    await fixture.whenStable();

    buttonByText(hostElement(fixture), '17:15').click();

    expect(picked).toEqual([slot]);
  });

  it('uses the teacher endpoint and draws nothing for a day without free time or on a failure', async () => {
    fixture.componentRef.setInput('asTeacher', true);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/schedule/free-times?date=2026-10-02&lessonId=l-1').flush([]);
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('button')).toBeNull();

    fixture.componentRef.setInput('date', new Date(2026, 9, 3));
    fixture.detectChanges();
    backend
      .expectOne('/api/teacher/schedule/free-times?date=2026-10-03&lessonId=l-1')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('button')).toBeNull();
  });
});
