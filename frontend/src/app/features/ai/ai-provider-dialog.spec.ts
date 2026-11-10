import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { aiModel, aiProvider, aiSettings } from '@testing/ai-fixtures';
import { bodyText, buttonByText, readableText, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { AvailableModel } from './data-access/ai.models';
import { AiProviderDialog } from './ai-provider-dialog';
import { AiSetup } from './ai-setup';

describe('AiProviderDialog', () => {
  let fixture: ComponentFixture<AiProviderDialog>;
  let dialog: AiProviderDialog;
  let backend: HttpTestingController;
  let messages: MessageService;

  const offered: AvailableModel[] = [
    { modelId: 'deepseek/deepseek-v4', label: 'DeepSeek V4', added: false },
    { modelId: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', added: false },
    { modelId: 'qwen/qwen-4', label: 'qwen/qwen-4', added: false },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AiProviderDialog],
      providers: [...testProviders(), AiSetup],
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(AiProviderDialog);
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

  async function press(text: string): Promise<void> {
    buttonByText(document.body, text).click();
    await fixture.whenStable();
  }

  async function chooseKind(name: string): Promise<void> {
    const card = Array.from(document.body.querySelectorAll('label.tb-ai-kind')).find((label) =>
      label.textContent.includes(name),
    );
    const radio = card?.querySelector('input');
    if (!(radio instanceof HTMLInputElement)) {
      throw new Error(`Kind ${name} not found`);
    }
    radio.click();
    await fixture.whenStable();
  }

  function rowOf(modelId: string): HTMLElement {
    const row = Array.from(
      document.body.querySelectorAll<HTMLElement>('.tb-ai-dialog__models > li'),
    ).find((candidate) => candidate.textContent.includes(modelId));
    if (row === undefined) {
      throw new Error(`Row ${modelId} not found`);
    }
    return row;
  }

  async function tick(modelId: string): Promise<void> {
    requireElement(rowOf(modelId), 'input[type=checkbox]', HTMLInputElement).click();
    await fixture.whenStable();
  }

  async function openChecked(models: AvailableModel[]): Promise<void> {
    dialog.openNew();
    await fixture.whenStable();
    typeInto(field('ai-provider-key'), 'sk-ant-1234567890');
    await press('Проверить и продолжить');
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/ai/providers/check' })
      .flush({ state: 'OK', detail: null, models });
    await fixture.whenStable();
  }

  function expectReload(): void {
    backend.expectOne('/api/teacher/ai/providers').flush([aiProvider()]);
    backend.expectOne('/api/teacher/ai/settings').flush(aiSettings());
  }

  it('asks for the key and shows the provider’s answer under it when the check fails', async () => {
    dialog.openNew();
    await fixture.whenStable();

    expect(readableText(document.body)).toContain('Шаг 1 из 2 · Подключение');
    expect(bodyText()).toContain('OpenAI-совместимый');
    await press('Проверить и продолжить');
    backend.expectNone('/api/teacher/ai/providers/check');

    typeInto(field('ai-provider-key'), 'bad');
    await press('Проверить и продолжить');
    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/ai/providers/check' });
    expect(request.request.body).toEqual({
      kind: 'anthropic',
      name: null,
      apiKey: 'bad',
      baseUrl: null,
      proxy: null,
    });
    request.flush({ state: 'FAILED', detail: '401 — неверный ключ', models: [] });
    await fixture.whenStable();

    expect(bodyText()).toContain('Не получилось: Anthropic ответил «401 — неверный ключ».');
    expect(bodyText()).toContain('Новое подключение');
  });

  it('shows the error when the check request itself fails', async () => {
    dialog.openNew();
    await fixture.whenStable();
    typeInto(field('ai-provider-key'), 'key');
    await press('Проверить и продолжить');
    backend
      .expectOne('/api/teacher/ai/providers/check')
      .flush(
        { code: 'ai.provider.key-required', status: 422 },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    expect(bodyText()).toContain('Для этого провайдера нужен API-ключ');
  });

  it('saves a new connection with the ticked models in their order', async () => {
    await openChecked(offered);

    expect(readableText(document.body)).toContain(
      'Подключение работает. Провайдер предлагает 3 модели.',
    );
    expect(readableText(document.body)).toContain('Модели Anthropic');
    typeInto(requireElement(document.body, 'tb-search-field input', HTMLInputElement), 'V4');
    await fixture.whenStable();
    expect(document.body.querySelectorAll('.tb-ai-dialog__models > li')).toHaveLength(2);
    await tick('deepseek/deepseek-v4-pro');
    await tick('deepseek/deepseek-v4');
    await tick('deepseek/deepseek-v4-pro');
    await tick('deepseek/deepseek-v4-pro');
    expect(bodyText()).toContain('Сохранить · 2 модели');

    await press('Сохранить · 2 модели');
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/ai/providers' });
    expect(create.request.body).toEqual(expect.objectContaining({ apiKey: 'sk-ant-1234567890' }));
    create.flush(aiProvider({ models: [] }));
    const first = backend.expectOne('/api/teacher/ai/providers/pr-1/models');
    expect(first.request.body).toEqual(
      expect.objectContaining({ modelId: 'deepseek/deepseek-v4', label: 'DeepSeek V4' }),
    );
    first.flush(aiModel());
    backend.expectOne('/api/teacher/ai/providers/pr-1/models').flush(aiModel({ id: 'm-2' }));
    expectReload();
    await fixture.whenStable();

    expect(dialog.visible()).toBe(false);
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Подключение сохранено' }),
    );
  });

  it('goes back to step 1 and narrows a search to nothing', async () => {
    await openChecked(offered);

    typeInto(requireElement(document.body, 'tb-search-field input', HTMLInputElement), 'zzz');
    await fixture.whenStable();
    expect(bodyText()).toContain('Ничего не найдено');

    await press('Назад');
    expect(bodyText()).toContain('Шаг 1 из 2');
    expect(field('ai-provider-key').value).toBe('sk-ant-1234567890');
  });

  it('cuts a long list and asks to narrow the search', async () => {
    const many = Array.from({ length: 60 }, (_, index) => ({
      modelId: `model-${String(index)}`,
      label: `model-${String(index)}`,
      added: false,
    }));
    await openChecked(many);

    expect(document.body.querySelectorAll('.tb-ai-dialog__models > li')).toHaveLength(50);
    expect(bodyText()).toContain('И ещё 10 — уточните поиск');
  });

  it('adds a model by hand when the provider lists none and says when one did not save', async () => {
    await openChecked([]);

    expect(bodyText()).toContain('Список моделей провайдер не даёт');
    const manual = field('ai-model-manual');
    typeInto(manual, '  ');
    manual.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    typeInto(manual, 'claude-opus-5');
    manual.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    typeInto(field('ai-model-manual'), 'claude-opus-5');
    await press('Добавить');
    typeInto(field('ai-model-manual'), 'claude-sonnet-5');
    await press('Добавить');
    expect(bodyText()).toContain('Сохранить · 2 модели');

    await press('Сохранить · 2 модели');
    backend.expectOne('/api/teacher/ai/providers').flush(aiProvider({ models: [] }));
    const first = backend.expectOne('/api/teacher/ai/providers/pr-1/models');
    expect(first.request.body).toEqual(
      expect.objectContaining({ modelId: 'claude-sonnet-5', label: null }),
    );
    first.flush(null, { status: 409, statusText: 'Conflict' });
    backend.expectOne('/api/teacher/ai/providers/pr-1/models').flush(aiModel());
    expectReload();
    await fixture.whenStable();

    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Подключение сохранено, но не все модели добавились' }),
    );
  });

  it('opens the manual field beside a list', async () => {
    await openChecked(offered);

    await press('Добавить модель вручную');
    typeInto(field('ai-model-manual'), 'deepseek/deepseek-v4');
    await press('Добавить');

    expect(bodyText()).toContain('Сохранить · 1 модель');
  });

  it('asks an OpenAI-compatible server for its address and checks the proxy', async () => {
    dialog.openNew();
    await fixture.whenStable();
    await chooseKind('OpenAI-совместимый');

    expect(bodyText()).toContain('Локальному серверу ключ может быть не нужен.');
    typeInto(field('ai-provider-proxy'), 'not a proxy');
    await press('Проверить и продолжить');
    backend.expectNone('/api/teacher/ai/providers/check');

    typeInto(field('ai-provider-url'), 'http://localhost:11434/v1');
    typeInto(field('ai-provider-proxy'), 'socks5://host:1080');
    typeInto(field('ai-provider-name'), 'Ollama');
    await press('Проверить и продолжить');
    const request = backend.expectOne('/api/teacher/ai/providers/check');
    expect(request.request.body).toEqual({
      kind: 'openai-compatible',
      name: 'Ollama',
      apiKey: null,
      baseUrl: 'http://localhost:11434/v1',
      proxy: 'socks5://host:1080',
    });
    request.flush({ state: 'OK', detail: null, models: [] });
    await fixture.whenStable();

    expect(bodyText()).toContain('Модели Ollama');
  });

  it('hides the address of other kinds under «Дополнительно»', async () => {
    dialog.openNew();
    await fixture.whenStable();
    await chooseKind('OpenRouter');

    expect(document.body.querySelector('#ai-provider-url')).toBeNull();
    await press('Дополнительно');

    expect(field('ai-provider-url').placeholder).toBe('https://openrouter.ai/api/v1');
  });

  it('changes a connection, keeps the key when left blank and stays open while it fails', async () => {
    const saved = aiProvider({
      kind: 'openai-compatible',
      name: 'Ollama',
      baseUrl: 'http://old/v1',
      address: 'http://old/v1',
    });
    dialog.openEdit(saved);
    await fixture.whenStable();

    expect(bodyText()).toContain('Подключение Ollama');
    expect(bodyText()).toContain('Ключ задан (…a7f2). Пусто — оставить его.');
    expect(document.body.querySelector('.tb-ai-kinds')).toBeNull();
    requireElement(document.body, '#ai-provider-remove-key', HTMLInputElement).click();
    typeInto(field('ai-provider-name'), ' ');
    await press('Сохранить');
    const first = backend.expectOne({ method: 'PUT', url: '/api/teacher/ai/providers/pr-1' });
    expect(first.request.body).toEqual({
      name: 'Ollama',
      apiKey: null,
      removeKey: true,
      baseUrl: 'http://old/v1',
      proxy: null,
      version: 0,
    });
    first.flush({ ...saved, version: 1, state: 'FAILED', stateDetail: 'connection refused' });
    await fixture.whenStable();
    expect(bodyText()).toContain('ответил «connection refused»');
    expect(dialog.visible()).toBe(true);

    await press('Сохранить');
    const second = backend.expectOne({ method: 'PUT', url: '/api/teacher/ai/providers/pr-1' });
    expect(second.request.body).toEqual(expect.objectContaining({ version: 1 }));
    second.flush({ ...saved, version: 2 });
    await fixture.whenStable();

    expect(dialog.visible()).toBe(false);
  });

  it('shows the save error of a change', async () => {
    dialog.openEdit(aiProvider({ keyEnding: null }));
    await fixture.whenStable();

    expect(bodyText()).toContain('Ключ задан. Пусто — оставить его.');
    await press('Сохранить');
    backend
      .expectOne('/api/teacher/ai/providers/pr-1')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Не удалось сохранить подключение');
  });

  it('adds models to a saved connection, the added ones ticked and locked', async () => {
    const saved = aiProvider();
    dialog.openModels(saved);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/ai/providers/pr-1/models/available').flush([
      { modelId: 'claude-opus-5', label: 'Claude Opus 5', added: true },
      { modelId: 'claude-sonnet-5', label: 'Claude Sonnet 5', added: false },
    ]);
    await fixture.whenStable();

    expect(readableText(document.body)).toContain('Шаг 2 из 2 · Модели');
    expect(readableText(rowOf('claude-opus-5'))).toContain('Уже добавлена · claude-opus-5');
    expect(requireElement(rowOf('claude-opus-5'), 'input', HTMLInputElement).disabled).toBe(true);
    await tick('claude-sonnet-5');
    await press('Сохранить · 1 модель');
    backend.expectOne('/api/teacher/ai/providers/pr-1/models').flush(aiModel());
    expectReload();
    await fixture.whenStable();

    expect(dialog.visible()).toBe(false);
  });

  it('lets the models be typed when the provider cannot be reached', async () => {
    dialog.openModels(aiProvider());
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/ai/providers/pr-1/models/available')
      .flush(
        { code: 'ai.provider.unavailable', status: 422 },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    expect(bodyText()).toContain('Провайдер не ответил');
    expect(document.body.querySelector('#ai-model-manual')).not.toBeNull();
    await press('Сохранить');
    expectReload();
    await fixture.whenStable();
    expect(dialog.visible()).toBe(false);
  });
});
