import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { Snackbar } from '@core/snackbar/snackbar';
import { CallCard, CallsOverview } from '../data-access/meetings.models';
import { CallSummon, SUMMON_REFRESH_MS } from './call-summon';

function aCard(overrides: Partial<CallCard> = {}): CallCard {
  return {
    ownerId: 'student-1',
    ownerType: 'STUDENT',
    name: 'Ира Смирнова',
    members: 1,
    waiting: [],
    teacherPresent: true,
    externalLink: false,
    avatar: null,
    ...overrides,
  };
}

describe('CallSummon', () => {
  let fixture: ComponentFixture<CallSummon>;
  let backend: HttpTestingController;

  async function render(calls: CallsOverview | null, ownerId = 'student-1'): Promise<void> {
    TestBed.configureTestingModule({ imports: [CallSummon], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CallSummon);
    fixture.componentRef.setInput('ownerId', ownerId);
    await answer(calls);
  }

  async function answer(calls: CallsOverview | null): Promise<void> {
    await fixture.whenStable();
    const request = backend.expectOne('/api/teacher/meetings/calls');
    if (calls === null) {
      request.flush(null, { status: 503, statusText: 'Unavailable' });
    } else {
      request.flush(calls);
    }
    await fixture.whenStable();
  }

  function text(): string {
    return readableText(hostElement(fixture));
  }

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
    backend.verify();
  });

  it('calls a student who is not in the call', async () => {
    await render({ status: 'OK', rooms: [aCard()] });
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');

    expect(text()).toContain('Ира ещё не в звонке');
    buttonByText(hostElement(fixture), 'Позвать').click();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/meetings/calls/student-1/summon' })
      .flush({ recipients: 1 });

    expect(success).toHaveBeenCalledWith('Ученику отправлено приглашение');
  });

  it('calls the rest of a group', async () => {
    const group = aCard({
      ownerId: 'g-1',
      ownerType: 'GROUP',
      name: 'ОГЭ',
      members: 3,
      waiting: ['Анна'],
    });
    await render({ status: 'OK', rooms: [group] }, 'g-1');
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');

    expect(text()).toContain('Ещё не в звонке: 2 из 3');
    buttonByText(hostElement(fixture), 'Позвать остальных').click();
    backend.expectOne('/api/teacher/meetings/calls/g-1/summon').flush({ recipients: 2 });

    expect(success).toHaveBeenCalledWith('Приглашение отправлено, учеников: 2');
  });

  it('shows nothing while everyone is in or the presence is unknown', async () => {
    await render({ status: 'OK', rooms: [aCard({ waiting: ['Ира'] })] });
    expect(text()).toBe('');

    fixture.destroy();
    TestBed.resetTestingModule();
    await render({ status: 'OK', rooms: [aCard({ externalLink: true })] });
    expect(text()).toBe('');

    fixture.destroy();
    TestBed.resetTestingModule();
    await render({ status: 'UNREACHABLE', rooms: [aCard()] });
    expect(text()).toBe('');

    fixture.destroy();
    TestBed.resetTestingModule();
    await render(null);
    expect(text()).toBe('');
  });

  it('asks for the presence again while it is shown', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await render({ status: 'OK', rooms: [aCard()] });

    vi.advanceTimersByTime(SUMMON_REFRESH_MS);
    await answer({ status: 'OK', rooms: [aCard({ waiting: ['Ира'] })] });

    expect(text()).toBe('');
  });
});
