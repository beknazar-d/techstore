// Демо-данные для локальной версии. Попадают в localStorage при первом запуске.
// Цены в рублях. Фото нет — интерфейс показывает заглушку.

import type { Db } from '../api/db'
import type { Category, Product, ProductSpecs, SpecField, UsedInfo } from '../types'

const MEMORY = ['64 ГБ', '128 ГБ', '256 ГБ', '512 ГБ', '1 ТБ']
const RAM = ['4 ГБ', '6 ГБ', '8 ГБ', '12 ГБ', '16 ГБ', '24 ГБ', '32 ГБ']

function category(id: string, name: string, slug: string, sortOrder: number, specFields: SpecField[]): Category {
  return { id, name, slug, sortOrder, isActive: true, specFields }
}

const categories: Category[] = [
  category('cat-smartphones', 'Смартфоны', 'smartfony', 1, [
    { key: 'screen', label: 'Экран', unit: 'дюйм', type: 'number' },
    { key: 'memory', label: 'Память', type: 'select', options: MEMORY },
    { key: 'ram', label: 'Оперативная память', type: 'select', options: RAM },
    { key: 'camera', label: 'Основная камера', type: 'text' },
    { key: 'battery', label: 'Аккумулятор', unit: 'мА·ч', type: 'number' },
    { key: 'color', label: 'Цвет', type: 'text' },
    { key: 'sim', label: 'SIM-карты', type: 'select', options: ['1 nano-SIM', '2 nano-SIM', 'nano-SIM + eSIM'] },
    { key: 'nfc', label: 'NFC', type: 'boolean' },
  ]),
  category('cat-laptops', 'Ноутбуки', 'noutbuki', 2, [
    { key: 'cpu', label: 'Процессор', type: 'text' },
    { key: 'ram', label: 'Оперативная память', type: 'select', options: RAM },
    { key: 'ssd', label: 'Накопитель SSD', type: 'select', options: ['256 ГБ', '512 ГБ', '1 ТБ', '2 ТБ'] },
    { key: 'screen', label: 'Экран', unit: 'дюйм', type: 'number' },
    { key: 'gpu', label: 'Видеокарта', type: 'text' },
    { key: 'weight', label: 'Вес', unit: 'кг', type: 'number' },
    { key: 'os', label: 'Операционная система', type: 'text' },
  ]),
  category('cat-headphones', 'Наушники', 'naushniki', 3, [
    {
      key: 'type',
      label: 'Тип',
      type: 'select',
      options: ['Внутриканальные', 'Вкладыши', 'Накладные', 'Полноразмерные'],
    },
    { key: 'connection', label: 'Подключение', type: 'select', options: ['Bluetooth', 'Проводные', 'Bluetooth + кабель'] },
    { key: 'anc', label: 'Активное шумоподавление', type: 'boolean' },
    { key: 'battery_life', label: 'Время работы', unit: 'ч', type: 'number' },
    { key: 'color', label: 'Цвет', type: 'text' },
  ]),
  category('cat-watches', 'Смарт-часы', 'smart-chasy', 4, [
    { key: 'screen', label: 'Экран', unit: 'дюйм', type: 'number' },
    { key: 'case_size', label: 'Размер корпуса', unit: 'мм', type: 'number' },
    { key: 'battery_life', label: 'Время работы', type: 'text' },
    { key: 'water', label: 'Защита от воды', type: 'text' },
    { key: 'gps', label: 'GPS', type: 'boolean' },
    { key: 'compat', label: 'Совместимость', type: 'select', options: ['iOS', 'Android', 'iOS и Android'] },
    { key: 'color', label: 'Цвет', type: 'text' },
  ]),
  category('cat-hair', 'Фены и стайлеры', 'feny-i-staylery', 5, [
    { key: 'power', label: 'Мощность', unit: 'Вт', type: 'number' },
    { key: 'modes', label: 'Режимы', type: 'text' },
    { key: 'attachments', label: 'Насадки', type: 'text' },
    { key: 'weight', label: 'Вес', unit: 'г', type: 'number' },
    { key: 'cord', label: 'Длина шнура', unit: 'м', type: 'number' },
    { key: 'ionization', label: 'Ионизация', type: 'boolean' },
    { key: 'color', label: 'Цвет', type: 'text' },
  ]),
  category('cat-vacuums', 'Пылесосы', 'pylesosy', 6, [
    { key: 'type', label: 'Тип', type: 'select', options: ['Вертикальный беспроводной', 'Робот-пылесос', 'Классический'] },
    { key: 'suction', label: 'Мощность всасывания', type: 'text' },
    { key: 'runtime', label: 'Время работы', unit: 'мин', type: 'number' },
    { key: 'dustbin', label: 'Пылесборник', unit: 'л', type: 'number' },
    { key: 'weight', label: 'Вес', unit: 'кг', type: 'number' },
    { key: 'wet', label: 'Влажная уборка', type: 'boolean' },
  ]),
  category('cat-accessories', 'Аксессуары', 'aksessuary', 7, [
    {
      key: 'type',
      label: 'Тип',
      type: 'select',
      options: ['Зарядное устройство', 'Кабель', 'Внешний аккумулятор', 'Чехол', 'Защитное стекло'],
    },
    { key: 'compat', label: 'Совместимость', type: 'text' },
    { key: 'power', label: 'Мощность', unit: 'Вт', type: 'number' },
    { key: 'capacity', label: 'Ёмкость', unit: 'мА·ч', type: 'number' },
    { key: 'length', label: 'Длина', unit: 'м', type: 'number' },
    { key: 'color', label: 'Цвет', type: 'text' },
  ]),
]

