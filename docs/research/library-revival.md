# Возобновление разработки fastify-grammy

> **Архив исследования исходной версии 0.1.0.** Наблюдения, версии и результаты проверок ниже относятся к snapshot [`4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2`](https://github.com/blasdfaa/fastify-grammy/tree/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2), а не к текущей реализации 0.2.0. Ссылки на код намеренно закреплены на этом commit, включая удалённую фабрику Bot. Утверждённая спецификация опубликована в [issue #1](https://github.com/blasdfaa/fastify-grammy/issues/1); реализация ведётся в [PR #7](https://github.com/blasdfaa/fastify-grammy/pull/7). Актуальный публичный API описан в [README](../../README.md) и [инструкции миграции](../migration-0.2.0.md). Этот архив не является отчётом о проверках нового релиза.

Дата исследования: **28 октября 2026 года, Asia/Novosibirsk**. Запросы к npm registry выполнены 27 октября 2026 года около 21:59 UTC; HTTP `Date` и часы окружения согласованы. Версии ниже получены из реального registry, а не спрогнозированы по календарю. `latest` означает стабильную версию из npm dist-tag `latest`; prerelease-теги отдельно отмечены. Матрица описывает состояние репозитория **до обновлений**.

Источники: npm registry API, опубликованные npm tarball, официальная документация, исходники с тегами релизов и release notes владельцев проектов. В исследовательском проходе зависимости не устанавливались; совместимость предложенного набора сборкой и тестами тогда не подтверждалась.

Исследован snapshot `HEAD = 4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2`. По [registry самого пакета](https://registry.npmjs.org/fastify-grammy) последний опубликованный `fastify-grammy` — **0.1.0 от 14 ноября 2024 года**. Его manifest содержит тот же проблемный `postinstall`, что и репозиторий. Первоначальное исследование охватывало библиотеку целиком; отдельного issue/spec и diff для ревью на том этапе не было. Исходным публичным контрактом служил README, а поведение lifecycle дополнительно сверялось с upstream. Последующий утверждённый контракт опубликован в [issue #1](https://github.com/blasdfaa/fastify-grammy/issues/1).

**Главный вывод:** библиотеку можно обновить в пределах Fastify 5 и grammY 1. Приоритет перед релизом — исправить установку, публичные TypeScript-примеры и управление lifecycle. Простое обновление lockfile оставит подтверждённые ошибки. После интервью пользователь утвердил breaking-релиз **0.2.0**, включающий сразу polling, webhook и manual, только готовые Bot и единый типизированный реестр. [Утверждённый контракт](#утверждённый-контракт-020) ниже заменяет предварительное предложение о setup callback и постепенном добавлении режимов. На момент завершения исследования контракт ещё не был реализован; в том исследовательском проходе менялся только данный документ. Текущий ход реализации отражён в [PR #7](https://github.com/blasdfaa/fastify-grammy/pull/7).

## Версии и рекомендуемый набор

Исходное состояние взято из [package.json](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/package.json), [pnpm-lock.yaml](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/pnpm-lock.yaml) и [манифеста playground](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/playground/package.json). Суффиксы peer resolution в lockfile опущены.

| Пакет | Объявлено | Зафиксировано | Актуальная стабильная | Рекомендация |
| --- | --- | --- | --- | --- |
| `@fastify/error` | `^4.1.0` | `4.1.0` | [4.2.1](https://registry.npmjs.org/@fastify%2ferror/4.2.1) | `^4.2.1`; сохранить runtime dependency |
| `fastify-plugin` | `5.0.1` | `5.0.1` | [6.0.1](https://registry.npmjs.org/fastify-plugin/6.0.1) | `^6.0.1`; версия 6 совместима с Fastify 5 |
| `grammy` | `^1.35.1` | `1.35.1` | [1.46.0](https://registry.npmjs.org/grammy/1.46.0) | `^1.46.0`; обновить lifecycle интеграции |
| `@antfu/eslint-config` | `^3.9.1` | `3.9.1` | [10.0.0](https://registry.npmjs.org/@antfu%2feslint-config/10.0.0) | `^10.0.0` вместе с ESLint 10; отдельно просмотреть изменения правил |
| `@types/node` | `^20.17.6` | `20.17.6` | [26.6.5](https://registry.npmjs.org/@types%2fnode/26.6.5) | Для runtime Node 22 — [^22.20.5](https://registry.npmjs.org/@types%2fnode/22.20.5); для Node 24 — [^24.19.2](https://registry.npmjs.org/@types%2fnode/24.19.2). Типы должны соответствовать минимальному поддерживаемому runtime |
| `bumpp` | `^9.8.1` | `9.8.1` | [12.3.0](https://registry.npmjs.org/bumpp/12.3.0) | `^12.3.0`; проверить release-команду без выполнения публикации |
| `changelogen` | `^0.5.7` | `0.5.7` | [0.6.2](https://registry.npmjs.org/changelogen/0.6.2) | Удалить, если он не войдёт в release-процесс; в текущих scripts не используется |
| `eslint` | `^9.14.0` | `9.14.0` | [10.13.0](https://registry.npmjs.org/eslint/10.13.0) | `^10.13.0`; текущий flat config остаётся подходящей формой |
| `fastify` | `5.1.0` | `5.1.0` | [5.12.7](https://registry.npmjs.org/fastify/5.12.7) | Dev dependency `^5.12.7` плюс peer dependency `^5.0.0`; не переходить на `6.0.0-alpha.5` |
| `lefthook` | `1.8.2` | `1.8.2` | [2.2.2](https://registry.npmjs.org/lefthook/2.2.2) | `^2.2.2`; проверить hook и установку бинарного пакета |
| `publint` | `^0.2.12` | `0.2.12` | [0.3.25](https://registry.npmjs.org/publint/0.3.25) | `^0.3.25`; запускать после сборки |
| `tsup` | `^8.3.5` | `8.3.5` | [9.0.0](https://registry.npmjs.org/tsup/9.0.0) | Для первого этапа `^9.0.0` с TypeScript 6; замену на tsdown делать отдельным проверяемым изменением |
| `typescript` | `5.6.3` | `5.6.3` | [7.0.2](https://registry.npmjs.org/typescript/7.0.2) | Совместимый первый этап — [6.0.3](https://registry.npmjs.org/typescript/6.0.3). TS 7 требует отдельно решить совместимость compiler API |
| `vitest` | `^2.1.5` | `2.1.5` | [5.0.5](https://registry.npmjs.org/vitest/5.0.5) | `^5.0.5`; желательно явно добавить Vite [^8.3.5](https://registry.npmjs.org/vite/8.3.5) как обязательный peer |
| `pnpm` | `packageManager: pnpm@9.13.1` | lockfile format `9.0` | [12.15.0](https://registry.npmjs.org/pnpm/12.15.0) | Закрепить `pnpm@12.15.0`, обновить lockfile этим менеджером и проверить чистую установку |
| Playground `fastify` | `latest` | `5.1.0` | [5.12.7](https://registry.npmjs.org/fastify/5.12.7) | Явно `^5.12.7`, чтобы пример не перескочил на следующий major |
| Playground `fastify-grammy` | `latest` | `link:..` | Локальный пакет | Явная локальная/workspace-ссылка вместо registry `latest` и глобального override собственного пакета |

Рекомендуемый совместимый первый шаг: **Fastify 5.12.7, fastify-plugin 6.0.1, grammY 1.46.0, ESLint 10.13.0 + Antfu 10.0.0, TypeScript 6.0.3, Vitest 5.0.5 + Vite 8.3.5, tsup 9.0.0, pnpm 12.15.0**. Это обоснованный целевой набор для проверки, не заявление о прошедших тестах. Отступление от `typescript@latest` обусловлено реальными peer/API ограничениями, перечисленными ниже.

## Node.js: runtime и среда разработки

По [официальному индексу дистрибутивов](https://nodejs.org/dist/index.json) на момент запроса:

| Линия Node | Последний выпущенный | Статус |
| --- | --- | --- |
| 20 | `20.20.2` | По [release schedule](https://github.com/nodejs/Release/blob/main/schedule.json) EOL с 30 апреля 2026 |
| 22 | `22.23.4` | Выпущенная LTS, Jod; EOL 30 апреля 2027 |
| 24 | `24.22.1` | Выпущенная LTS, Krypton; EOL 30 апреля 2028 |
| 26 | `26.12.1` | В индексе пока `lts: false`; плановая дата перехода в LTS — 28 октября 2026 |

Не следует объявлять Node 26 уже выпущенной LTS только на основании плановой даты. Для воспроизводимой работы сейчас подходит **Node 24.22.1**; CI имеет смысл проверять на актуальных 22, 24 и 26.

Минимум runtime библиотеки нельзя выводить из dev dependencies. Fastify 5 официально [требует Node 20+](https://github.com/fastify/fastify/blob/v5.12.7/docs/Guides/Migration-Guide-V5.md#long-term-support-cycle), grammY 1.46.0 в manifest допускает `^12.20.0 || >=14.13.1`. В интервью пользователь выбрал для 0.2.0 поддержку **Node 22+**. Отказ от EOL Node 20 — утверждённая политика проекта, а не вынужденное изменение grammY API.

Для **разработки** требования выше:

| Инструмент | Фактическое ограничение |
| --- | --- |
| [ESLint 10.13.0](https://registry.npmjs.org/eslint/10.13.0) | Node `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| [Vitest 5.0.5](https://registry.npmjs.org/vitest/5.0.5) | Node `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`; Vite peer `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0` |
| [tsup 9.0.0](https://registry.npmjs.org/tsup/9.0.0), [bumpp 12.3.0](https://registry.npmjs.org/bumpp/12.3.0), [tsdown 0.23.2](https://registry.npmjs.org/tsdown/0.23.2) | Node `^22.18.0 \|\| ^24.11.0 \|\| >=26.0.0` |
| Antfu 10 → [eslint-plugin-jsdoc 65.4.1](https://registry.npmjs.org/eslint-plugin-jsdoc/65.4.1) | Node `^22.22.2 \|\| >=24.15.0`: транзитивный пакет повышает минимум среды разработки |
| Antfu 10 → [eslint-plugin-unicorn 78.0.0](https://registry.npmjs.org/eslint-plugin-unicorn/78.0.0) | Node `>=22`, ESLint `>=10.4`; широкий peer Antfu `^9.10.0 \|\| ^10.0.0` сам по себе недостаточен |
| [pnpm 12.15.0](https://pnpm.io/installation) | Сам pnpm — native executable; npm installer требует Node 18+, `npx get-pnpm` — Node 22.13+. Нельзя переносить требования pnpm 11 на pnpm 12 |

У `@fastify/error`, `fastify-plugin`, `fastify`, `lefthook`, `@antfu/eslint-config` и `changelogen` в проверенных latest manifest поле `engines` отсутствует. Это не доказательство поддержки любого Node: нужно учитывать документацию и транзитивные зависимости.

## Существенные миграции tooling

### TypeScript 7 и compiler API

[Официальный анонс TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) объясняет переход на нативный компилятор и совместимый пакет `@typescript/typescript6`. Старый синхронный compiler API не предоставляется обычным `typescript@7` так, как ожидают существующие инструменты.

Это актуальная проблема данного набора:

- Antfu 10 зависит от `@typescript-eslint/parser ^8.72.0`; [parser 8.72.1](https://registry.npmjs.org/@typescript-eslint%2fparser/8.72.1) объявляет peer `typescript >=4.8.4 <6.1.0`.
- В [опубликованном tarball tsup 9.0.0](https://registry.npmjs.org/tsup/-/tsup-9.0.0.tgz) bundled `rollup-plugin-dts 6.5.1` проверяет `createProgram` и явно требует `@typescript/typescript6`, если установлен TypeScript 7. Сам tsup также содержит обращения к старому compiler API. Широкий peer `typescript >=4.5.0` в manifest не гарантирует работоспособность с TS 7.
- [Manifest rollup-plugin-dts 6.5.1](https://registry.npmjs.org/rollup-plugin-dts/6.5.1) подтверждает peer совместимого пакета; заявление «достаточно обновить TypeScript» было бы неверным.

Для первого этапа проще оставить `typescript: 6.0.3`. Если принципиален новый компилятор, Microsoft документирует схему aliases:

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.2",
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

В этой схеме `tsc` принадлежит TS 7, `tsc6` — совместимому пакету, а инструменты, импортирующие `typescript`, получают API 6. Для проекта это отдельный вариант миграции, требующий проверки lint, деклараций и package exports.

[TypeScript 6](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) меняет defaults: `types` по умолчанию `[]`, меняется вывод `rootDir`, включается `noUncheckedSideEffectImports`. В конфигурации нужно явно перечислить необходимые `types`, например `node`. TS 7 превращает ряд deprecated в TS 6 параметров в ошибки. Текущие `moduleResolution: Bundler` и `module: ESNext` сами по себе не требуют замены; потребительские NodeNext/Node16 сценарии нужно проверять отдельно.

### Сборка: tsup и tsdown

У tsup существует свежий **9.0.0**, однако его [README с этим тегом](https://github.com/egoist/tsup/blob/v9.0.0/README.md) по-прежнему предупреждает: проект больше активно не поддерживается и рекомендует tsdown. Оставить tsup 9 на первый этап позволяет сократить объём одновременной миграции, но это не долгосрочное решение по поддерживаемости.

Альтернатива — [tsdown 0.23.2](https://registry.npmjs.org/tsdown/0.23.2). Его [официальный migration guide с тегом релиза](https://github.com/rolldown/tsdown/blob/v0.23.2/docs/guide/migrate-from-tsup.md) и [описание форматов](https://github.com/rolldown/tsdown/blob/v0.23.2/docs/options/output-format.md) подтверждают:

- ESM — default, CJS поддерживается: CLI `--format esm --format cjs`; `--dts` поддерживается. CJS-specific функциональность находится в maintenance-only режиме.
- Очистка output включена по умолчанию, target берётся из `engines.node`. Имена `.mjs`/`.d.mts` могут потребовать синхронизации с существующими `.js`/`.d.ts` в `exports`. Проверить нужно обе ветви `import`/`require` и их declaration files.
- Система плагинов основана на Rolldown вместо esbuild. Автоматический migrator сначала устанавливает 0.22.14 для удаления deprecated tsup-compatible options; в 0.23 старые имена options удалены. У проекта конфигурация минимальна, поэтому ручная явная настройка может быть проще migrator.
- Несмотря на стабильный npm dist-tag, версия tsdown ещё `0.x`, а 0.23.2 зависит от `rolldown-plugin-dts ^0.29.0-beta.2`. Это реальный риск prerelease-транзитивной зависимости, который следует учитывать при выборе сборщика.
- [README именно rolldown-plugin-dts 0.29.0-beta.2](https://github.com/sxzz/rolldown-plugin-dts/blob/v0.29.0-beta.2/README.md) указывает: generator `tsc` требует TS 5/6; generator `tsgo` — TS **7.1+** с declaration emit API. На дату исследования TS 7.1 ещё beta. Для стабильного TS 7.0.2 нельзя обещать автоматическую работу деклараций. Варианты — совместимый TS 6 API либо Oxc с `isolatedDeclarations` и явными аннотациями. Каждый вариант нужно подтвердить сборкой.

Таким образом, **смена tsup на tsdown сама по себе не решает конфликт с TS 7**. Не стоит одновременно менять сборщик, compiler API и публичные exports без промежуточной проверки пакета.

### Fastify, ESLint, Vitest, pnpm и hooks

`fastify-plugin 6` **не означает Fastify 6**: [package.json v6.0.1](https://github.com/fastify/fastify-plugin/blob/v6.0.1/package.json) тестирует `fastify: ^5.0.0`, а [README](https://github.com/fastify/fastify-plugin/blob/v6.0.1/README.md) использует metadata `fastify: '5.x'`. [Release notes v6](https://github.com/fastify/fastify-plugin/releases/tag/v6.0.0) описывают стандартизацию entry points/структуры и удаление deprecated interface. Ограничение плагина `fastify: '5.x'` можно сохранить; проверить нужно типизацию и import/require опубликованного пакета.

Для [ESLint 10](https://eslint.org/docs/latest/use/migrate-to-10.0.0) legacy eslintrc удалён, изменён поиск конфигурации и набор defaults. Репозиторий уже использует flat config. [Antfu 10 release notes](https://github.com/antfu/eslint-config/releases/tag/v10.0.0) отдельно включают новые правила переноса строк; обновление способно дать большой форматирующий diff, который полезно отделить от исправлений поведения.

[Vitest 4 migration guide](https://v4.vitest.dev/guide/migration.html) меняет семантику `restoreAllMocks`, mocks конструкторов и часть test configuration. [Vitest 5 migration guide](https://vitest.dev/guide/migration/) добавляет `clearMocks: true` по умолчанию, запрещает вложенные hoisted `vi.mock`/`vi.hoisted` и делает Vite обязательным peer вместо direct dependency. pnpm обычно устанавливает peer автоматически, но явный Vite в devDependencies делает выбор версии прозрачным и воспроизводимым. Нельзя считать старые тесты совместимыми только из-за успешной установки.

[Документация pnpm 12 build settings](https://pnpm.io/settings/build) требует явно описывать dependency build scripts через `allowBuilds`/`permissions`; по умолчанию неизвестные build scripts запрещены, `strictDepBuilds: true` превращает их в ошибку установки. Настройки `onlyBuiltDependencies`/`ignoredBuiltDependencies` и связанные варианты удалены в v11. При переходе с pnpm 9 необходимо проверить установку esbuild/lefthook, закрепить нужные решения в [pnpm-workspace.yaml](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/pnpm-workspace.yaml) и получить воспроизводимый lockfile. Применять старые рекомендации для pnpm 10 без сверки с pnpm 12 нельзя. [Release notes pnpm 12](https://github.com/pnpm/pnpm/releases/tag/v12.0.0) подтверждают изменения проверки workspace settings и совместимость headless установки существующих lockfile; обновление графа зависимостей всё равно потребует нового resolution.

[Lefthook 2 release notes](https://github.com/evilmartians/lefthook/releases/tag/v2.0.0) удаляют `skip_output` и regexp-форму `exclude`, меняют CLI framework и Windows command executor на `sh`. Текущий [lefthook.yml](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/lefthook.yml) этих удалённых параметров не использует, но работоспособность hook после установки ещё нужно проверить. [Bumpp 12](https://github.com/antfu-collective/bumpp/releases/tag/v12.0.0) прекращает поддержку Node 20.

## Контракт grammY и Fastify: что должна учитывать интеграция

Ниже факты из [Bot v1.46.0](https://github.com/grammyjs/grammY/blob/v1.46.0/src/bot.ts) и [Fastify hooks v5.12.7](https://github.com/fastify/fastify/blob/v5.12.7/docs/Reference/Hooks.md). Они задают требования к исправлениям lifecycle; переход на новый major Fastify/grammY для этого не нужен.

| Контракт upstream | Следствие для интеграции |
| --- | --- |
| `bot.init(signal?)` получает `getMe`, кэширует инициализацию; `config.botInfo` позволяет избежать этого запроса | Поддержать управляемую инициализацию и ошибки startup; не подменять Telegram API переменной окружения библиотеки |
| `bot.start()` возвращает promise на всё время polling, выполняет `deleteWebhook`, затем **await** `onStart(botInfo)`, затем polling | Нельзя `await bot.start()` как обычную короткую startup-операцию. Promise нужно сохранить, ошибки наблюдать. Polling автоматически удаляет установленный webhook |
| `isRunning()` становится `true` ещё до завершения init и до `onStart` | Это индикатор запущенного polling lifecycle, а не подтверждение готовности Telegram API |
| После setup grammY блокирует добавление middleware через `use` | Приложение настраивает готовый Bot до регистрации и polling; ранний старт в теле Fastify plugin делает последующую настройку приложения ненадёжной |
| `PollingOptions.onStart` имеет тип `void \| Promise<void>` и upstream его ожидает | Обёртка callback обязана возвращать/ожидать пользовательский promise, включая его rejection |
| Default `bot.errorHandler` пишет в console, останавливает polling и повторно бросает ошибку; `bot.catch(handler)` задаёт обработчик middleware errors | Не проглатывать rejection `start()`. Нужны структурированное логирование и явный пользовательский error handler с описанной политикой остановки |
| `bot.stop()` отменяет запрос, подтверждает offset через дополнительный `getUpdates`, но **не ждёт завершения middleware**; в 1.46.0 повторный stop безопасен | Для graceful shutdown дождаться и `stop()`, и сохранённого promise `start()`. Не обещать полное завершение обработки после одного `stop()` |
| Fastify `onReady` выполняется до listen, вызывается также `ready()` и не позволяет добавлять routes/hooks | Настроить объект бота во время регистрации, а старт/контроль готовности разместить в подходящей фазе, не блокируя hook бесконечным promise polling |
| Fastify `onListen` ошибки логирует и игнорирует; hook не запускается при `inject()`/`ready()` | Выбор `onListen` меняет контракт тестов и propagation startup errors; это должно быть осознанным API-решением |
| Fastify `onClose` идёт после завершения HTTP-запросов; `preClose` доступен до HTTP drain | Остановка polling и зависимых ресурсов должна иметь проверяемый порядок; длительные Telegram middleware нельзя оставлять работающими после освобождения их ресурсов |

### Webhook и дополнительные возможности

У grammY уже есть [webhookCallback](https://github.com/grammyjs/grammY/blob/v1.46.0/src/convenience/webhook.ts) и [готовый Fastify adapter](https://github.com/grammyjs/grammY/blob/v1.46.0/src/convenience/frameworks.ts), включая `request.body`, `reply`, проверку `X-Telegram-Bot-Api-Secret-Token` и ответ 401. Опции callback: `secretToken`, `onTimeout`, `timeoutMilliseconds` (по умолчанию 10 секунд). Callback инициализирует bot и вызывает `handleUpdate`; `bot.catch` при webhook режиме не применяется, ошибки передаются web framework. Сам callback **не регистрирует webhook в Telegram**.

Направления, рассмотренные на этапе исследования; итоговый выбор зафиксирован в утверждённом контракте:

1. Режимы `polling`, `webhook`, `manual` с явным владением запуском и остановкой. Не запускать polling при регистрации webhook: upstream callback запрещает смешивать эти режимы.
2. Передача готового `Bot<C>` или configure callback до старта: это сохраняет custom context, плагины grammY, API transformers и пользовательский error handler.
3. Типобезопасный реестр именованных ботов и явный доступ к одному боту; общий `any` лишает потребителя основной пользы TypeScript.
4. Состояние readiness и наблюдаемые ошибки startup/runtime; сохранить различие между ошибкой подключения к Telegram и ошибкой обработки update.
5. Runner как отдельная будущая интеграция: upstream рекомендует `@grammyjs/runner` для высокой нагрузки и долгих middleware. Не добавлять его обязательной зависимостью, пока не определены concurrency и shutdown semantics.

Само обновление grammY 1.x не требует несовместимого interface. Проект осознанно выбрал breaking-релиз 0.2.0: изменение формы реестра, готовый bot и обязательный режим запуска войдут в один релиз с описанием миграции и проверенными примерами.

## Ревью: Standards

Отдельных репозиторных AGENTS.md, CLAUDE.md, CONTRIBUTING.md или coding standards не найдено. Ниже эксплуатационные дефекты и замечания о качестве; эвристики оформления не выдаются за обязательные стандарты. P1 — исправить перед новым релизом; P2 — существенное исправление следующего этапа. Ошибки публичного контракта TypeScript выделены в отдельную ось Spec.

| Приоритет | Место | Подтверждение и последствия | Исправление |
| --- | --- | --- | --- |
| P1 | [package.json, строка 29](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/package.json#L29) | `postinstall: lefthook install` опубликован, но `lefthook` есть только в devDependencies. При обычном npm install со scripts у потребителя без своего lefthook команда недоступна; установка может завершиться ошибкой. Registry manifest и `npm pack --dry-run --ignore-scripts` подтверждают состав. Чистая установка tarball пока не запускалась | Убрать consumer-facing hook, установку git hooks сделать явной командой разработчика. Не переносить lefthook в production dependencies |
| P1 | [create-bot-factory.ts, строка 12](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/utils/create-bot-factory.ts#L12) | `TEST=true` меняет production-поведение и перехватывает все Bot API-вызовы, возвращая `true` даже для `getMe` и `getUpdates`. Ветка присутствует в собранном пакете; успешный тест может скрывать уже упавший polling | Удалить ветку из библиотеки; тестировать через штатный `config.client.fetch` с корректными ответами либо подготовленный bot |
| P2 | [ci.yml, строка 45](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/.github/workflows/ci.yml#L45) | Матрица задаёт `matrix.node`, но setup-node читает отсутствующий `matrix.node-version`. Обещанная версия Node не применяется | Единое имя ключа и явная матрица поддерживаемых Node. Установку закреплённого pnpm выполнять воспроизводимо |
| P2 | [package.json, строка 31](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/package.json#L31) | `prepublishOnly` и `release` запускают тесты с `publint` до сборки. В чистом checkout каталога dist нет; сборка в `prepack` происходит позже. Подтверждено scripts и порядком lifecycle npm, публикация не запускалась | Одна проверяемая последовательность: build → lint → tests → package checks; проверить путь из чистого checkout. Порядок описан в [npm scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/) |
| P2 | [index.test.ts, строка 11](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/test/index.test.ts#L11) | `afterEach` не возвращает и не ожидает `app.close()`. Тесты не подтверждают, что shutdown завершился, а реальные polling-сбои скрываются библиотекой | Ожидать teardown, изолировать транспорт, проверять состояния запуска/остановки и ошибки |

Эвристика, а не отдельный дефект: [createBotFactory](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/utils/create-bot-factory.ts#L5) объявлена `async` без асинхронной работы. Синхронная фабрика уменьшит сложность interface и устранит источник ошибки `Promise<Bot>`. Абстракции над каждым методом grammY библиотеке не нужны.

Ось Standards: **5 находок**, наиболее серьёзная — consumer `postinstall`.

## Ревью: Spec

Это проверка требований README. Поведения, которые README не определяет, перечислены ниже отдельно, чтобы не приписывать проекту несуществующую спецификацию.

| Приоритет | Требование README | Ошибка implementation и подтверждение | Исправление |
| --- | --- | --- | --- |
| P1 | [README, строка 65](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/README.md#L65): `grammy: FastifyGrammyBot` | [create-bot-factory.ts, строка 22](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/utils/create-bot-factory.ts#L22): `ReturnType` асинхронной фабрики равен `Promise<Bot>`, хотя decorator содержит обычный Bot. Consumer `bot.command(...)` даёт TS2339; проверены ESM и CJS декларации | В 0.2.0 удалить внутреннее создание bot и описывать фактический готовый `Bot<C>`; не сохранять Promise в публичном типе |
| P1 | [README, строка 56](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/README.md#L56): пользователь расширяет FastifyInstance своим типом | [types.ts, строка 6](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/types.ts#L6) уже объявляет `grammy: any`. Буквальный пример augmentation, включая named bots, даёт TS2717: свойство повторно объявлено с другим типом | В 0.2.0 дать единый registry decorator и отдельную расширяемую карту имён/типов; старую augmentation заменить инструкцией миграции |
| P1 | [README, строка 50](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/README.md#L50): `middlewares: [session()]` | [types.ts, строка 15](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/types.ts#L15): `Middleware[]` фиксирует базовый Context, поэтому session flavor не принимается — TS2769. `config: BotConfig<any>` также не связывает пользовательский ContextConstructor с контекстом middleware | В 0.2.0 middleware и context настраиваются на готовом `Bot<C>` средствами grammY до регистрации; registry сохраняет этот тип. Нужен компилируемый пример session с initial state |

Ось Spec: **3 находки**, все мешают использовать документированный TypeScript interface. Проверки выполнены виртуальным TypeScript consumer с настройками strict/skipLibCheck проекта. Отдельной issue-спецификации не было; по ней выводов нет.

## Подтверждённые ошибки runtime и недоопределённый interface

Эти результаты дополняют две оси ревью: README не обещает точные readiness, shutdown и scope semantics, однако наблюдаемое поведение конфликтует с безопасным использованием upstream. Все перечисленные runtime-сценарии воспроизведены без Telegram-сети: через `config.client.fetch` либо изолированную подмену `Bot.start/stop` для проверки регистрации.

| Приоритет | Место | Воспроизведение | Последствие и решение |
| --- | --- | --- | --- |
| P1 | [plugin.ts, строка 56](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/plugin.ts#L56) | Offline transport возвращает `401 Unauthorized` для `deleteWebhook`: `ready()` успешно, `bot.isRunning()` уже false | `.catch(() => {})` скрывает ошибку запуска; приложение обслуживает HTTP без работающего бота. Startup должен отклонять readiness; runtime rejection должен логироваться и передаваться в явно определённую политику ошибки |
| P1 | [plugin.ts, строка 48](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/plugin.ts#L48) | Ответ `getMe` удерживается promise: `await register(...)` и `ready()` уже завершены, `bot.isInited() === false` | Готовность Fastify не означает готовность бота. Нужна явно ожидаемая фаза init/startup; ожидать весь `start()` в hook нельзя, он живёт до остановки |
| P1 | [plugin.ts, строка 46](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/plugin.ts#L46) | Middleware удерживается promise, затем вызывается `await app.close()`: close завершается, middleware всё ещё работает | `stop()` не дожидается обработки update; зависимые ресурсы могут уже закрыться. Сохранить promise `start()` и дождаться его после остановки polling |
| P2 | [plugin.ts, строка 53](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/plugin.ts#L53) | Асинхронный пользовательский `onStart` ждёт gate, но `getUpdates` уже вызван | Обёртка теряет promise callback. Вернуть/await его, чтобы сохранить upstream ordering и rejection semantics |
| P2 | [plugin.ts, строка 25](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/plugin.ts#L25) | Root с named bot, затем два sibling scopes с одинаковым локальным name: второй scope получает duplicate error, имя первого появляется в root registry | Унаследованный объект мутируется вместо локального decorator. Явно определить наследование/затенение и создать локальный registry; проверить изоляцию siblings. Основание: [Fastify encapsulation](https://fastify.dev/docs/latest/Reference/Encapsulation/) |
| P2 | [plugin.ts, строка 8](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/plugin.ts#L8) | Сначала unnamed Bot, затем `name: 'extra'`: регистрация молча добавляет `extra` прямо на существующий Bot | Type guard принимает любой объект за registry. В 0.2.0 заменить обе формы единым registry; не определять форму по `typeof object` |
| P2 | [plugin.ts, строка 30](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/src/plugin.ts#L30) | Первая регистрация `name: 'constructor'` получает duplicate error | Проверка читает Object.prototype. Использовать own-key checks и registry без прототипа либо Map |

Ещё один подтверждённый сценарий: после завершения startup `bot.command(...)` бросает штатную ошибку grammY о поздней установке middleware. Именно такой порядок использует [playground](https://github.com/blasdfaa/fastify-grammy/blob/4eb3fae77da657bc8a8fcb2e3fa2f8133f3badc2/playground/index.js). В 0.2.0 приложение настраивает готовый Bot до регистрации; одного переноса запуска в `onReady` недостаточно для кода, который настраивает bot после `await register(...)`, поскольку await уже инициирует boot.

## Утверждённый контракт 0.2.0

Пользователь утвердил этот контракт итоговым ответом на Q27 после согласования Q1–Q26 в интервью `/grill-me`. Это спецификация будущего релиза, **не описание возможностей опубликованной 0.1.0 и не отчёт о выполненной реализации**. Предварительные предложения о setup callback, сохранении single/named формы и переносе webhook/manual на следующие релизы заменены решениями ниже.

### Цель и поддержка

- **Q1:** module обеспечивает настройку до запуска, проверяемую готовность, наблюдаемые ошибки и завершение обработки при shutdown в Fastify.
- **Q2:** выпускается `0.2.0`; несовместимые изменения допускаются с инструкцией миграции.
- **Q3, Q6:** поддерживаются Fastify 5, Node.js 22+, ESM `import` и CommonJS `require`, включая их declarations.
- **Q4, Q23:** polling, webhook и manual входят сразу в 0.2.0. Инструменты обновляются до последних совместимых стабильных версий; временное использование TypeScript 6 согласовано. Переход на TypeScript 7 — отдельная проверяемая миграция.

### Регистрация, реестр и типы

- **Q11, Q15:** одна регистрация plugin принимает один уже созданный и настроенный `Bot<C>`. Собственных options `token`, `config`, `middlewares` и callback `setup` нет. Приложение настраивает commands, session, API transformers и `bot.catch` до регистрации.
- **Q5, Q15:** `name` необязателен, его default — `default`. Для любого количества ботов используется один interface: `app.grammy.get(name)`.
- **Q16:** приложение явно объявляет глобальную расширяемую карту имён и типов ботов. Тип bot при регистрации должен соответствовать имени, а lookup сохраняет полный `Bot<C>`. Один key во всех scopes означает один тип контекста; разным типам нужны разные имена.
- **Q17:** `get(name)` бросает понятную ошибку, если bot отсутствует или не виден в текущем scope. Карта TypeScript не доказывает runtime-наличия или readiness; lookup не должен молча приводить результат к произвольному контексту.
- **Q8:** родительские боты видны потомкам. Созданные в дочернем scope не видны родителю и sibling scopes. Повтор имени, уже видимого через предка, запрещён; затенения нет. Независимые scopes могут иметь одинаковое локальное имя при выполнении правил типов и владения.
- **Q18:** один экземпляр Bot не может одновременно принадлежать нескольким регистрациям. Управляемые режимы требуют отсутствия внешнего polling/runner/webhook; уже инициализированный bot допустим. Manual допускает внешнее исполнение, которым plugin не управляет. Обнаружить внешний runner автоматически гарантировать нельзя: отсутствие второго владельца также является условием использования.
- **Q26:** внутри одного Fastify-приложения один токен может принадлежать только одной управляемой регистрации, даже если экземпляры Bot и scopes разные. Manual не получает владение доставкой и не резервирует токен как управляемый режим. Это не разрешает конкурирующую доставку при наличии управляемой регистрации.

Явная карта нужна потому, что стандартный Fastify `register()` не накапливает типы options нескольких регистраций в возвращаемом FastifyInstance. Declaration merging глобален для TypeScript-программы и не моделирует runtime scopes. Эти ограничения проверены локальным TypeScript consumer. Название экспортируемой карты, точная структура уведомлений об ошибках и способ чтения lifecycle state определяются при реализации типов; согласованные гарантии не зависят от этих имён.

### Режимы и внешние действия

**Q7, Q10:** `mode: 'polling' | 'webhook' | 'manual'` обязателен, default-режима нет.

| Режим | Ответственность plugin | Ответственность приложения |
| --- | --- | --- |
| `polling` | Инициализация, запуск, наблюдение долгоживущего promise, остановка и ожидание завершения обработки | Настроить Bot до регистрации, задать обработчик middleware errors и политику восстановления |
| `webhook` | Предварительная инициализация, локальный POST route, проверка секрета и учёт всей обработки update | Настроить внешний URL, вызвать `setWebhook`, управлять развёртыванием и удалённой конфигурацией |
| `manual` | Только предоставление Bot через registry | Инициализация, внешний runner или другой способ доставки, остановка и завершение обработки |

- **Q12:** в webhook-режиме plugin не вызывает `setWebhook` или снятие webhook в Telegram; запуск локального сервера не переключает удалённую доставку.
- **Q13, Q24:** `path` и `secretToken` обязательны для webhook. URL не генерируется из имени. POST route работает в обычных правилах Fastify routes/prefixes; секрет проверяется штатным адаптером grammY.
- **Q25:** явный выбор polling разрешает штатный `deleteWebhook` при `bot.start()`. Это может переключить доставку с другого сервера. Исключение относится к polling и не отменяет запрет remote provisioning в webhook-режиме.

### Готовность, ошибки и время

- **Q9, Q20:** запуск управляемого bot имеет настраиваемый таймаут, default **30 секунд**. Он охватывает инициализацию и подтверждение старта polling. При превышении plugin отклоняет готовность Fastify, отменяет начатые отменяемые startup-операции через abort и выполняет остановку/cleanup частичного запуска. Одного отклонения внешнего promise без отмены фонового init недостаточно. В manual startup-операций plugin нет, поэтому таймаут к нему не применяется.
- Readiness нельзя подтверждать только по `isRunning()`: управляемый startup должен действительно завершиться. При polling нужно сохранить promise `start()`, но не ожидать его полного завершения в boot. Пользовательский async `onStart` сохраняет upstream ordering и rejection semantics.
- **Q9:** фатальная ошибка после успешного запуска логируется, отражается в lifecycle state и передаётся пользовательскому обработчику. Plugin автоматически не закрывает HTTP-сервер и не завершает процесс; политику выбирает приложение.
- **Q22:** для ошибок отдельных updates сохраняются штатные механизмы: пользовательский `bot.catch` при polling, обработчики Fastify при webhook. Plugin не заменяет настроенный `bot.catch`. Его уведомление о фатальной ошибке дополняет эти механизмы.
- **Q22:** собственные restart loop и хранение обработанных `update_id` не добавляются. Это не отменяет штатные внутренние retry grammY. Восстановление после фатального сбоя и идемпотентность обработчиков остаются приложению.

### Webhook reply и завершение обработки

- **Q14:** закрытие управляемых режимов ждёт фактического завершения всех обрабатываемых updates без внутреннего принудительного deadline. Зависший обработчик задерживает close; общий бюджет завершения процесса задаёт приложение или среда развёртывания. В manual plugin не получает обязанности останавливать и дожидаться внешнего исполнения.
- Для polling необходимо дождаться `stop()` и сохранённого promise `start()`: первый сам по себе не означает окончания middleware.
- **Q21:** webhook callback работает без внутреннего конечного таймаута (`timeoutMilliseconds: Infinity`), чтобы его полный task оставался наблюдаемым до завершения обработки. HTTP-дедлайн Fastify или прокси не считается отменой этого task.
- **Q19:** приложение может включить штатный webhook-reply у подготовленного Bot; plugin его не запрещает. По умолчанию upstream его не использует. Ранний HTTP-ответ не означает завершения middleware: полный task всё равно отслеживается и ожидается при shutdown.
- Если HTTP-ответ уже отправлен, последующую ошибку нельзя превратить в другой HTTP status. Она остаётся наблюдаемой через логирование и уведомление; нельзя обещать повторную доставку со стороны Telegram после успешного ответа.

Основания этих ограничений: [webhookCallback v1.46.0](https://github.com/grammyjs/grammY/blob/v1.46.0/src/convenience/webhook.ts), [client и canUseWebhookReply](https://github.com/grammyjs/grammY/blob/v1.46.0/src/core/client.ts), [Telegram setWebhook](https://core.telegram.org/bots/api#setwebhook) и [update_id](https://core.telegram.org/bots/api#update). Конечный timeout callback не отменяет middleware. Telegram может повторять доставку, а его попытки и срок хранения updates ограничены; гарантий exactly-once или безусловной доставки plugin не даёт. Распределённая координация нескольких приложений и серверов в контракт не входит.

### Форма будущей регистрации

Пример показывает утверждённую форму options, а не работающий interface версии 0.1.0. Предполагаются уже настроенные `supportBot`, `webhookSecret` и явная карта типа `support` в приложении:

```ts
await app.register(fastifyGrammy, {
  name: 'support',
  bot: supportBot,
  mode: 'webhook',
  path: '/telegram/support',
  secretToken: webhookSecret,
  startupTimeoutMs: 30_000,
})

app.grammy.get('support')
```

### Миграция с 0.1.0

1. Создать `Bot<C>` средствами grammY и настроить его до `register`, включая session, commands, API transformers и error handler.
2. Передавать `bot` вместо plugin options `token/config/middlewares`; обязательный `mode` выбрать явно.
3. Объявить карту имён/типов и заменить `app.grammy` или `app.grammy[name]` на `app.grammy.get(name)`. Основной bot получает имя `default`.
4. Для webhook указать `path` и `secretToken`, отдельно настроить внешний URL и Telegram регистрацию.
5. Удалить зависимость тестов от `TEST=true`: подготовить Bot с корректным offline transport. Ожидать закрытие приложения и проверять полную обработку.
6. Проверить visibility scopes, исключительное владение Bot/токеном и отсутствие неявного автоматического закрытия сервера после runtime failure.

Поддержка внешнего runner возможна через manual. Специальный runner adapter, metrics и встроенное хранение updates в 0.2.0 не требуются.

## Проверки исходного snapshot 0.1.0

Среда: **Node 22.12.0, pnpm 9.13.1**, существующие node_modules и lockfile. Новые зависимости не устанавливались, версии manifest/lockfile не менялись.

| Проверка | Результат | Что он подтверждает |
| --- | --- | --- |
| `pnpm build` | Успешно | Текущие ESM, CJS и declarations генерируются |
| `TEST=true pnpm test` | Успешно: 6 unit tests, `tsc --noEmit`, `publint` | Базовые текущие проверки с production TEST-подменой; не доказательство рабочего polling или корректных consumer types |
| ESM import / CJS require собранного пакета | Успешно | Обе runtime-ветви exports загружаются на текущем Node |
| Потребительские TS snippets | Найдены TS2339, TS2717, TS2769 | Ошибки публичных типов и примеров README, пропущенные текущим `test:types` |
| Offline lifecycle/registration repro | Подтверждены readiness, startup rejection, shutdown drain, onStart, named scope/shape/key ошибки | Не зависят от токена или доступности Telegram |
| `pnpm lint` | Ошибка: 253 замечания в существующих локальных файлах skills | Не следует объявлять это 253 ошибками кода библиотеки: эти файлы были untracked до исследования |
| ESLint по tracked source/test/playground/config/README/CI | 0 ошибок; warning об игнорируемом CHANGELOG | Проверенные файлы проекта проходят текущие правила; поведение запуска из editor часть правил отключает |
| `npm pack --dry-run --ignore-scripts` | Состав подтверждён | README, package.json и dist; LICENSE отсутствует |
| Новый целевой стек | Не проверялся выполнением | Нужна отдельная миграция на поддерживаемом Node и чистая установка |

### Audit зависимостей

`pnpm audit --prod --json` завершился с кодом 1: **37 advisories, из них 1 critical, 23 high, 8 moderate, 5 low**. Проверка охватывает workspace: найденные пути идут через `playground > fastify@5.1.0` и его транзитивные зависимости. Это нельзя описывать как 37 уязвимостей runtime-зависимостей опубликованного fastify-grammy: Fastify у самой библиотеки находится в devDependencies, а приложение выбирает host отдельно.

Примеры источников: [Fastify content-type validation bypass, GHSA-mg2h-6x62-wpwc](https://github.com/advisories/GHSA-mg2h-6x62-wpwc), исправлено в 5.3.2; [proxy-addr trust subnet IP spoofing, GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), исправлено в 2.0.8. Наличие advisory подтверждено; эксплуатация конкретно этим plugin не исследовалась. Обновить host и пересобрать весь graph, затем повторить workspace и consumer audit на новом lockfile, а не ограничиться заменой трёх direct dependencies.

## План реализации и критерии готовности

План приведён к утверждённому контракту Q27: все три режима, готовый Bot и единый registry входят в **один релиз 0.2.0**, даже если работа разбивается на несколько проверяемых изменений.

1. **Восстановить установку и доверие к проверкам.** Удалить consumer postinstall и production TEST mock вместе с внутренним созданием bot. Подготовить корректный offline Bot API transport и ожидать teardown. Воспроизвести найденные ошибки, сохранив релевантные сценарии для нового interface.
2. **Обновить совместимый стек.** Закрепить Node для разработки, pnpm и версии из таблицы, обновить весь workspace lockfile. Явно решить pnpm dependency build settings. Использовать TypeScript 6; TS 7 alias-схему оставить последующей миграцией. Проверить сборку и обе ветви exports до расширения поведения. Большой formatting diff ESLint отделить от логики.
3. **Реализовать готовый Bot и scoped registry.** Один bot на регистрацию, обязательный mode, default name, `get(name)` с runtime error, глобальная карта типов и проверка соответствия при регистрации. Проверить parent/child/siblings, запрет shadowing, специальные имена и отсутствие мутации родителей. Экземпляр эксклюзивен между всеми одновременными регистрациями, включая manual; ограничение одного управляемого владельца токена относится к polling/webhook.
4. **Реализовать managed polling и manual.** В polling контролировать init/startup, сохранить полный promise `start()`, ожидать пользовательский async onStart, соблюдать default 30 секунд и cleanup при ошибке/таймауте. При close выполнить stop и full drain. В manual не выполнять init/start/stop и не вмешиваться во внешний runner. Уже инициализированные bots должны работать по контракту.
5. **Реализовать webhook в том же релизе.** Предварительный init, обязательные path/secret, локальный POST route и стандартный Fastify adapter без remote provisioning. Callback без конечного внутреннего timeout; отслеживать полные tasks, включая обработку после раннего ответа. Проверить routes/prefixes, secret header и отсутствие автоматического переключения Telegram webhook при boot/close.
6. **Проверить ошибки и завершение работы всех режимов.** Startup failure отклоняет boot; runtime fatal наблюдаем через лог/state/уведомление, без автоматического закрытия Fastify. Сохранить bot.catch/Fastify error policies. Проверить post-reply error, shutdown во время обработки, close во время запуска и отсутствие собственных restart/dedup механизмов.
7. **Обновить документацию, playground и выпуск.** Переписать README под ready Bot, карту типов и все три режима; добавить migration guide с 0.1.0, примеры внешней Telegram webhook регистрации и предупреждение о штатном deleteWebhook в polling. Исправить launcher playground: сейчас fastify-cli не объявлен для `fastify start`. Исправить CI matrix, проверить Node 22/24/26 и поддерживаемые ОС. Выполнять build→lint/tests→publint, устанавливать tarball во внешний чистый consumer с scripts и проверять import/require/types. Добавить LICENSE и package metadata, синхронизировать changelog; закрепить release-инструменты вместо неприкреплённого `npx changelogithub`. Публикация остаётся отдельным явным действием.

Приёмка должна проверять гарантии через публичный interface:

| Область | Критерий |
| --- | --- |
| Установка и exports | Чистый consumer устанавливает tarball без lefthook, загружает import/require и корректные declarations |
| Типы | Разные custom/session contexts сохраняются; неверное соответствие имени и bot отклоняется; отсутствует конфликт augmentation |
| Registry/scopes | Default и named bots имеют одинаковую форму доступа; отсутствующий/невидимый bot вызывает ошибку; нет shadowing и утечки в parent/siblings |
| Владение | Повтор экземпляра и повтор управляемого токена отвергаются; инициализированный bot принимается; manual не управляет внешним исполнением |
| Startup | Readiness ждёт реальный init/startup; ошибка, async onStart rejection и настраиваемый timeout приводят к boot failure и остановке начатого запуска |
| Polling | Наблюдаем полный start-promise, явный режим допускает штатный deleteWebhook, stop не выдаётся за окончание middleware |
| Webhook | Требуются path/secret; неверный секрет отвергается; внешний setWebhook не вызывается; ранний ответ не теряет full task |
| Shutdown | Управляемые режимы ждут обработчики, в том числе после webhook-reply и HTTP timeout; внутреннего forced deadline нет |
| Ошибки | Сохраняются штатные bot.catch/Fastify handlers; runtime fatal логируется и уведомляется; сервер автоматически не закрывается |
| Границы | Нет собственного restart loop, дедупликации, распределённой координации или обещания exactly-once |
| Релиз | Примеры и migration guide компилируются, CI соответствует поддержке, новый graph проходит audit без необъяснённых advisories |

Специальная runner-интеграция, TypeScript 7 и перенос с tsup на поддерживаемый сборщик могут быть последующими отдельными изменениями. Это не откладывает уже утверждённые webhook/manual и новый registry.

Само исследование и утверждение контракта не подтверждали выполнение критериев приёмки: исходники, manifest и lockfile в исследовательском проходе не изменялись. Результаты проверки реализации 0.2.0 следует читать в [PR #7](https://github.com/blasdfaa/fastify-grammy/pull/7); приведённые выше проверки описывают только исходный snapshot.
