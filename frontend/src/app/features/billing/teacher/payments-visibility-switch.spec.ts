import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { hostElement, requireElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { PaymentsVisibilitySwitch } from './payments-visibility-switch';

const URL = '/api/teacher/billing/students/s-1/visibility';

describe('PaymentsVisibilitySwitch', () => {
  let fixture: ComponentFixture<PaymentsVisibilitySwitch>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let messages: MessageService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PaymentsVisibilitySwitch],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(PaymentsVisibilitySwitch);
    fixture.componentRef.setInput('studentId', 's-1');
    fixture.componentRef.setInput('guardians', 1);
    host = hostElement(fixture);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  async function loaded(guardiansOnly: boolean, hasGuardians = true): Promise<void> {
    backend.expectOne(URL).flush({ studentId: 's-1', guardiansOnly, hasGuardians });
    await fixture.whenStable();
  }

  function input(): HTMLInputElement {
    return requireElement(host, '#payments-guardians-only', HTMLInputElement);
  }

  it('shows the switch with its label while the student has a parent', async () => {
    await loaded(true);

    expect(host.textContent).toContain('Оплаты видит только родитель');
    expect(host.textContent).toContain('не увидит баланс');
    expect(input().checked).toBe(true);
    expect(requireElement(host, 'label.tb-tile', HTMLLabelElement).htmlFor).toBe(
      'payments-guardians-only',
    );
  });

  it('shows nothing without a parent or when the flag cannot be read', async () => {
    await loaded(false, false);
    expect(host.querySelector('#payments-guardians-only')).toBeNull();

    fixture.componentRef.setInput('guardians', 0);
    await fixture.whenStable();
    backend.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(host.textContent).toBe('');
  });

  it('hides the payments from the student at once', async () => {
    await loaded(false);

    input().click();
    await fixture.whenStable();
    const request = backend.expectOne({ method: 'PUT', url: URL });
    expect(request.request.body).toEqual({ guardiansOnly: true });
    request.flush({ studentId: 's-1', guardiansOnly: true, hasGuardians: true });
    await fixture.whenStable();

    expect(input().checked).toBe(true);
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Оплаты теперь видит только родитель' }),
    );
  });

  it('shows the payments to the student again', async () => {
    await loaded(true);

    input().click();
    await fixture.whenStable();
    backend
      .expectOne({ method: 'PUT', url: URL })
      .flush({ studentId: 's-1', guardiansOnly: false, hasGuardians: true });
    await fixture.whenStable();

    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Ученик снова видит оплаты' }),
    );
  });

  it('puts the switch back when the change is refused', async () => {
    await loaded(false);

    input().click();
    await fixture.whenStable();
    backend
      .expectOne({ method: 'PUT', url: URL })
      .flush(
        { status: 422, code: 'billing.no-guardian' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await fixture.whenStable();

    expect(input().checked).toBe(false);
  });
});
