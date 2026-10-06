import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { CallSession } from '../call/call-session';
import { CallCard, CallsOverview } from '../data-access/meetings.models';
import { CALLS_REFRESH_MS, CallsPage } from './calls-page';

function room(overrides: Partial<CallCard> = {}): CallCard {
  return {
    ownerId: 's-1',
    ownerType: 'STUDENT',
    name: 'Анна Смирнова',
    members: 1,
    waiting: [],
    teacherPresent: false,
    externalLink: false,
    ...overrides,
  };
}

describe('CallsPage', () => {
  let fixture: ComponentFixture<CallsPage>;
  let backend: HttpTestingController;
  let session: CallSession;
  let host: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    TestBed.configureTestingModule({ imports: [CallsPage], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(CallSession);
    fixture = TestBed.createComponent(CallsPage);
    host = hostElement(fixture);
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    vi.useRealTimers();
  });

  async function show(overview: CallsOverview): Promise<string> {
    fixture.detectChanges();
    backend.expectOne('/api/teacher/meetings/calls').flush(overview);
    await fixture.whenStable();
    return readableText(host);
  }

  it('shows every room with its status and joins one', async () => {
    const text = await show({
      status: 'OK',
      rooms: [
        room(),
        room({ ownerId: 's-2', name: 'Борис', waiting: ['Борис'], externalLink: true }),
        room({ ownerId: 'g-1', ownerType: 'GROUP', name: 'ОГЭ', members: 3, teacherPresent: true }),
      ],
    });
    const open = vi.spyOn(session, 'open').mockImplementation(() => undefined);

    expect(text).toContain('Пусто');
    expect(text).toContain('Комната ученика');
    expect(text).toContain('Ждут: 1');
    expect(text).toContain('В звонке: Борис · в занятиях — своя ссылка');
    expect(text).toContain('Вы в звонке');
    expect(text).toContain('Группа, 3 ученика');
    expect(host.querySelector('.tb-avatar')?.textContent.trim()).toBe('АС');
    buttonByText(host, 'Войти в звонок: Борис').click();
    expect(open).toHaveBeenCalledWith('s-2');
  });

  it('expands the call of this tab instead of joining', async () => {
    session.target.set({ ownerId: 's-1', title: 'Анна' });
    session.phase.set('connected');
    await show({ status: 'OK', rooms: [room()] });
    const expand = vi.spyOn(session, 'expand');

    buttonByText(host, 'Развернуть звонок: Анна Смирнова').click();

    expect(expand).toHaveBeenCalled();
    expect(readableText(host)).toContain('Вы в звонке');
  });

  it('says when calls are off, when the server is silent and when there is nobody', async () => {
    expect(await show({ status: 'OFF', rooms: [] })).toContain('Звонки в портале не настроены');

    vi.advanceTimersByTime(CALLS_REFRESH_MS);
    backend
      .expectOne('/api/teacher/meetings/calls')
      .flush({ status: 'UNREACHABLE', rooms: [room()] });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Сервер звонков не отвечает');

    vi.advanceTimersByTime(CALLS_REFRESH_MS);
    backend.expectOne('/api/teacher/meetings/calls').flush({ status: 'OK', rooms: [] });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Пока нет учеников и групп');

    vi.advanceTimersByTime(CALLS_REFRESH_MS);
    backend
      .expectOne('/api/teacher/meetings/calls')
      .flush(null, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Пока нет учеников и групп');
  });

  it('does not refresh a hidden page, catches up when it is shown again, retries', async () => {
    fixture.detectChanges();
    backend
      .expectOne('/api/teacher/meetings/calls')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    vi.advanceTimersByTime(CALLS_REFRESH_MS);
    document.dispatchEvent(new Event('visibilitychange'));
    backend.expectNone('/api/teacher/meetings/calls');
    visibility.mockRestore();

    buttonByText(host, 'Повторить').click();
    backend
      .expectOne('/api/teacher/meetings/calls')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    document.dispatchEvent(new Event('visibilitychange'));
    backend
      .expectOne('/api/teacher/meetings/calls')
      .flush({ status: 'OK', rooms: [room({ waiting: [' '] })] });
    await fixture.whenStable();
    expect(readableText(host)).toContain('В звонке: Участник');
  });
});
