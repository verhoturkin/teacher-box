import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { aiModel, aiProvider } from '@testing/ai-fixtures';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { AiModelDialog } from './ai-model-dialog';
import { AiSetup } from './ai-setup';

describe('AiModelDialog', () => {
  let fixture: ComponentFixture<AiModelDialog>;
  let dialog: AiModelDialog;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AiModelDialog],
      providers: [...testProviders(), AiSetup],
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(AiModelDialog);
    dialog = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function field(id: string): HTMLInputElement {
    return requireElement(document.body, `#${id}`, HTMLInputElement);
  }

  it('changes the name and the id of a model and keeps the rest', async () => {
    const setup = TestBed.inject(AiSetup);
    setup.providers.set([aiProvider()]);
    dialog.open(aiProvider(), aiModel({ effort: 'high', version: 3 }));
    await fixture.whenStable();

    expect(field('ai-model-label').value).toBe('Claude Opus 5');
    typeInto(field('ai-model-label'), ' ');
    typeInto(field('ai-model-id'), ' claude-opus-5-1 ');
    buttonByText(document.body, 'Сохранить').click();
    const request = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/ai/providers/pr-1/models/m-1',
    });
    expect(request.request.body).toEqual({
      modelId: 'claude-opus-5-1',
      label: null,
      effort: 'high',
      fallbacks: true,
      maxTokens: 16_000,
      timeoutSeconds: 120,
      version: 3,
    });
    request.flush(aiModel({ modelId: 'claude-opus-5-1', label: 'claude-opus-5-1', version: 4 }));
    await fixture.whenStable();

    expect(dialog.visible()).toBe(false);
    expect(setup.models()[0]?.modelId).toBe('claude-opus-5-1');
  });

  it('shows the effort and the fallbacks of an Anthropic model under «Дополнительно»', async () => {
    dialog.open(aiProvider(), aiModel());
    await fixture.whenStable();

    expect(document.body.querySelector('#ai-model-tokens')).toBeNull();
    buttonByText(document.body, 'Дополнительно').click();
    await fixture.whenStable();

    expect(bodyText()).toContain('Усилие');
    expect(bodyText()).toContain('Запасные модели');
    expect(document.body.querySelector('#ai-model-tokens')).not.toBeNull();
  });

  it('leaves out the effort of other kinds and refuses an empty id', async () => {
    dialog.open(aiProvider({ kind: 'deepseek' }), aiModel());
    await fixture.whenStable();
    buttonByText(document.body, 'Дополнительно').click();
    await fixture.whenStable();

    expect(bodyText()).not.toContain('Усилие');
    typeInto(field('ai-model-id'), '');
    buttonByText(document.body, 'Сохранить').click();
    await fixture.whenStable();
    backend.expectNone('/api/teacher/ai/providers/pr-1/models/m-1');
  });
});
