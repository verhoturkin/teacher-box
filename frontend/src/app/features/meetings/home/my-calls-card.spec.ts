import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { CallSession } from '../call/call-session';
import { MyCall } from '../data-access/meetings.models';
import { MY_CALLS_REFRESH_MS, MyCallsCard } from './my-calls-card';

const OWN: MyCall = { ownerId: 's-1', ownerType: 'STUDENT', title: 'Урок', teacherPresent: false };
const GROUP: MyCall = { ownerId: 'g-1', ownerType: 'GROUP', title: 'ОГЭ', teacherPresent: true };

describe('MyCallsCard', () => {
  let fixture: ComponentFixture<MyCallsCard>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    TestBed.configureTestingModule({ imports: [MyCallsCard], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyCallsCard);
    host = hostElement(fixture);
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    vi.useRealTimers();
  });

  async function flush(calls: MyCall[]): Promise<void> {
    backend.expectOne('/api/me/meetings/calls').flush(calls);
    await fixture.whenStable();
  }

  it('lists the rooms, says whether the teacher is there and joins', async () => {
    fixture.detectChanges();
    await flush([OWN, GROUP]);
    const open = vi.spyOn(TestBed.inject(CallSession), 'open').mockImplementation(() => undefined);

    expect(host.textContent).toContain('Учитель пока не в звонке');
    expect(host.textContent).toContain('Учитель уже в звонке');
    buttonByText(host, 'Войти в звонок: ОГЭ').click();
    expect(open).toHaveBeenCalledWith('g-1');
  });

  it('is hidden while calls are off and refreshes quietly', async () => {
    fixture.detectChanges();
    await flush([]);
    expect(host.textContent.trim()).toBe('');

    vi.advanceTimersByTime(MY_CALLS_REFRESH_MS);
    await flush([GROUP]);
    expect(host.textContent).toContain('ОГЭ');

    vi.advanceTimersByTime(MY_CALLS_REFRESH_MS);
    backend
      .expectOne('/api/me/meetings/calls')
      .flush(null, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(host.textContent).toContain('ОГЭ');
  });

  it('offers to retry a failed load', async () => {
    fixture.detectChanges();
    backend.expectOne('/api/me/meetings/calls').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    buttonByText(host, 'Повторить').click();
    await flush([OWN]);
    expect(host.textContent).toContain('Урок');
  });
});
