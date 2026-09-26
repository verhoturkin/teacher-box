import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { aRoom, yandexStatus } from '@testing/meetings-fixtures';
import { MeetingsApi } from './meetings-api';

describe('MeetingsApi', () => {
  let api: MeetingsApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(MeetingsApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('manages the Yandex connection', () => {
    const results: unknown[] = [];
    api.yandexStatus().subscribe((status) => results.push(status));
    api.saveClient('id', 'secret').subscribe();
    api.setWaitingRoom(true).subscribe();
    api.authorize('https://school.example.com').subscribe((url) => results.push(url));
    api.disconnect().subscribe();

    backend.expectOne({ method: 'GET', url: '/api/teacher/meetings/yandex' }).flush(yandexStatus());
    expect(backend.expectOne({ method: 'PUT', url: '/api/teacher/meetings/yandex/client' }).request.body).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
    });
    expect(backend.expectOne('/api/teacher/meetings/yandex/waiting-room').request.body).toEqual({ enabled: true });
    backend.expectOne('/api/teacher/meetings/yandex/authorize').flush({ url: 'https://oauth.yandex.ru/authorize' });
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/meetings/yandex' }).flush(null);

    expect(results).toEqual([yandexStatus(), 'https://oauth.yandex.ru/authorize']);
  });

  it('manages rooms of students and groups', () => {
    const recipients: number[] = [];
    api.rooms().subscribe();
    api.createRoom({ type: 'GROUP', id: 'g-1', name: 'ОГЭ' }).subscribe();
    api.enterLink({ type: 'STUDENT', id: 's-1', name: 'Мария' }, 'https://zoom.us/j/1').subscribe();
    api.removeRoom('s-1').subscribe();
    api.share('g-1').subscribe((count) => recipients.push(count));
    api.myRooms().subscribe();

    backend.expectOne({ method: 'GET', url: '/api/teacher/meetings/rooms' }).flush([aRoom()]);
    expect(backend.expectOne({ method: 'POST', url: '/api/teacher/meetings/rooms' }).request.body).toEqual({
      studentId: null,
      groupId: 'g-1',
    });
    expect(backend.expectOne({ method: 'PUT', url: '/api/teacher/meetings/rooms' }).request.body).toEqual({
      studentId: 's-1',
      groupId: null,
      joinUrl: 'https://zoom.us/j/1',
    });
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/meetings/rooms/s-1' }).flush(null);
    backend.expectOne('/api/teacher/meetings/rooms/g-1/share').flush({ recipients: 3 });
    backend.expectOne('/api/me/meetings/rooms').flush([]);

    expect(recipients).toEqual([3]);
  });
});
