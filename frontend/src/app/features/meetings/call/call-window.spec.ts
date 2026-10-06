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

  it('minimizes on Esc', async () => {
    const minimize = vi.spyOn(session, 'minimize');
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(minimize).toHaveBeenCalled();
  });
});
