# Установка

## Что нужно

- Сервер, компьютер или NAS с **Docker** и **Docker Compose v2**, около **1 ГБ** свободной памяти
  и немного места на диске (база, файлы заданий и копии).
- Для учеников снаружи — адрес портала в интернете с **HTTPS** (свой домен и, например, Caddy
  перед порталом, см. ниже). Для пробы достаточно `http://localhost`.
- Современный браузер: Chrome, Edge, Firefox, Safari — на компьютере и телефоне.

## Установка за 5 минут

Портал ставится из готовых образов — исходники и сборка на сервере не нужны. На сервере с Linux
(Ubuntu, Debian и др.) выполните одну команду:

```bash
curl -fsSL https://raw.githubusercontent.com/verhoturkin/teacher-box/main/scripts/install.sh | sudo bash
```

Установщик поставит Docker, если его нет, и задаст три вопроса:

- **домен** портала, например `school.example.com`, — тогда портал сам получит сертификат и откроется
  по HTTPS (домен должен указывать на сервер). Без домена портал работает по `http://<сервер>:8080`;
- **часовой пояс** (по умолчанию `Europe/Moscow`);
- включить ли **звонки** в портале.

Затем он запишет настройки в `/opt/teacher-box/.env` (секреты сгенерирует сам), запустит портал и
напечатает адрес, логин `teacher` и пароль — после первого входа портал попросит его сменить. В конце
он перечислит порты, которые нужно открыть в файрволе облачного провайдера. Параметры для установки
без вопросов (`--domain`, `--no-calls`, `--port`, `--yes` …) — `install.sh --help`.

Дальше портал обслуживает команда `teacherbox`: `status`, `logs`, `update`, `backups`, `config`, `reset` —
подробнее в
[эксплуатации](https://github.com/verhoturkin/teacher-box/blob/main/docs/operations.md#команда-teacherbox).

## Установка вручную

На другой системе (NAS, Windows, macOS) или без установщика нужны только два файла:

```bash
mkdir teacher-box && cd teacher-box
curl -fsSLO https://raw.githubusercontent.com/verhoturkin/teacher-box/main/compose.yaml
curl -fsSL https://raw.githubusercontent.com/verhoturkin/teacher-box/main/.env.example -o .env
docker compose up -d
```

Откройте `http://<адрес-сервера>:8080` и войдите как `teacher`. Пароль сгенерирован и напечатан в
журнале: `docker compose logs backend | grep "Teacher account"`. Настройки — в `.env`: для начала
достаточно блока «Main» в его начале (домен, часовой пояс, звонки).

Портал — это два контейнера: `frontend` (nginx: интерфейс, передача запросов к API и к серверу
звонков) и `backend` (приложение и данные). Наружу открыт только `frontend`. Образы
`ghcr.io/verhoturkin/teacher-box-backend` и `-frontend` собраны для `amd64` и `arm64` (в том числе
Raspberry Pi и NAS на ARM); версию задаёт `TEACHERBOX_VERSION` в `.env` (по умолчанию `latest` —
последний выпуск).

**Сборка из исходников** (для разработки или своих изменений): в клоне репозитория
`docker compose -f compose.yaml -f compose.build.yaml up -d --build`.

## HTTPS

> [!IMPORTANT]
> Ученикам снаружи нужен адрес с HTTPS: без него браузер не даст звонкам камеру и микрофон, а
> материал не скопируется на доску картинкой.

Портал рассчитан на работу за HTTPS. Проще всего включить встроенный Caddy — он сам получит и будет
продлевать сертификат Let's Encrypt. Направьте домен на сервер, откройте порты 80 и 443 и добавьте в
`.env`:

```ini
TEACHERBOX_DOMAIN=school.example.com
COMPOSE_PROFILES=https
TEACHERBOX_HTTP_PORT=127.0.0.1:8080   # снаружи портал доступен только через HTTPS
```

Затем `docker compose up -d` — портал откроется на `https://school.example.com`. Звонки включаются
вместе с HTTPS так: `COMPOSE_PROFILES=https,calls`.

**Свой прокси.** Если на сервере уже есть nginx, Caddy или Traefik, профиль `https` не включайте, а
направьте прокси на `localhost:8080` (он должен пропускать WebSocket — для досок и звонков). Caddy:

```
school.example.com {
    reverse_proxy localhost:8080
}
```

## NAS

На Synology/QNAP/TrueNAS с Docker используйте тот же `compose.yaml`: создайте проект
(«Container Manager» → «Проект» на Synology), положите в его каталог `compose.yaml` и `.env`.
Данные хранятся в Docker-томе `teacherbox-data`.
