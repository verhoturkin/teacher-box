import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import type { MockInstance } from 'vitest';
import { aiModel, aiProvider, aiSettings } from '@testing/ai-fixtures';
import {
  bodyText,
  buttonByText,
  hostElement,
  menuItemByText,
  readableText,
  requireElement,
} from '@testing/dom';
import { testProviders } from '@testing/setup';
import { Confirm } from '@shared/ui/confirm';
import { AiProvider, AiSettings } from './data-access/ai.models';
import { AiConnectionsCard } from './ai-connections-card';
import { AiSetup } from './ai-setup';

describe('AiConnectionsCard', () => {
  let fixture: ComponentFixture<AiConnectionsCard>;
  let backend: HttpTestingController;
  let messages: MessageService;

  const sonnet = aiModel({
    id: 'm-2',
    modelId: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    effort: 'high',
    default: false,
  });
  const anthropic = aiProvider({ models: [aiModel(), sonnet] });
  const router = aiProvider({
    id: 'pr-2',
    kind: 'openrouter',
    name: 'OpenRouter',
    keyEnding: null,
    proxy: 'socks5://proxy:1080',
    state: 'FAILED',
    stateDetail: '401 — неверный ключ',
    models: [aiModel({ id: 'm-3', modelId: 'deepseek/v4', label: 'deepseek/v4', default: false })],
  });

  async function render(
    providers: AiProvider[] = [anthropic, router],
    settings: AiSettings = aiSettings(),
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AiConnectionsCard],
      providers: [...testProviders(), AiSetup],
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(AiConnectionsCard);
    TestBed.inject(AiSetup).load();
    fixture.detectChanges();
    backend.expectOne('/api/teacher/ai/providers').flush(providers);
    backend.expectOne('/api/teacher/ai/settings').flush(settings);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  function said(detail: string): void {
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail }));
  }

  async function pick(host: HTMLElement, button: string, item: string): Promise<void> {
    buttonByText(host, button).click();
    await fixture.whenStable();
    menuItemByText(item).click();
    await fixture.whenStable();
  }

  function confirmWith(answer: boolean): MockInstance<Confirm['danger']> {
    return vi.spyOn(TestBed.inject(Confirm), 'danger').mockResolvedValue(answer);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('offers to add the first connection', async () => {
    const host = await render([], aiSettings({ defaultModelId: null }));

    expect(readableText(host)).toContain('Подключений пока нет');
    buttonByText(host, 'Добавить подключение').click();
    await fixture.whenStable();

    expect(bodyText()).toContain('Новое подключение');
  });

  it('lists each connection with its state and its models with the default one', async () => {
    const host = await render();
    const text = readableText(host);

    expect(text).toContain('Anthropic 2 модели · ключ …a7f2 · напрямую Работает');
    expect(text).toContain('Claude Opus 5 claude-opus-5 По умолчанию');
    expect(text).toContain('Claude Sonnet 5 claude-sonnet-5 · усилие: высокое');
    expect(text).toContain('OpenRouter 1 модель · ключ задан · через прокси');
    expect(text).toContain('401 — неверный ключ Ошибка');
    expect(requireElement(host, '#ai-default-m-1', HTMLInputElement).checked).toBe(true);
  });

  it('says when a connection has no key, no models and was not checked', async () => {
    const text = readableText(
      await render([
        aiProvider({ keySet: false, keyEnding: null, state: 'UNCHECKED', models: [] }),
      ]),
    );

    expect(text).toContain('0 моделей · без ключа · напрямую Не проверено');
    expect(text).toContain('Моделей нет — добавьте хотя бы одну');
  });

  it('makes a model the default by its radio and by its menu', async () => {
    const host = await render();

    requireElement(host, '#ai-default-m-2', HTMLInputElement).click();
    await fixture.whenStable();
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/ai/settings' });
    expect(request.request.body).toEqual(aiSettings({ defaultModelId: 'm-2' }));
    request.flush(aiSettings({ defaultModelId: 'm-2', version: 2 }));
    await fixture.whenStable();
    said('Теперь черновики пишет Claude Sonnet 5');
    expect(readableText(host)).toContain(
      'Claude Sonnet 5 claude-sonnet-5 · усилие: высокое По умолчанию',
    );

    await pick(host, 'Действия с моделью deepseek/v4', 'Сделать основной');
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/ai/settings' })
      .flush(aiSettings({ defaultModelId: 'm-3', version: 3 }));
    await fixture.whenStable();
    said('Теперь черновики пишет deepseek/v4');
  });

  it('opens the dialogs of a connection, of a model and of new models', async () => {
    const host = await render();

    await pick(host, 'Действия с подключением Anthropic', 'Изменить…');
    expect(bodyText()).toContain('Подключение Anthropic');

    await pick(host, 'Действия с моделью Claude Opus 5', 'Изменить…');
    expect(bodyText()).toContain('Идентификатор модели');

    buttonByText(host, 'Добавить модель').click();
    await fixture.whenStable();
    backend.expectOne('/api/teacher/ai/providers/pr-1/models/available').flush([]);
  });

  it('checks a connection again and says how it went', async () => {
    const host = await render();

    await pick(host, 'Действия с подключением OpenRouter', 'Проверить снова');
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/ai/providers/pr-2/check' })
      .flush({ ...router, state: 'FAILED', stateDetail: 'timeout' });
    await fixture.whenStable();
    said('Подключение не работает: timeout');

    await pick(host, 'Действия с подключением OpenRouter', 'Проверить снова');
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/ai/providers/pr-2/check' })
      .flush({ ...router, state: 'OK', stateDetail: null });
    await fixture.whenStable();
    said('Подключение работает');
    expect(readableText(host)).not.toContain('timeout');
  });

  it('deletes a connection after a confirmation', async () => {
    const host = await render();
    const confirm = confirmWith(false);

    await pick(host, 'Действия с подключением OpenRouter', 'Удалить…');
    expect(confirm).toHaveBeenCalled();
    backend.expectNone('/api/teacher/ai/providers/pr-2');

    confirm.mockResolvedValue(true);
    await pick(host, 'Действия с подключением OpenRouter', 'Удалить…');
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/ai/providers/pr-2' }).flush(null);
    await fixture.whenStable();

    said('Подключение удалено');
    expect(readableText(host)).not.toContain('OpenRouter');
  });

  it('keeps the connection with the default model while another could be the default', async () => {
    const host = await render();
    const confirm = confirmWith(true);

    await pick(host, 'Действия с подключением Anthropic', 'Удалить…');

    expect(confirm).not.toHaveBeenCalled();
    said(
      'В этом подключении модель по умолчанию. Сначала сделайте основной модель другого подключения.',
    );
  });

  it('turns the AI off before deleting the only connection', async () => {
    const host = await render([anthropic]);
    confirmWith(true);

    await pick(host, 'Действия с подключением Anthropic', 'Удалить…');
    const settings = backend.expectOne({ method: 'PUT', url: '/api/teacher/ai/settings' });
    expect(settings.request.body).toEqual(aiSettings({ defaultModelId: null }));
    settings.flush(aiSettings({ defaultModelId: null, version: 2 }));
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/ai/providers/pr-1' }).flush(null);
    await fixture.whenStable();

    expect(readableText(host)).toContain('Подключений пока нет');
  });

  it('deletes a model, the default one with a warning', async () => {
    const host = await render();
    const confirm = confirmWith(true);

    await pick(host, 'Действия с моделью Claude Opus 5', 'Удалить…');
    expect(confirm.mock.calls[0]?.[0].message).toContain('модель по умолчанию');
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/ai/providers/pr-1/models/m-1' })
      .flush(null);
    await fixture.whenStable();

    said('Модель удалена');
    expect(readableText(host)).not.toContain('Claude Opus 5');
    expect(TestBed.inject(AiSetup).settings()?.defaultModelId).toBeNull();

    confirm.mockResolvedValue(false);
    await pick(host, 'Действия с моделью Claude Sonnet 5', 'Удалить…');
    backend.expectNone('/api/teacher/ai/providers/pr-1/models/m-2');
  });

  it('offers no «Сделать основной» for the default model', async () => {
    const host = await render();

    buttonByText(host, 'Действия с моделью Claude Opus 5').click();
    await fixture.whenStable();

    expect(() => menuItemByText('Сделать основной')).toThrow();
  });
});