interface SeedProduct {
  categoryId: string
  name: string
  slug: string
  brand: string
  description: string
  price: number
  minPrice?: number
  stock: number
  specs: ProductSpecs
  used?: UsedInfo
}

const products: SeedProduct[] = [
  // ---------- Смартфоны (новые) ----------
  {
    categoryId: 'cat-smartphones',
    name: 'Samsung Galaxy S24 8/256 ГБ',
    slug: 'samsung-galaxy-s24-8-256',
    brand: 'Samsung',
    description:
      'Компактный флагман с ярким AMOLED-экраном 120 Гц, быстрым процессором и семью годами обновлений. Хорошо лежит в руке и отлично снимает днём и ночью.',
    price: 64990,
    minPrice: 61990,
    stock: 8,
    specs: {
      screen: 6.2,
      memory: '256 ГБ',
      ram: '8 ГБ',
      camera: '50 + 12 + 10 Мп',
      battery: 4000,
      color: 'Чёрный оникс',
      sim: 'nano-SIM + eSIM',
      nfc: true,
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Apple iPhone 15 128 ГБ',
    slug: 'apple-iphone-15-128',
    brand: 'Apple',
    description:
      'Dynamic Island, основная камера 48 Мп и разъём USB-C. Алюминиевый корпус с матовым стеклом, которое не собирает отпечатки.',
    price: 69990,
    minPrice: 67490,
    stock: 6,
    specs: {
      screen: 6.1,
      memory: '128 ГБ',
      ram: '6 ГБ',
      camera: '48 + 12 Мп',
      battery: 3349,
      color: 'Голубой',
      sim: 'nano-SIM + eSIM',
      nfc: true,
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Xiaomi Redmi Note 13 Pro 8/256 ГБ',
    slug: 'xiaomi-redmi-note-13-pro-8-256',
    brand: 'Xiaomi',
    description:
      'Камера 200 Мп, AMOLED-экран 120 Гц и быстрая зарядка 67 Вт в комплекте. Один из лучших вариантов в своей цене.',
    price: 24990,
    minPrice: 23490,
    stock: 14,
    specs: {
      screen: 6.67,
      memory: '256 ГБ',
      ram: '8 ГБ',
      camera: '200 + 8 + 2 Мп',
      battery: 5000,
      color: 'Полночный чёрный',
      sim: '2 nano-SIM',
      nfc: true,
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Samsung Galaxy A55 8/128 ГБ',
    slug: 'samsung-galaxy-a55-8-128',
    brand: 'Samsung',
    description:
      'Металлическая рамка, защита от воды IP67 и экран Super AMOLED. Надёжный смартфон на каждый день с батареей на два дня.',
    price: 32990,
    stock: 10,
    specs: {
      screen: 6.6,
      memory: '128 ГБ',
      ram: '8 ГБ',
      camera: '50 + 12 + 5 Мп',
      battery: 5000,
      color: 'Тёмно-синий',
      sim: '2 nano-SIM',
      nfc: true,
    },
  },

  // ---------- Смартфоны (Б/У) ----------
  {
    categoryId: 'cat-smartphones',
    name: 'Apple iPhone 14 Pro 256 ГБ (Б/У)',
    slug: 'apple-iphone-14-pro-256-bu',
    brand: 'Apple',
    description:
      'Проверенный Б/У смартфон в отличном состоянии: экран и корпус без царапин, все функции работают. Проверка при получении.',
    price: 62990,
    minPrice: 59990,
    stock: 1,
    specs: {
      screen: 6.1,
      memory: '256 ГБ',
      ram: '6 ГБ',
      camera: '48 + 12 + 12 Мп',
      battery: 3200,
      color: 'Космический чёрный',
      sim: 'nano-SIM + eSIM',
      nfc: true,
    },
    used: {
      grade: 'excellent',
      batteryHealth: 91,
      warrantyMonths: 3,
      kit: 'Коробка, кабель USB-C — Lightning',
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Apple iPhone 13 128 ГБ (Б/У)',
    slug: 'apple-iphone-13-128-bu',
    brand: 'Apple',
    description:
      'Б/У смартфон в хорошем состоянии. Полностью исправен, Face ID и камеры работают. Небольшие следы использования на корпусе.',
    price: 34990,
    minPrice: 32990,
    stock: 1,
    specs: {
      screen: 6.1,
      memory: '128 ГБ',
      ram: '4 ГБ',
      camera: '12 + 12 Мп',
      battery: 3240,
      color: 'Тёмная ночь',
      sim: 'nano-SIM + eSIM',
      nfc: true,
    },
    used: {
      grade: 'good',
      batteryHealth: 86,
      warrantyMonths: 1,
      defects: 'Мелкие царапины на рамке',
      kit: 'Кабель, чехол в подарок',
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Apple iPhone 12 64 ГБ (Б/У)',
    slug: 'apple-iphone-12-64-bu',
    brand: 'Apple',
    description:
      'Недорогой Б/У iPhone для звонков, мессенджеров и соцсетей. Исправен, есть заметные следы использования — цена это учитывает.',
    price: 21990,
    minPrice: 19990,
    stock: 1,
    specs: {
      screen: 6.1,
      memory: '64 ГБ',
      ram: '4 ГБ',
      camera: '12 + 12 Мп',
      battery: 2815,
      color: 'Белый',
      sim: 'nano-SIM + eSIM',
      nfc: true,
    },
    used: {
      grade: 'fair',
      batteryHealth: 79,
      warrantyMonths: 1,
      defects: 'Царапины на экране, скол на углу корпуса',
      kit: 'Только смартфон и кабель',
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Samsung Galaxy S22 8/128 ГБ (Б/У)',
    slug: 'samsung-galaxy-s22-8-128-bu',
    brand: 'Samsung',
    description:
      'Компактный флагман прошлых лет в отличном состоянии. Экран без выгорания, корпус без сколов, аккумулятор держит день.',
    price: 27990,
    stock: 2,
    specs: {
      screen: 6.1,
      memory: '128 ГБ',
      ram: '8 ГБ',
      camera: '50 + 12 + 10 Мп',
      battery: 3700,
      color: 'Зелёный',
      sim: '2 nano-SIM',
      nfc: true,
    },
    used: {
      grade: 'excellent',
      warrantyMonths: 3,
      kit: 'Коробка, кабель USB-C',
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Xiaomi 12T 8/256 ГБ (Б/У)',
    slug: 'xiaomi-12t-8-256-bu',
    brand: 'Xiaomi',
    description:
      'Б/У смартфон с камерой 108 Мп и зарядкой 120 Вт. Хорошее состояние, на экране наклеено защитное стекло.',
    price: 17990,
    stock: 1,
    specs: {
      screen: 6.67,
      memory: '256 ГБ',
      ram: '8 ГБ',
      camera: '108 + 8 + 2 Мп',
      battery: 5000,
      color: 'Серебристый',
      sim: '2 nano-SIM',
      nfc: true,
    },
    used: {
      grade: 'good',
      warrantyMonths: 1,
      defects: 'Потёртости на задней крышке',
      kit: 'Коробка, зарядное устройство 120 Вт, чехол',
    },
  },

  // ---------- Ноутбуки ----------
  {
    categoryId: 'cat-laptops',
    name: 'Apple MacBook Air 13 M3 8/256 ГБ',
    slug: 'apple-macbook-air-13-m3-8-256',
    brand: 'Apple',
    description:
      'Тонкий и бесшумный ноутбук без вентилятора. До 18 часов работы от батареи, экран Liquid Retina и чип M3 для работы и учёбы.',
    price: 104990,
    minPrice: 99990,
    stock: 2,
    specs: {
      cpu: 'Apple M3 (8 ядер)',
      ram: '8 ГБ',
      ssd: '256 ГБ',
      screen: 13.6,
      gpu: 'Apple M3 GPU (8 ядер)',
      weight: 1.24,
      os: 'macOS',
    },
  },
  {
    categoryId: 'cat-laptops',
    name: 'Lenovo IdeaPad Slim 5 14 16/512 ГБ',
    slug: 'lenovo-ideapad-slim-5-14-16-512',
    brand: 'Lenovo',
    description:
      'Лёгкий металлический ноутбук с OLED-экраном и производительным Ryzen 7. Подсветка клавиатуры и быстрая зарядка через USB-C.',
    price: 62990,
    stock: 5,
    specs: {
      cpu: 'AMD Ryzen 7 8845HS',
      ram: '16 ГБ',
      ssd: '512 ГБ',
      screen: 14,
      gpu: 'AMD Radeon 780M',
      weight: 1.46,
      os: 'Без ОС',
    },
  },
  {
    categoryId: 'cat-laptops',
    name: 'ASUS Vivobook 15 8/512 ГБ',
    slug: 'asus-vivobook-15-8-512',
    brand: 'ASUS',
    description:
      'Доступный ноутбук для учёбы, офиса и фильмов. Большой экран 15,6 дюйма, цифровой блок клавиатуры и быстрый SSD.',
    price: 44990,
    stock: 7,
    specs: {
      cpu: 'Intel Core i5-1335U',
      ram: '8 ГБ',
      ssd: '512 ГБ',
      screen: 15.6,
      gpu: 'Intel Iris Xe',
      weight: 1.7,
      os: 'Windows 11 Home',
    },
  },

  // ---------- Наушники ----------
  {
    categoryId: 'cat-headphones',
    name: 'Apple AirPods Pro 2 (USB-C)',
    slug: 'apple-airpods-pro-2-usb-c',
    brand: 'Apple',
    description:
      'Активное шумоподавление, режим прозрачности и пространственный звук. Футляр с разъёмом USB-C и защитой от брызг.',
    price: 19990,
    stock: 12,
    specs: { type: 'Внутриканальные', connection: 'Bluetooth', anc: true, battery_life: 6, color: 'Белый' },
  },
  {
    categoryId: 'cat-headphones',
    name: 'Sony WH-1000XM5',
    slug: 'sony-wh-1000xm5',
    brand: 'Sony',
    description:
      'Полноразмерные наушники с одним из лучших шумоподавлений. Мягкие амбушюры, 30 часов работы и чистый звук в звонках.',
    price: 29990,
    minPrice: 27990,
    stock: 4,
    specs: { type: 'Полноразмерные', connection: 'Bluetooth + кабель', anc: true, battery_life: 30, color: 'Чёрный' },
  },
  {
    categoryId: 'cat-headphones',
    name: 'Xiaomi Redmi Buds 5',
    slug: 'xiaomi-redmi-buds-5',
    brand: 'Xiaomi',
    description:
      'Недорогие беспроводные наушники с шумоподавлением до 46 дБ. Лёгкие, с быстрой зарядкой: 5 минут — 2 часа музыки.',
    price: 2990,
    stock: 25,
    specs: { type: 'Внутриканальные', connection: 'Bluetooth', anc: true, battery_life: 10, color: 'Чёрный' },
  },

  // ---------- Смарт-часы ----------
  {
    categoryId: 'cat-watches',
    name: 'Apple Watch Series 10 46 мм',
    slug: 'apple-watch-series-10-46',
    brand: 'Apple',
    description:
      'Самые тонкие Apple Watch с большим экраном. Отслеживание сна и тренировок, быстрая зарядка, ответы на звонки с запястья.',
    price: 39990,
    stock: 5,
    specs: {
      screen: 1.96,
      case_size: 46,
      battery_life: 'До 18 часов',
      water: '50 м (WR50)',
      gps: true,
      compat: 'iOS',
      color: 'Глянцевый чёрный',
    },
  },
  {
    categoryId: 'cat-watches',
    name: 'Samsung Galaxy Watch7 44 мм',
    slug: 'samsung-galaxy-watch7-44',
    brand: 'Samsung',
    description:
      'Сапфировое стекло, точный двухдиапазонный GPS и анализ состава тела. Удобный ремешок и яркий экран под солнцем.',
    price: 22990,
    stock: 6,
    specs: {
      screen: 1.5,
      case_size: 44,
      battery_life: 'До 40 часов',
      water: '5 АТМ, IP68',
      gps: true,
      compat: 'Android',
      color: 'Зелёный',
    },
  },
  {
    categoryId: 'cat-watches',
    name: 'Xiaomi Smart Band 9',
    slug: 'xiaomi-smart-band-9',
    brand: 'Xiaomi',
    description:
      'Фитнес-браслет с ярким AMOLED-экраном и батареей до трёх недель. Считает шаги, пульс, сон и 150 видов тренировок.',
    price: 3490,
    stock: 30,
    specs: {
      screen: 1.62,
      battery_life: 'До 21 дня',
      water: '5 АТМ',
      gps: false,
      compat: 'iOS и Android',
      color: 'Чёрный',
    },
  },

  // ---------- Фены и стайлеры ----------
  {
    categoryId: 'cat-hair',
    name: 'Dyson Supersonic HD15',
    slug: 'dyson-supersonic-hd15',
    brand: 'Dyson',
    description:
      'Быстро сушит волосы без перегрева: датчик следит за температурой 40 раз в секунду. Пять магнитных насадок в комплекте.',
    price: 39990,
    minPrice: 37990,
    stock: 4,
    specs: {
      power: 1600,
      modes: '3 скорости, 4 температуры',
      attachments: 'Концентратор, диффузор, насадка для гладкости, для непослушных волос, расчёска',
      weight: 650,
      cord: 2.7,
      ionization: true,
      color: 'Никель / медь',
    },
  },
  {
    categoryId: 'cat-hair',
    name: 'Dyson Airwrap Complete Long',
    slug: 'dyson-airwrap-complete-long',
    brand: 'Dyson',
    description:
      'Мультистайлер для длинных волос: сушит, завивает, выпрямляет и придаёт объём воздухом, без экстремальных температур.',
    price: 54990,
    stock: 0,
    specs: {
      power: 1300,
      modes: '3 скорости, 3 температуры',
      attachments: 'Цилиндры 30 и 40 мм, щётки для гладкости, круглая щётка, фен-насадка',
      weight: 680,
      cord: 2.6,
      ionization: false,
      color: 'Синий / медный',
    },
  },
  {
    categoryId: 'cat-hair',
    name: 'Xiaomi Mijia High Speed H500',
    slug: 'xiaomi-mijia-high-speed-h500',
    brand: 'Xiaomi',
    description:
      'Компактный скоростной фен с ионизацией. Сушит волосы средней длины за пару минут и умещается в дорожную сумку.',
    price: 4990,
    stock: 15,
    specs: {
      power: 1600,
      modes: '2 скорости, 4 температуры',
      attachments: 'Концентратор',
      weight: 365,
      cord: 1.7,
      ionization: true,
      color: 'Белый',
    },
  },

  // ---------- Пылесосы ----------
  {
    categoryId: 'cat-vacuums',
    name: 'Dyson V15 Detect Absolute',
    slug: 'dyson-v15-detect-absolute',
    brand: 'Dyson',
    description:
      'Беспроводной пылесос с лазерной подсветкой пыли и счётчиком частиц на экране. До часа уборки на одном заряде.',
    price: 64990,
    minPrice: 61990,
    stock: 3,
    specs: {
      type: 'Вертикальный беспроводной',
      suction: '240 аВт',
      runtime: 60,
      dustbin: 0.76,
      weight: 3.1,
      wet: false,
    },
  },
  {
    categoryId: 'cat-vacuums',
    name: 'Xiaomi Robot Vacuum S20',
    slug: 'xiaomi-robot-vacuum-s20',
    brand: 'Xiaomi',
    description:
      'Робот-пылесос с лазерной навигацией и влажной уборкой. Строит карту квартиры, объезжает препятствия, управляется со смартфона.',
    price: 17990,
    stock: 6,
    specs: {
      type: 'Робот-пылесос',
      suction: '5000 Па',
      runtime: 130,
      dustbin: 0.4,
      weight: 3.3,
      wet: true,
    },
  },

  // ---------- Аксессуары ----------
  {
    categoryId: 'cat-accessories',
    name: 'Зарядное устройство Anker Nano 20 Вт USB-C',
    slug: 'anker-nano-20w-usb-c',
    brand: 'Anker',
    description: 'Компактная быстрая зарядка для смартфонов и наушников. Не греется и не занимает соседнюю розетку.',
    price: 1290,
    stock: 40,
    specs: { type: 'Зарядное устройство', compat: 'iPhone, Android, наушники', power: 20, color: 'Белый' },
  },
  {
    categoryId: 'cat-accessories',
    name: 'Внешний аккумулятор Baseus Bipow 20000 мА·ч',
    slug: 'baseus-bipow-20000',
    brand: 'Baseus',
    description:
      'Хватит на 3–4 полные зарядки смартфона. Экран с процентами заряда, два выхода USB и USB-C с быстрой зарядкой.',
    price: 2990,
    stock: 18,
    specs: {
      type: 'Внешний аккумулятор',
      compat: 'Смартфоны, планшеты, наушники',
      power: 20,
      capacity: 20000,
      color: 'Чёрный',
    },
  },
  {
    categoryId: 'cat-accessories',
    name: 'Кабель Baseus USB-C — USB-C 100 Вт, 1 м',
    slug: 'baseus-usb-c-usb-c-100w-1m',
    brand: 'Baseus',
    description: 'Кабель в прочной нейлоновой оплётке. Подходит для быстрой зарядки смартфонов и ноутбуков до 100 Вт.',
    price: 590,
    stock: 60,
    specs: { type: 'Кабель', compat: 'Устройства с USB-C', power: 100, length: 1, color: 'Чёрный' },
  },
]

/** Свежий демо-набор. Даты создания идут с шагом в час: первый товар в списке — самый новый. */
export function createSeed(): Db {
  const base = Date.now()
  const seededProducts: Product[] = products.map((item, index) => {
    const createdAt = new Date(base - index * 3_600_000).toISOString()
    return {
      id: `prod-${item.slug}`,
      categoryId: item.categoryId,
      name: item.name,
      slug: item.slug,
      brand: item.brand,
      description: item.description,
      condition: item.used ? 'used' : 'new',
      usedInfo: item.used ?? null,
      price: item.price,
      minPrice: item.minPrice ?? null,
      stock: item.stock,
      isActive: true,
      images: [],
      specs: item.specs,
      createdAt,
      updatedAt: createdAt,
    }
  })

  return {
    categories: structuredClone(categories),
    products: seededProducts,
    orders: [],
    orderEvents: [],
    tradeIns: [],
    tradeInEvents: [],
    nextOrderNumber: 1001,
    nextTradeInNumber: 501,
  }
}
