import { Clipboard } from '@angular/cdk/clipboard';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { aRoom } from '@testing/meetings-fixtures';
import { testProviders } from '@testing/setup';
import { Snackbar } from '@core/snackbar/snackbar';
import { CallsStatus, MeetingRoom } from '../data-access/meetings.models';
import { RoomLink } from './room-link';

describe('RoomLink', () => {
  let fixture: ComponentFixture<RoomLink>;
  let backend: HttpTestingController;

  async function render(rooms: MeetingRoom[], calls: CallsStatus | null): Promise<void> {
    TestBed.configureTestingModule({ imports: [RoomLink], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RoomLink);
    fixture.componentRef.setInput('owner', { type: 'STUDENT', id: 'student-1', name: 'Мария' });
    await fixture.whenStable();
    backend.expectOne('/api/teacher/meetings/rooms').flush(rooms);
    const status = backend.expectOne('/api/teacher/meetings/calls');
    if (calls === null) {
      status.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      status.flush({ status: calls, rooms: [] });
    }
    await fixture.whenStable();
  }

  function text(): string {
    return readableText(hostElement(fixture));
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows the external link of the student and copies it', async () => {
    await render([aRoom({ ownerId: 'other', joinUrl: 'https://zoom.us/j/1' }), aRoom()], 'OK');
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');

    expect(text()).toContain('Ссылка на видеовстречу https://telemost.yandex.ru/j/12345678901234');
    hostElement(fixture)
      .querySelector<HTMLButtonElement>('button[aria-label="Копировать ссылку"]')
      ?.click();

    expect(copy).toHaveBeenCalledWith('https://telemost.yandex.ru/j/12345678901234');
    expect(success).toHaveBeenCalledWith('Ссылка в буфере обмена');
  });

  it('names the room of the portal when calls are on', async () => {
    await render([], 'OK');

    expect(text()).toContain('Комната портала');
  });

  it('says that there is no link when calls are off or unknown', async () => {
    await render([], null);

    expect(text()).toContain('Ссылка на видеовстречу не задана');
    expect(() => buttonByText(hostElement(fixture), 'Копировать ссылку')).toThrow();
  });
});
