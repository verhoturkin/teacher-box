import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { aRoom } from '@testing/meetings-fixtures';
import { MeetingsApi } from './meetings-api';
import { testProviders } from '@testing/setup';

describe('MeetingsApi', () => {
  let api: MeetingsApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: testProviders(),
    });
    api = TestBed.inject(MeetingsApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('manages rooms of students and groups', () => {
    const recipients: number[] = [];
    api.rooms().subscribe();
    api.enterLink({ type: 'STUDENT', id: 's-1', name: 'Мария' }, 'https://zoom.us/j/1').subscribe();
    api.removeRoom('s-1').subscribe();
    api.share('g-1').subscribe((count) => recipients.push(count));
    api.myRooms().subscribe();

    backend.expectOne({ method: 'GET', url: '/api/teacher/meetings/rooms' }).flush([aRoom()]);
    expect(
      backend.expectOne({ method: 'PUT', url: '/api/teacher/meetings/rooms' }).request.body,
    ).toEqual({
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
