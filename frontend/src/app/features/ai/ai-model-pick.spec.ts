import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { aiModel, aiProvider, answerModels } from '@testing/ai-fixtures';
import { hostElement, menuItemByText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { AiProvider } from './data-access/ai.models';
import { AiModelPick } from './ai-model-pick';
import { MODEL_CHOICE_KEY } from './model-choice';

const CONNECTIONS: AiProvider[] = [
  aiProvider({
    models: [aiModel(), aiModel({ id: 'm-2', label: 'Claude Sonnet 5', default: false })],
  }),
  aiProvider({
    id: 'pr-2',
    kind: 'openrouter',
    name: 'OpenRouter',
    state: 'FAILED',
    models: [aiModel({ id: 'm-3', label: 'DeepSeek V4', default: false })],
  }),
  aiProvider({ id: 'pr-3', name: 'Пустое', models: [] }),
];

describe('AiModelPick', () => {
  let fixture: ComponentFixture<AiModelPick>;
  let backend: HttpTestingController;

  async function render(providers: readonly AiProvider[], short = false): Promise<HTMLElement> {
    TestBed.configureTestingModule({ imports: [AiModelPick], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AiModelPick);
    fixture.componentRef.setInput('short', short);
    await fixture.whenStable();
    answerModels(backend, providers);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  function pick(host: HTMLElement): HTMLButtonElement | null {
    return host.querySelector<HTMLButtonElement>('.tb-model-pick');
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    localStorage.removeItem(MODEL_CHOICE_KEY);
  });

  it('is hidden while there is one model to write with', async () => {
    const host = await render([aiProvider()]);

    expect(pick(host)).toBeNull();
  });

  it('names the model in force and lists the models by connection', async () => {
    const host = await render(CONNECTIONS);
    const button = pick(host);

    expect(button?.textContent).toContain('Claude Opus 5');
    expect(button?.getAttribute('aria-label')).toBe('Модель: Claude Opus 5');
    expect(button?.getAttribute('aria-expanded')).toBe('false');

    button?.click();
    await fixture.whenStable();
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(button?.classList).toContain('tb-model-pick--open');
    const menu = document.body.querySelector('.p-menu');
    expect(menu?.textContent).toContain('Anthropic');
    expect(menu?.textContent).toContain('OpenRouter');
    expect(menu?.textContent).not.toContain('Пустое');
    expect(menu?.querySelectorAll('[role="separator"]')).toHaveLength(2);
    const opus = menuItemByText('Claude Opus 5');
    expect(opus.textContent).toContain('По умолчанию');
    expect(opus.closest('li')?.classList).toContain('tb-menu-item--selected');
    const broken = menuItemByText('DeepSeek V4');
    expect(broken.textContent).toContain('Подключение не работает');
    expect(broken.textContent).toContain('Ошибка');
    expect(broken.closest('li')?.getAttribute('aria-disabled')).toBe('true');

    menuItemByText('Claude Sonnet 5').click();
    await fixture.whenStable();
    expect(pick(host)?.textContent).toContain('Claude Sonnet 5');
    expect(localStorage.getItem(MODEL_CHOICE_KEY)).toBe('m-2');
  });

  it('cuts the label short on a phone and leads to the connections', async () => {
    const host = await render(CONNECTIONS, true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    expect(pick(host)?.classList).toContain('tb-model-pick--short');
    pick(host)?.click();
    await fixture.whenStable();
    menuItemByText('Настроить подключения').click();

    expect(navigate).toHaveBeenCalledWith('/teacher/settings/ai');
  });
});
