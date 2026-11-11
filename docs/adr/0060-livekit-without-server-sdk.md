# ADR-0060. LiveKit без серверного SDK

- Статус: принято
- Дата: 2026-11-11
- Изменяет: [ADR-0030](0030-livekit-calls.md) в части «Библиотеки» (бэкенд)
- Действующие правила: [docs/modules/meetings.md](../modules/meetings.md)

## Контекст

По ADR-0030 бэкенд говорил с LiveKit через официальный `io.livekit:livekit-server` (0.16.0). Из
всего SDK портал использует четыре вещи: подпись токена доступа и три метода сервиса комнат
(`ListRooms`, `ListParticipants`, `RemoveParticipant`); всё это — в одном классе
`meetings/livekit/LiveKitCallServer`. За это SDK тянул protobuf (с `protobuf-java-util` и Gson),
Retrofit с конвертером protobuf, `java-jwt`, `logging-interceptor` и OkHttp 5. Ради OkHttp 5 в
`backend/pom.xml` стоял импорт `okhttp-bom` 5.x, который перебивал OkHttp 4.12, объявленный
клиентом Anthropic, и отдельная зависимость `okhttp-jvm` (артефакт `okhttp` 5.x для Maven — только
метаданные Kotlin Multiplatform, без классов).

Оба формата, которые нужны порталу, описаны в документации LiveKit и просты:

- токен доступа — JWT, HS256, секрет API; `iss` — ключ API, `sub` — личность участника, `exp`,
  `name` и право `video` (`roomJoin`, `room`, `canPublish`, `canSubscribe`, `canPublishData`,
  `canPublishSources`, `roomAdmin`, `roomList`);
- сервис комнат — Twirp: `POST /twirp/livekit.RoomService/<метод>`, заголовок
  `Authorization: Bearer <токен>`, тело — JSON (`application/json`) или protobuf; для `ListRooms`
  нужно право `roomList`, для `ListParticipants` и `RemoveParticipant` — `roomAdmin` и `room`;
  ошибки — JSON `{code, msg}` с кодом HTTP (`not_found` → 404, `unauthenticated` → 401).

## Решение

- SDK, `okhttp-jvm` и импорт `okhttp-bom` убраны из `backend/pom.xml`. Клиент Anthropic снова
  получает объявленный им OkHttp 4.12.0 (его тесты адаптера зелёные); больше OkHttp никому не нужен.
- Токен подписывается классами Nimbus JOSE + JWT, которые уже приносит Spring Security
  (`MACSigner`, HS256, заголовок `typ: JWT`). Срок токена входа — 10 минут, как было; LiveKit сам
  продлевает его, пока участник в комнате.
- Сервис комнат вызывается через `RestClient` из `shared.http.OutboundHttp` (HTTP/1.1, таймауты
  5 с на соединение и 10 с на ответ, без прокси — LiveKit стоит рядом), тела — JSON. Для каждого
  вызова подписывается свой короткий токен с нужным правом. Ответ читается как дерево JSON, нужны
  только `rooms[].name`, `participants[].identity` и `participants[].name`; отсутствующий список
  читается как пустой. Адрес `ws://` / `wss://` переводится в `http://` / `https://`, как делал SDK.
- `RemoveParticipant` с ответом 404 (участник уже вышел) — не ошибка; любой другой ответ не 2xx —
  `CallServerException` с методом и кодом (401 — с подсказкой про ключ и секрет), как раньше.
- Что делал SDK, записано один раз в `src/test/resources/ru/teacherbox/meetings/livekit/
  sdk-fixtures.json`: заголовок и утверждения токенов входа ученика и учителя, пути, заголовки,
  тела (protobuf, переведённые в JSON) и токены трёх вызовов. `LiveKitCallServerTest` сравнивает с
  ними новую реализацию. Намеренные отличия названы в тесте: тела — JSON вместо protobuf; токен
  вызова живёт 10 минут, а не 6 часов SDK; нет пустого права `sip: {}`, которое SDK добавлял
  всегда (LiveKit читает его отсутствие так же — прав SIP нет).

Отвергнутые варианты:

- **Оставить SDK.** Четыре вызова не оправдывают protobuf, Retrofit, второй JWT-библиотеки и
  принудительного OkHttp 5 для клиента Anthropic.
- **Protobuf вместо JSON.** Тот же объём зависимостей ради формата, который Twirp не требует.
- **`JwtEncoder` Spring Security.** В приложении один бин `JwtEncoder` с ключом портала; для
  LiveKit нужен свой секрет, а заводить второй бин ради одного класса незачем — `MACSigner`
  проще.

## Последствия

- Слой `dependencies` образа бэкенда (вывод `java -Djarmode=tools … extract --layers`): 119 → 109
  архивов, 89 186 811 → 82 564 809 байт (−6,6 МБ, −7,4 %).
- Новый метод LiveKit (например, `MutePublishedTrack` или вебхуки из плана
  `docs/roadmap/09-calls-waiting-recording.md`) пишется по документации тем же способом: вызов
  Twirp с JSON и токен с нужным правом; подпись вебхука проверяется Nimbus (JWT с секретом API и
  `sha256` тела).
- Формат токена и Twirp теперь на нас: при обновлении образа `livekit/livekit-server` смотреть
  изменения протокола в его заметках к выпуску.
