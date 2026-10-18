# ИИ-помощник

По умолчанию выключен. Включается в `.env` (или администратором в «Настройках»):

```ini
# Claude (Anthropic): ключ — на console.anthropic.com
TEACHERBOX_AI_PROVIDER=anthropic
TEACHERBOX_AI_API_KEY=sk-ant-...
# модель по умолчанию — claude-opus-5

# или Google Gemini: ключ Gemini API — на aistudio.google.com («Get API key»)
TEACHERBOX_AI_PROVIDER=gemini
TEACHERBOX_AI_API_KEY=AIza...
# модель по умолчанию — gemini-3.8-flash

# или OpenRouter: ключ — на openrouter.ai/keys, модели разных компаний по одному ключу
TEACHERBOX_AI_PROVIDER=openrouter
TEACHERBOX_AI_API_KEY=sk-or-...
# модель по умолчанию — openrouter/auto (OpenRouter выбирает её сам);
# конкретная — по названию с openrouter.ai/models, например TEACHERBOX_AI_MODEL=deepseek/deepseek-v4

# или DeepSeek: ключ — на platform.deepseek.com
TEACHERBOX_AI_PROVIDER=deepseek
TEACHERBOX_AI_API_KEY=sk-...
# модель по умолчанию — deepseek-flash; посильнее — deepseek-v4-pro

# или OpenAI-совместимый сервис
TEACHERBOX_AI_PROVIDER=openai-compatible
TEACHERBOX_AI_BASE_URL=https://api.openai.com/v1
TEACHERBOX_AI_API_KEY=sk-...
TEACHERBOX_AI_MODEL=gpt-5

# или локальная модель в Ollama (ключ не нужен)
TEACHERBOX_AI_PROVIDER=openai-compatible
TEACHERBOX_AI_BASE_URL=http://ollama:11434/v1
TEACHERBOX_AI_MODEL=qwen3:14b

TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT=2000000
```

После перезапуска портала появятся кнопки «Сгенерировать с ИИ» в редакторе задания и «Черновик
проверки» на странице проверки. Тексты уходят провайдеру только по вашему нажатию; ответ ИИ
всегда черновик, который вы правите сами. Расход — на странице «ИИ».

Про Gemini: подписка Google AI Pro к порталу не подключается — она действует только в
приложении Gemini и в веб-интерфейсе AI Studio, а обращения программ к Gemini API оплачиваются
отдельно (есть бесплатный уровень с дневными лимитами). На бесплатном уровне Google может
использовать тексты запросов для улучшения своих продуктов, а в запросах на проверку бывают
ответы учеников — для них лучше включить оплату в AI Studio. Из России Gemini API недоступен,
нужен прокси (см. [Прокси](Proxy)).

Про OpenRouter: запросы уходят только тем поставщикам модели, которые соблюдают формат ответа
портала. Расход и баланс видны в кабинете OpenRouter; там же, в настройках приватности, можно
запретить поставщиков, которые сохраняют запросы или учатся на них (бесплатные модели этого
обычно требуют) — в запросах на проверку бывают ответы учеников.

Про DeepSeek: его API не принимает схему ответа, поэтому портал описывает нужный JSON в запросе
сам. Обычно доступен из России без прокси. Если DeepSeek уже подключён как `openai-compatible`, он тоже
заработает (портал сам перейдёт на подходящий формат ответа), но проще указать `deepseek`.
