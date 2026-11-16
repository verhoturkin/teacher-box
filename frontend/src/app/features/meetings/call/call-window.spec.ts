import { Confirm } from '@shared/ui/confirm';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement } from '@testing/dom';
import { aMediaRef, aParticipant } from '@testing/meetings-fixtures';
import { testProviders } from '@testing/setup';
import { CallSession } from './call-session';
import { CallWindow } from './call-window';

describe('CallWindow', () => {
  let fixture: ComponentFixture<CallWindow>;
  let session: CallSession;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [CallWindow], providers: testProviders() });
    session = TestBed.inject(CallSession);
    session.target.set({ ownerId: 'g-1', title: 'ОГЭ' });
    session.phase.set('connected');
    session.participants.set([aParticipant()]);
    fixture = TestBed.createComponent(CallWindow);
    fixture.componentRef.setInput('elapsed', '1:05');
    await fixture.whenStable();
    host = hostElement(fixture);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('is a named dialog with the time, the people and the focus on its title', () => {
    expect(host.getAttribute('role')).toBe('dialog');
    expect(host.querySelector('h2')?.textContent.trim()).toBe('ОГЭ');
    expect(document.activeElement).toBe(host.querySelector('h2'));
    expect(host.textContent).toContain('1:05 · 1 участник');
    expect(host.textContent).toContain('Пока в комнате только вы');
    expect(host.querySelector('.tb-call-stage--alone')).not.toBeNull();
  });

  it('lays out a pair, a grid and a shared screen', async () => {
    const anna = aParticipant({ id: 'a', name: 'Анна', local: false });
    session.participants.set([aParticipant(), anna]);
    await fixture.whenStable();
    expect(host.querySelector('tb-call-self')).not.toBeNull();

    session.participants.set([aParticipant(), anna, aParticipant({ id: 'b', local: false })]);
    await fixture.whenStable();
    const tiles = host.querySelector<HTMLElement>('.tb-call-stage__tiles');
    expect(tiles?.style.getPropertyValue('--tb-call-columns')).toBe('2');
    expect(host.querySelectorAll('tb-call-tile')).toHaveLength(3);

    session.participants.set([aParticipant(), { ...anna, screen: aMediaRef('s') }]);
    await fixture.whenStable();
    expect(host.querySelector('.tb-call-stage--screen')).not.toBeNull();
    expect(host.textContent).toContain('Экран: Анна');
  });

  it('unblocks the sound and says when the connection is restored', async () => {
    const start = vi.spyOn(session, 'startAudio').mockResolvedValue();
    session.audioBlocked.set(true);
    session.phase.set('reconnecting');
    session.announcement.set('Анна в звонке');
    await fixture.whenStable();

    buttonByText(host, 'Включить звук').click();
    expect(start).toHaveBeenCalled();
    expect(host.textContent).toContain('Связь прервалась, переподключаемся…');
    expect(host.querySelector('.tb-sr-only')?.textContent).toBe('Анна в звонке');
  });

  it('shows the connection and the end of the call', async () => {
    session.phase.set('connecting');
    await fixture.whenStable();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Подключение к звонку…');
    expect(host.querySelector('tb-loading-indicator')).not.toBeNull();

    const retry = vi.spyOn(session, 'retry').mockImplementation(() => undefined);
    const close = vi.spyOn(session, 'close').mockImplementation(() => undefined);
    session.phase.set('ended');
    session.endText.set('Связь со звонком потеряна.');
    await fixture.whenStable();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Связь со звонком потеряна.');
    buttonByText(host, 'Войти снова').click();
    buttonByText(host, 'Закрыть').click();
    expect(retry).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('opens the chat beside the call and sends a message from the field', async () => {
    expect(host.querySelector('tb-call-chat')).toBeNull();
    session.chatOpen.set(true);
    await fixture.whenStable();
    const chat = host.querySelector<HTMLElement>('tb-call-chat');
    const field = host.querySelector<HTMLInputElement>('.tb-call-chat__field');
    expect(host.classList).toContain('tb-call-window--chat');
    expect(chat?.textContent).toContain('Сообщения видят только участники звонка');
    expect(document.activeElement).toBe(field);

    const send = vi
      .spyOn(session, 'sendMessage')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    if (field === null) {
      throw new Error('no field');
    }
    const button = host.querySelector<HTMLButtonElement>('.tb-call-chat__send button');
    expect(button?.disabled).toBe(true);
    field.value = 'Привет';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(button?.disabled).toBe(false);
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(send).toHaveBeenCalledWith('Привет');
    expect(field.value).toBe('');
    field.value = 'Ещё';
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(field.value).toBe('Ещё');

    session.messages.set([
      { id: 1, from: 'Анна', text: 'Здравствуйте', mine: false },
      { id: 2, from: 'Ольга', text: 'Привет', mine: true },
    ]);
    await fixture.whenStable();
    const lines = [...host.querySelectorAll('.tb-call-chat__message')].map((line) => [
      line.querySelector('.tb-call-chat__from')?.textContent,
      line.querySelector('.tb-call-chat__text')?.textContent,
    ]);
    expect(lines).toEqual([
      ['Анна', 'Здравствуйте'],
      ['Вы', 'Привет'],
    ]);
    expect(host.querySelector('.tb-call-chat__message--mine')).not.toBeNull();

    host.querySelector<HTMLButtonElement>('button[aria-label="Закрыть чат"]')?.click();
    await fixture.whenStable();
    expect(host.querySelector('tb-call-chat')).toBeNull();
  });

  it('sends one message at a time', async () => {
    session.chatOpen.set(true);
    await fixture.whenStable();
    let done: (sent: boolean) => void = () => undefined;
    const send = vi
      .spyOn(session, 'sendMessage')
      .mockReturnValue(new Promise((resolve) => (done = resolve)));
    const form = host.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    done(true);
    await fixture.whenStable();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('minimizes on Esc', async () => {
    const minimize = vi.spyOn(session, 'minimize');
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(minimize).toHaveBeenCalled();
  });

  it('removes a participant only after the teacher confirms', async () => {
    const confirm = vi.spyOn(TestBed.inject(Confirm), 'danger');
    const remove = vi.spyOn(session, 'removeParticipant').mockImplementation(() => undefined);
    const anna = aParticipant({ id: 'a', name: 'Анна', local: false });
    const window = fixture.componentInstance;

    confirm.mockResolvedValueOnce(false);
    await window.remove(anna);
    expect(remove).not.toHaveBeenCalled();

    confirm.mockResolvedValueOnce(true);
    await window.remove(anna);
    expect(remove).toHaveBeenCalledWith('a');
    expect(confirm.mock.lastCall?.[0].message).toContain('Анна');
  });
});

describe('CallWindow in Picture-in-Picture', () => {
  it('floats over other windows with the compact controls and comes back on close', async () => {
    const floating = Object.assign(new EventTarget(), {
      document: document.implementation.createHTMLDocument(),
      close: vi.fn(() => floating.dispatchEvent(new Event('pagehide'))),
    });
    const requestWindow = vi.fn(() => Promise.resolve(floating));
    vi.stubGlobal('documentPictureInPicture', { requestWindow });
    TestBed.configureTestingModule({ imports: [CallWindow], providers: testProviders() });
    const session = TestBed.inject(CallSession);
    session.phase.set('connected');
    session.participants.set([aParticipant()]);
    const fixture = TestBed.createComponent(CallWindow);
    const place = document.createElement('div');
    const host = hostElement(fixture);
    place.append(host);
    await fixture.whenStable();
    const button = (label: string): HTMLButtonElement | null =>
      host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

    button('Поверх других окон')?.click();
    await fixture.whenStable();
    expect(requestWindow).toHaveBeenCalled();
    expect(floating.document.body.firstChild).toBe(host);
    expect(floating.document.head.querySelectorAll('style').length).toBe(
      document.styleSheets.length,
    );
    expect(host.classList).toContain('tb-call-window--pip');
    expect(button('Свернуть')).toBeNull();

    button('Вернуть во вкладку')?.click();
    await fixture.whenStable();
    expect(floating.close).toHaveBeenCalled();
    expect(place.firstChild).toBe(host);
    expect(session.pip()).toBe(false);

    button('Поверх других окон')?.click();
    await fixture.whenStable();
    fixture.destroy();
    expect(floating.close).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
