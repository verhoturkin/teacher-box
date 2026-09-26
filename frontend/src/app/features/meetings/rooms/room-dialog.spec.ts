import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Clipboard } from '@angular/cdk/clipboard';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText } from '@testing/dom';
import { aRoom } from '@testing/meetings-fixtures';
import { MeetingRoom } from '../data-access/meetings.models';
import { RoomDialog } from './room-dialog';

describe('RoomDialog', () => {
  let fixture: ComponentFixture<RoomDialog>;
  let backend: HttpTestingController;
  let changes: (MeetingRoom | null)[];
  let add: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RoomDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    add = vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(RoomDialog);
    changes = [];
    fixture.componentInstance.changed.subscribe((room) => changes.push(room));
    fixture.componentRef.setInput('owner', { type: 'STUDENT', id: 's-1', name: 'Мария' });
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(room: MeetingRoom | null, canCreate: boolean): Promise<RoomDialog> {
    fixture.componentRef.setInput('room', room);
    fixture.componentRef.setInput('canCreate', canCreate);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('creates a Telemost meeting for a student without a room', async () => {
    const dialog = await open(null, true);
    expect(bodyText()).toContain('ученик приходит на все уроки');

    buttonByText(document.body, 'Создать встречу в Телемосте').click();
    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/meetings/rooms' });
    expect(request.request.body).toEqual({ studentId: 's-1', groupId: null });
    request.flush(aRoom({ ownerId: 's-1' }));

    expect(changes).toEqual([aRoom({ ownerId: 's-1' })]);
    expect(dialog.visible()).toBe(false);
  });

  it('saves a pasted link', async () => {
    const dialog = await open(null, false);
    expect(bodyText()).not.toContain('Создать встречу в Телемосте');

    dialog.link.setValue('zoom');
    await fixture.whenStable();
    expect(bodyText()).toContain('Ссылка должна начинаться с http:// или https://');
    dialog.save();
    backend.expectNone('/api/teacher/meetings/rooms');

    dialog.link.setValue(' https://zoom.us/j/1 ');
    dialog.save();
    backend.expectOne({ method: 'PUT', url: '/api/teacher/meetings/rooms' }).flush(aRoom({ telemost: false }));
    expect(changes).toHaveLength(1);
  });

  it('copies, sends and removes a room', async () => {
    const room = aRoom({ ownerId: 's-1' });
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
    await open(room, true);
    expect(bodyText()).toContain('Новая встреча в Телемосте');

    buttonByText(document.body, 'Копировать ссылку').click();
    expect(copy).toHaveBeenCalledWith(room.joinUrl);
    buttonByText(document.body, 'Отправить ученику').click();
    backend.expectOne('/api/teacher/meetings/rooms/s-1/share').flush({ recipients: 1 });
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Получателей: 1' }));
    expect(fixture.componentInstance.visible()).toBe(true);

    buttonByText(document.body, 'Удалить').click();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/meetings/rooms/s-1' }).flush(null);
    expect(changes).toEqual([null]);
  });

  it('explains why a meeting was not created', async () => {
    fixture.componentRef.setInput('owner', { type: 'GROUP', id: 'g-1', name: 'ОГЭ' });
    await open(aRoom({ ownerId: 'g-1', ownerType: 'GROUP' }), true);
    expect(bodyText()).toContain('Отправить группе');

    buttonByText(document.body, 'Новая встреча в Телемосте').click();
    backend
      .expectOne('/api/teacher/meetings/rooms')
      .flush({ status: 422, code: 'meetings.reconnect' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Яндекс больше не принимает доступ портала');
    expect(changes).toEqual([]);
  });
});
