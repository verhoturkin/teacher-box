<div align="center">

<img src="frontend/public/favicon.svg" width="96" height="96" alt="">

# Teacher Box

**Портал репетитора, который работает на вашем сервере:** ученики, расписание, домашние задания,
оплаты, звонки и доски в одном месте — на компьютере и с телефона.

[![Версия](https://img.shields.io/github/v/tag/verhoturkin/teacher-box?label=%D0%B2%D0%B5%D1%80%D1%81%D0%B8%D1%8F&color=4f46e5&style=flat-square)](CHANGELOG.md)
[![CI](https://img.shields.io/github/actions/workflow/status/verhoturkin/teacher-box/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/verhoturkin/teacher-box/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/Docker-amd64%20%C2%B7%20arm64-0db7ed?style=flat-square&logo=docker&logoColor=white)](https://github.com/verhoturkin?tab=packages&repo_name=teacher-box)
[![Java](https://img.shields.io/badge/Java-25-e76f00?style=flat-square&logo=openjdk&logoColor=white)](backend)
[![Angular](https://img.shields.io/badge/Angular-21-dd0031?style=flat-square&logo=angular&logoColor=white)](frontend)
[![Material 3](https://img.shields.io/badge/Material%203-Expressive-7c4dff?style=flat-square&logo=materialdesign&logoColor=white)](docs/design-system.md)

[**Установка за 5 минут**](#установка-за-5-минут) ·
[Возможности](https://github.com/verhoturkin/teacher-box/wiki/Features) ·
[Первые шаги](https://github.com/verhoturkin/teacher-box/wiki/First-steps) ·
[Обновление](https://github.com/verhoturkin/teacher-box/wiki/Update) ·
[Вопросы и ответы](https://github.com/verhoturkin/teacher-box/wiki/FAQ)

</div>

<table>
<tr>
<td width="33%" valign="top">

### 🧑‍🏫 Один учитель

Регистрации «с улицы» нет: ученики входят по ссылке-приглашению и видят только своё.

</td>
<td width="33%" valign="top">

### 🔒 Данные у вас

Всё на вашем сервере или NAS в одном каталоге; резервные копии — каждую ночь.

</td>
<td width="33%" valign="top">

### 🇷🇺 Сервисы из коробки

Telegram, ВКонтакте и MAX, Яндекс Телемост, свои доски; ИИ-помощник — по желанию.

</td>
</tr>
</table>

> [!TIP]
> Поставить портал на Linux-сервер — одна команда, дальше установщик спросит домен и всё сделает сам:
>
> ```bash
> curl -fsSL https://raw.githubusercontent.com/verhoturkin/teacher-box/main/scripts/install.sh | sudo bash
> ```

<details>
<summary><b>Содержание</b></summary>

- [Возможности](#возможности)
- [Установка за 5 минут](#установка-за-5-минут)
- [Первые шаги](#первые-шаги)
- [Обновление](#обновление)
- [Настройки](#настройки)
- [Частые вопросы](#частые-вопросы)
- [Безопасность](#безопасность)
- [Разработка](#разработка)
- [Документация](#документация)

</details>

## Возможности

<table>
<tr>
<td width="33%"><img src="docs/assets/readme/people.svg" width="40" height="40" align="left" alt="">&nbsp;<b>Ученики и группы</b><br>&nbsp;<sub>приглашение по ссылке, кабинет, фото</sub></td>
<td width="33%"><img src="docs/assets/readme/calendar.svg" width="40" height="40" align="left" alt="">&nbsp;<b>Расписание</b><br>&nbsp;<sub>регулярные занятия, перенос, календари</sub></td>
<td width="33%"><img src="docs/assets/readme/homework.svg" width="40" height="40" align="left" alt="">&nbsp;<b>Домашние задания</b><br>&nbsp;<sub>файлы, очередь проверки, оценки</sub></td>
</tr>
<tr>
<td width="33%"><img src="docs/assets/readme/money.svg" width="40" height="40" align="left" alt="">&nbsp;<b>Оплаты</b><br>&nbsp;<sub>баланс, долги, отчёт за месяц</sub></td>
<td width="33%"><img src="docs/assets/readme/video.svg" width="40" height="40" align="left" alt="">&nbsp;<b>Звонки</b><br>&nbsp;<sub>видеозвонки прямо в портале</sub></td>
<td width="33%"><img src="docs/assets/readme/board.svg" width="40" height="40" align="left" alt="">&nbsp;<b>Доски</b><br>&nbsp;<sub>Excalidraw вместе с учеником</sub></td>
</tr>
<tr>
<td width="33%"><img src="docs/assets/readme/bell.svg" width="40" height="40" align="left" alt="">&nbsp;<b>Уведомления</b><br>&nbsp;<sub>Telegram, ВКонтакте, MAX, бот</sub></td>
<td width="33%"><img src="docs/assets/readme/sparkle.svg" width="40" height="40" align="left" alt="">&nbsp;<b>ИИ-помощник</b><br>&nbsp;<sub>черновики заданий и проверок</sub></td>
<td width="33%"><img src="docs/assets/readme/shield.svg" width="40" height="40" align="left" alt="">&nbsp;<b>Данные у вас</b><br>&nbsp;<sub>свой сервер, копии каждую ночь</sub></td>
</tr>
</table>

Что умеют учитель, ученик и администратор — в вики:
[Возможности](https://github.com/verhoturkin/teacher-box/wiki/Features) ·
[Мессенджеры](https://github.com/verhoturkin/teacher-box/wiki/Messengers) ·
[Расписание и календари](https://github.com/verhoturkin/teacher-box/wiki/Schedule) ·
[Звонки](https://github.com/verhoturkin/teacher-box/wiki/Calls) ·
[Доски](https://github.com/verhoturkin/teacher-box/wiki/Boards) ·
[ИИ-помощник](https://github.com/verhoturkin/teacher-box/wiki/AI-assistant).

## Установка за 5 минут

Нужны сервер, компьютер или NAS с **Docker** и **Docker Compose v2** (около **1 ГБ** памяти),
а для учеников снаружи — адрес с **HTTPS**. Портал ставится из готовых образов:

```bash
curl -fsSL https://raw.githubusercontent.com/verhoturkin/teacher-box/main/scripts/install.sh | sudo bash
```

Установщик задаст домен, часовой пояс и звонки, запишет настройки в `/opt/teacher-box/.env` и
напечатает адрес и пароль. Дальше портал обслуживает команда `teacherbox` (`status`, `logs`,
`update`, `backups`, `config`).

<details>
<summary><b>Вручную, свой HTTPS, NAS</b></summary>

```bash
mkdir teacher-box && cd teacher-box
curl -fsSLO https://raw.githubusercontent.com/verhoturkin/teacher-box/main/compose.yaml
curl -fsSL https://raw.githubusercontent.com/verhoturkin/teacher-box/main/.env.example -o .env
docker compose up -d
```

Откройте `http://<адрес-сервера>:8080`, войдите как `teacher` (пароль — в
`docker compose logs backend | grep "Teacher account"`). Для HTTPS проще всего встроенный Caddy
(`TEACHERBOX_DOMAIN` + `COMPOSE_PROFILES=https`), со своим прокси — направьте его на
`localhost:8080` с WebSocket. На NAS (Synology/QNAP/TrueNAS) — тот же `compose.yaml` проектом
Container Manager. Подробно — [вики](https://github.com/verhoturkin/teacher-box/wiki/Install).

</details>

## Первые шаги

1. После первого входа — первоначальная настройка: пароль, имя, название и адрес портала, цена занятия.
2. **Ученики** → «Добавить ученика»: отправьте ученику ссылку-приглашение.
3. **Расписание** → «Занятие»: после урока отметьте «Проведено» или «Пропуск» — занятие спишется с баланса.
4. **Уведомления** → «Мессенджеры» → «Подключить»: напоминания в Telegram, ВКонтакте или MAX.
5. Проверьте копии: «Настройки» → «Резервные копии» → «Создать копию сейчас».

Пошагово — [вики](https://github.com/verhoturkin/teacher-box/wiki/First-steps).

## Обновление

```bash
sudo teacherbox update
```

При ручной установке — свежий `compose.yaml`, `docker compose pull`, `docker compose up -d`.
Перед обновлением сделайте и скачайте копию. Что изменилось —
[CHANGELOG.md](CHANGELOG.md). Подробно, включая переходы со старых compose-файлов, —
[вики](https://github.com/verhoturkin/teacher-box/wiki/Update).

## Настройки

Все переменные с пояснениями — в [.env.example](.env.example): для запуска хватает блока «Main»
(домен, часовой пояс, звонки). Администратор меняет настройки и в интерфейсе — значения оттуда
важнее `.env`. Эксплуатация, безопасность, журналы — [docs/operations.md](docs/operations.md).

## Частые вопросы

**Учитель забыл пароль.** Задайте в `.env` новый `TEACHERBOX_IDENTITY_TEACHER_PASSWORD` и
`TEACHERBOX_IDENTITY_TEACHER_RESET_PASSWORD=true`, перезапустите портал
(`docker compose up -d`), войдите с новым паролем и верните
`TEACHERBOX_IDENTITY_TEACHER_RESET_PASSWORD=false`.

**Ученик забыл пароль.** «Ученики» → в строке ученика «Ссылка для сброса пароля» — отправьте её ученику.

**Ссылки в сообщениях ведут не туда.** Проверьте адрес: «Настройки» → «Портал» (или
`TEACHERBOX_PUBLIC_URL`).

**Не приходят сообщения в Telegram.** Из России нужен
[прокси](https://github.com/verhoturkin/teacher-box/wiki/Proxy).

**Как перенести портал на другой сервер.** Скачайте копию, установите портал на новом сервере,
положите архив в `/data/restore/` и перезапустите контейнер.

**Портал не запускается после изменения настроек администратором.** Исправьте значение в
`config/settings.properties` в каталоге данных и перезапустите контейнер.

**Где хранятся данные.** Всё — в Docker-томе `teacherbox-data`; «Полный сброс» удаляет данные
(кроме входов и копий), перед этим портал делает копию.

## Безопасность

- Данные учеников не покидают ваш сервер; наружу уходят только сообщения в подключённые
  мессенджеры и — по нажатию учителя — тексты для ИИ-помощника.
- Ученик видит только своё; администратор не видит данных учеников, его действия пишутся в журнал.
- Откройте портал в интернет только через HTTPS.

## Разработка

- Backend: Java 25, Spring Boot 4, Spring Modulith, H2 (файловый режим)
- Frontend: Angular 21 LTS, PrimeNG 21 (MIT) с темой Material 3 Expressive, шрифт Google Sans, TypeScript (strict)
- Поставка: Docker Compose — два контейнера (nginx и приложение)

## Документация

- 📖 [Вики](https://github.com/verhoturkin/teacher-box/wiki) — руководства пользователя:
  [установка](https://github.com/verhoturkin/teacher-box/wiki/Install),
  [мессенджеры](https://github.com/verhoturkin/teacher-box/wiki/Messengers),
  [расписание](https://github.com/verhoturkin/teacher-box/wiki/Schedule),
  [звонки](https://github.com/verhoturkin/teacher-box/wiki/Calls),
  [доски](https://github.com/verhoturkin/teacher-box/wiki/Boards),
  [ИИ-помощник](https://github.com/verhoturkin/teacher-box/wiki/AI-assistant),
  [прокси](https://github.com/verhoturkin/teacher-box/wiki/Proxy),
  [копии](https://github.com/verhoturkin/teacher-box/wiki/Backups),
  [вопросы и ответы](https://github.com/verhoturkin/teacher-box/wiki/FAQ)
- 🛠️ [Эксплуатация](docs/operations.md) — команда `teacherbox`, копии, интеграции, диагностика
- 🧩 [Дизайн-система](docs/design-system.md) и [план](docs/PLAN.md) — для разработчиков
