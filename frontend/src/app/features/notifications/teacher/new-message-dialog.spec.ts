import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { NewMessageState } from '@core/notifications/new-message';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { NewMessageDialog } from './new-message-dialog';

describe('NewMessageDialog', () => {
  let fixture: ComponentFixture<NewMessageDialog>;
  let backend: HttpTestingController;
  let state: NewMessageState;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [NewMessageDialog], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    state = TestBed.inject(NewMessageState);
    fixture = TestBed.createComponent(NewMessageDialog);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  async function open(): Promise<void> {
    state.show();
    await fixture.whenStable();
    backend.expectOne('/api/teacher/students').flush([
      { id: 's-1', displayName: 'Мария', status: 'ACTIVE' },
      { id: 's-2', displayName: 'Бывший', status: 'DEACTIVATED' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    backend.expectOne('/api/teacher/groups').flush([]);
  }

  it('opens over the page with the current students when asked for', async () => {
    expect(bodyText()).not.toContain('Сообщение ученикам');

    await open();

    expect(bodyText()).toContain('Сообщение ученикам');
  });

  it('sends, says so and tells the sent tab', async () => {
    await open();
    const messages = vi.spyOn(TestBed.inject(MessageService), 'add');
    typeInto(requireElement(document.body, '#broadcast-title', HTMLInputElement), 'Каникулы');
    await fixture.whenStable();
    buttonByText(document.body, 'Отправить').click();
    const request = backend.expectOne('/api/teacher/notifications/broadcast');
    expect(request.request.body).toEqual({ title: 'Каникулы', body: null, studentIds: [] });
    request.flush({ recipients: 1 });
    await fixture.whenStable();

    expect(messages).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Сообщение отправлено, получателей: 1' }),
    );
    expect(state.sent()).toBe(1);
    expect(state.open()).toBe(false);
  });

  it('closes on «Отмена» and opens again', async () => {
    await open();

    buttonByText(document.body, 'Отмена').click();
    await fixture.whenStable();
    expect(state.open()).toBe(false);

    await open();
    expect(state.open()).toBe(true);
  });
});
