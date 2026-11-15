# Журнал работы

Новые записи — сверху. Формат: дата, раздел, что сделано, ключевые файлы, решения, что дальше.

## 2026-11-15 — UI-кит (часть 1) и ответы владельца

- Готово (neurogate + правки): `src/components/ui/` — Button/LinkButton, Input, Textarea, Select, Checkbox, Modal (хуки вынесены в ModalContent, фокус и Esc), Badge, StatusBadge, StockBadge, ConditionBadge.
- Не сделано из волны 1 (кончились лимиты neurogate): 06 Spinner/EmptyState, 07 ProductImage, 08 Chips, 09 ImagePicker.
- Решения владельца: город Москва, телефоны +7; заказ можно закрыть сразу из «нового»; trade-in на всех новых товарах (`shop.tradeInCategorySlugs` удалён); ссылки на админку в подвале нет; «(Б/У)» в названиях оставляем.
- Демо-данные: 3 заказа (№1001–1003) и 2 заявки trade-in (№501–502) в `src/data/seed.ts`; ключ хранилища поднят до `phone-market:db:v2`.
- Задания для исполнителей лежат в scratchpad сессии (`tasks/NN-*.md`). Если сессия новая и их нет — задания нужно написать заново по `AGENTS.md`.
- Дальше: волна 1 (06–09), затем волны 2–4.

## 2026-11-15 — Архитектура, слой данных, маршруты

- Типы: `src/types/index.ts` (Category/SpecField, Product с condition/usedInfo, Order/OrderEvent, TradeInRequest/TradeInEvent, input-типы).
- Настройки: `src/config/shop.ts` (заглушки названия/города/контактов, валюта ₽, демо-пароль), `src/config/labels.ts` (русские подписи статусов).
- Слой данных `src/api/` (вход только через `src/api/index.ts`): категории, товары, заказы, trade-in, вход-заглушка, `notify()` в консоль, `subscribe()` + событие `storage` между вкладками. Хранилище — `src/api/db.ts`, ключ `phone-market:db:v1`, демо-данные из `src/data/seed.ts` (7 категорий, 26 товаров, из них 5 Б/У).
- Логика склада: заявка списывает остаток, отмена возвращает ровно один раз, переходы статусов проверяются, каждое изменение пишет событие в историю.
- Утилиты `src/utils/`: formatPrice (`89 900 ₽`), phone, date, links, slugify, cn, compressImage, categoryIcon. Хуки `src/hooks/`: useAsync, useApiQuery (живое обновление), useAdminSession.
- Маршруты: `src/App.tsx` (клиент + ленивый `src/admin/AdminApp.tsx`), охрана `src/admin/RequireAdmin.tsx`. Страницы, шапка, подвал и каркас админки — пока заглушки.
- Решения: slug-запросы (`getProductBySlug`, `getCategoryBySlug`) отдают только активные записи; админские функции требуют сессию (имитация RLS); при удалении товара заказы остаются с `productId: null`; оценка trade-in ставится только через `evaluateTradeIn`.
- Известное ограничение: фото лежат в localStorage как data URL (~5 МБ на всё) — при переполнении api отдаёт понятную ошибку. Уйдёт с переездом на R2.
- Дальше: вёрстка по задачам исполнителей (32 задачи, 4 волны), затем ручная проверка сценариев.

## 2026-11-15 — Каркас проекта и ТЗ

- Создан проект: React 19 + Vite + TypeScript, react-router-dom, oxlint.
- Стили: CSS-модули, токены дизайна в `src/styles/tokens.css` (из `design/design/a7store_retail_system/DESIGN.md`). Tailwind удалён.
- ТЗ и правила для агентов — `AGENTS.md` (`CLAUDE.md` подключает его).
- Решения: корзины нет, онлайн-оплаты нет (оплата при получении); склад списывается при заявке и возвращается при отмене; сейчас локальная версия на `localStorage`, Supabase и Cloudflare подключим позже.
- Дальше: архитектура и логика (Fable), затем вёрстка клиентской части и админки (neurogate).
