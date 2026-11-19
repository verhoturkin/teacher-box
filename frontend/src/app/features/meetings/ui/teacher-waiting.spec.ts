import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { MyCall } from '../data-access/meetings.models';
import { SUMMON_REFRESH_MS } from './call-summon';
import { TeacherWaiting } from './teacher-waiting';

function aCall(overrides: Partial<MyCall> = {}): MyCall {
  return {
    ownerId: 'me',
    ownerType: 'STUDENT',
    title: 'Мой звонок',
    teacherPresent: true,
    ...overrides,
  };
}

describe('TeacherWaiting', () => {
  let fixture: ComponentFixture<TeacherWaiting>;
  let backend: HttpTestingController;

  async function render(calls: MyCall[] | null, groupId: string | null = null): Promise<void> {
    TestBed.configureTestingModule({ imports: [TeacherWaiting], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TeacherWaiting);
    fixture.componentRef.setInput('groupId', groupId);
    await answer(calls);
  }

  async function answer(calls: MyCall[] | null): Promise<void> {
    await fixture.whenStable();
    const request = backend.expectOne('/api/me/meetings/calls');
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

  it('says the teacher waits in the own room', async () => {
    await render([aCall()]);

    expect(text()).toBe('Учитель ждёт в звонке');
  });

  it('looks at the room of the lesson group only', async () => {
    await render(
      [aCall(), aCall({ ownerId: 'g-1', ownerType: 'GROUP', teacherPresent: false })],
      'g-1',
    );

    expect(text()).toBe('');
  });

  it('shows nothing when the presence is unknown', async () => {
    await render(null);

    expect(text()).toBe('');
  });

  it('notices the teacher joining', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await render([aCall({ teacherPresent: false })]);
    expect(text()).toBe('');

    vi.advanceTimersByTime(SUMMON_REFRESH_MS);
    await answer([aCall()]);

    expect(text()).toBe('Учитель ждёт в звонке');
  });
});
