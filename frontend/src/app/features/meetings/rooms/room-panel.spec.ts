import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Clipboard } from '@angular/cdk/clipboard';
import { MessageService } from 'primeng/api';
import { buttonByText, hostElement } from '@testing/dom';
import { aRoom, yandexStatus } from '@testing/meetings-fixtures';
import { MeetingRoom, RoomOwnerRef } from '../data-access/meetings.models';
import { RoomPanel } from './room-panel';
import { testProviders } from '@testing/setup';

const MARIA: RoomOwnerRef = { type: 'STUDENT', id: 's-1', name: 'Мария' };

describe('RoomPanel', () => {
  let fixture: ComponentFixture<RoomPanel>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let add: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RoomPanel], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    add = vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(RoomPanel);
    host = hostElement(fixture);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function show(
    rooms: MeetingRoom[],
    connected: boolean,
    owner: RoomOwnerRef = MARIA,
  ): Promise<RoomPanel> {
    fixture.componentRef.setInput('owner', owner);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/meetings/rooms').flush(rooms);
    backend
      .expectOne('/api/teacher/meetings/yandex')
      .flush(yandexStatus({ status: connected ? 'CONNECTED' : 'NOT_CONNECTED' }));
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('shows nothing without an owner', async () => {
    await fixture.whenStable();
    expect(host.textContent.trim()).toBe('');
  });

  it('creates a Telemost meeting for a student without a room', async () => {
    await show([aRoom({ ownerId: 'other' })], true);
    expect(host.textContent).toContain('ученик приходит');

    buttonByText(host, 'Создать встречу в Телемосте').click();
    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/meetings/rooms' });
    expect(request.request.body).toEqual({ studentId: 's-1', groupId: null });
    request.flush(aRoom({ ownerId: 's-1' }));
    await fixture.whenStable();

    expect(host.textContent).toContain('telemost.yandex.ru/j/');
    expect(host.textContent).toContain('Новая встреча в Телемосте');
  });

  it('saves a pasted link', async () => {
    const panel = await show([], false);
    expect(host.textContent).not.toContain('Создать встречу в Телемосте');

    panel.link.setValue('zoom');
    await fixture.whenStable();
    expect(host.textContent).toContain('Ссылка должна начинаться с http:// или https://');
    panel.save();
    backend.expectNone('/api/teacher/meetings/rooms');

    panel.link.setValue(' https://zoom.us/j/1 ');
    await fixture.whenStable();
    buttonByText(host, 'Добавить ссылку').click();
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/meetings/rooms' });
    expect(request.request.body).toEqual({
      studentId: 's-1',
      groupId: null,
      joinUrl: 'https://zoom.us/j/1',
    });
    request.flush(aRoom({ ownerId: 's-1', telemost: false, joinUrl: 'https://zoom.us/j/1' }));
    await fixture.whenStable();
    expect(host.textContent).toContain('https://zoom.us/j/1');
    expect(panel.link.value).toBe('');
  });

  it('saves the link with Enter', async () => {
    const panel = await show([], false);
    panel.link.setValue('https://zoom.us/j/2');
    host
      .querySelector('#room-link')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/meetings/rooms' })
      .flush(aRoom({ ownerId: 's-1' }));
  });

  it('copies, sends and removes a room', async () => {
    const room = aRoom({ ownerId: 's-1' });
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
    await show([room], true);
    expect(host.textContent).toContain('Заменить ссылку');

    buttonByText(host, 'Копировать ссылку').click();
    expect(copy).toHaveBeenCalledWith(room.joinUrl);
    buttonByText(host, 'Отправить ученику').click();
    backend.expectOne('/api/teacher/meetings/rooms/s-1/share').flush({ recipients: 1 });
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Ссылка отправлена, получателей: 1' }),
    );

    buttonByText(host, 'Удалить ссылку').click();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/meetings/rooms/s-1' }).flush(null);
    await fixture.whenStable();
    expect(host.textContent).not.toContain('Удалить ссылку');
    expect(host.textContent).toContain('Добавить ссылку');
  });

  it('explains why a meeting was not created', async () => {
    await show([aRoom({ ownerId: 'g-1', ownerType: 'GROUP' })], true, {
      type: 'GROUP',
      id: 'g-1',
      name: 'ОГЭ',
    });
    expect(host.textContent).toContain('Отправить группе');

    buttonByText(host, 'Новая встреча в Телемосте').click();
    backend
      .expectOne('/api/teacher/meetings/rooms')
      .flush(
        { status: 422, code: 'meetings.reconnect' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    expect(host.textContent).toContain('Яндекс больше не принимает доступ портала');
  });

  it('says when the room could not be loaded', async () => {
    fixture.componentRef.setInput('owner', MARIA);
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/meetings/rooms')
      .flush(null, { status: 500, statusText: 'Error' });
    expect(backend.expectOne('/api/teacher/meetings/yandex').cancelled).toBe(true);
    await fixture.whenStable();

    expect(host.textContent).toContain('Не удалось загрузить видеовстречу');
  });

  it('ignores the answer for an owner that is no longer shown', async () => {
    fixture.componentRef.setInput('owner', MARIA);
    await fixture.whenStable();
    const stale = backend.expectOne('/api/teacher/meetings/rooms');
    const staleYandex = backend.expectOne('/api/teacher/meetings/yandex');
    fixture.componentRef.setInput('owner', { type: 'STUDENT', id: 's-2', name: 'Борис' });
    await fixture.whenStable();
    stale.flush([aRoom({ ownerId: 's-1' })]);
    staleYandex.flush(yandexStatus());
    backend.expectOne('/api/teacher/meetings/rooms').flush([]);
    backend.expectOne('/api/teacher/meetings/yandex').flush(yandexStatus());
    await fixture.whenStable();

    expect(host.textContent).not.toContain('telemost.yandex.ru/j/');
  });
});
