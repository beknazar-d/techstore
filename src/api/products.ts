import { shop } from '../config/shop'
import type { Category, Product, ProductFilters, ProductInput, ProductSpecs, UsedInfo } from '../types'
import { slugify } from '../utils/slugify'
import { requireAdmin } from './auth'
import { clone, createId, delay, mutate, nowISO, readDb, uniqueSlug, type Db } from './db'
import { ApiError } from './errors'
import { notify } from './notify'

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

/** Оставляет только заполненные значения по ключам шаблона категории. */
function cleanSpecs(specs: ProductSpecs, category: Category): ProductSpecs {
  const clean: ProductSpecs = {}
  for (const field of category.specFields) {
    const value = specs[field.key]
    if (value === undefined || value === null) continue
    if (typeof value === 'string') {
      if (value.trim()) clean[field.key] = value.trim()
    } else if (typeof value === 'number') {
      if (Number.isFinite(value)) clean[field.key] = value
    } else {
      clean[field.key] = value
    }
  }
  return clean
}

function cleanUsedInfo(info: UsedInfo | null | undefined): UsedInfo {
  if (!info) throw new ApiError('validation', 'Для Б/У товара укажите состояние')
  const clean: UsedInfo = { grade: info.grade }
  if (info.batteryHealth !== undefined) {
    if (!isInt(info.batteryHealth) || info.batteryHealth < 1 || info.batteryHealth > 100) {
      throw new ApiError('validation', 'Ёмкость аккумулятора — целое число от 1 до 100')
    }
    clean.batteryHealth = info.batteryHealth
  }
  if (info.warrantyMonths !== undefined) {
    if (!isInt(info.warrantyMonths) || info.warrantyMonths < 0) {
      throw new ApiError('validation', 'Гарантия — целое число месяцев')
    }
    clean.warrantyMonths = info.warrantyMonths
  }
  if (info.defects?.trim()) clean.defects = info.defects.trim()
  if (info.kit?.trim()) clean.kit = info.kit.trim()
  return clean
}

/** Проверяет товар целиком (после слияния с изменениями) и приводит поля в порядок. */
function validate(product: Product, db: Db): void {
  product.name = product.name.trim()
  product.brand = product.brand.trim()
  product.description = product.description.trim()

  if (!product.name) throw new ApiError('validation', 'Укажите название товара')
  const category = db.categories.find((c) => c.id === product.categoryId)
  if (!category) throw new ApiError('validation', 'Выберите категорию')
  if (!isInt(product.price) || product.price <= 0) {
    throw new ApiError('validation', 'Цена — целое число больше нуля')
  }
  if (product.minPrice !== null) {
    if (!isInt(product.minPrice) || product.minPrice <= 0 || product.minPrice > product.price) {
      throw new ApiError('validation', 'Минимальная цена должна быть больше нуля и не выше обычной цены')
    }
  }
  if (!isInt(product.stock) || product.stock < 0) {
    throw new ApiError('validation', 'Остаток — целое число, не меньше нуля')
  }
  if (product.images.length > shop.maxProductImages) {
    throw new ApiError('validation', `Не больше ${shop.maxProductImages} фото на товар`)
  }
  product.usedInfo = product.condition === 'used' ? cleanUsedInfo(product.usedInfo) : null
  product.specs = cleanSpecs(product.specs, category)
}

/** Сообщает менеджерам, что товар заканчивается или закончился (только когда остаток уменьшился). */
export function notifyStock(product: Product, previousStock: number): void {
  if (product.stock >= previousStock) return
  if (product.stock === 0) {
    void notify({ type: 'stock_out', product })
  } else if (product.stock <= shop.lowStockThreshold) {
    void notify({ type: 'stock_low', product })
  }
}

/**
 * Список товаров, новые сверху.
 * `onlyActive` — для клиентской части: только активные товары из активных категорий.
 */
export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  await delay()
  const db = readDb()
  let categoryId = filters.categoryId
  if (filters.categorySlug) {
    const category = db.categories.find((c) => c.slug === filters.categorySlug)
    if (!category) return []
    categoryId = category.id
  }
  const activeCategoryIds = new Set(db.categories.filter((c) => c.isActive).map((c) => c.id))
  const search = filters.search?.trim().toLowerCase()

  let result = db.products.filter((p) => {
    if (categoryId && p.categoryId !== categoryId) return false
    if (filters.condition && p.condition !== filters.condition) return false
    if (filters.onlyActive && (!p.isActive || !activeCategoryIds.has(p.categoryId))) return false
    if (search && !`${p.name} ${p.brand}`.toLowerCase().includes(search)) return false
    return true
  })
  result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (filters.limit) result = result.slice(0, filters.limit)
  return clone(result)
}

/** Для клиентской части: находит только активный товар из активной категории. */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  await delay()
  const db = readDb()
  const product = db.products.find((p) => p.slug === slug && p.isActive)
  if (!product) return null
  const category = db.categories.find((c) => c.id === product.categoryId)
  return category?.isActive ? clone(product) : null
}

/** Для админки: находит любой товар, в том числе скрытый. */
export async function getProduct(id: string): Promise<Product | null> {
  await delay()
  return clone(readDb().products.find((p) => p.id === id) ?? null)
}

export async function createProduct(input: ProductInput): Promise<Product> {
  await delay()
  requireAdmin()
  return mutate(['products'], (db) => {
    const now = nowISO()
    const product: Product = {
      id: createId(),
      categoryId: input.categoryId,
      name: input.name,
      slug: '',
      brand: input.brand,
      description: input.description,
      condition: input.condition ?? 'new',
      usedInfo: input.usedInfo ?? null,
      price: input.price,
      minPrice: input.minPrice ?? null,
      stock: input.stock,
      isActive: input.isActive,
      images: input.images,
      specs: input.specs,
      createdAt: now,
      updatedAt: now,
    }
    validate(product, db)
    product.slug = uniqueSlug(slugify(input.slug?.trim() || product.name), db.products.map((p) => p.slug))
    db.products.push(product)
    return clone(product)
  })
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
  await delay()
  requireAdmin()
  let previousStock = 0
  const updated = mutate(['products'], (db) => {
    const index = db.products.findIndex((p) => p.id === id)
    if (index === -1) throw new ApiError('not_found', 'Товар не найден')
    const current = db.products[index]
    previousStock = current.stock

    const { slug, ...fields } = patch
    // undefined в patch означает «не менять».
    const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined))
    const next: Product = { ...current, ...changes, updatedAt: nowISO() }
    validate(next, db)
    if (slug !== undefined) {
      const others = db.products.filter((p) => p.id !== id).map((p) => p.slug)
      next.slug = uniqueSlug(slugify(slug.trim() || next.name), others)
    }
    db.products[index] = next
    return clone(next)
  })
  notifyStock(updated, previousStock)
  return updated
}

/** Удаляет товар. Заказы и заявки trade-in остаются: в них сохранены название и цена. */
export async function deleteProduct(id: string): Promise<void> {
  await delay()
  requireAdmin()
  mutate(['products', 'orders', 'tradeIns'], (db) => {
    const index = db.products.findIndex((p) => p.id === id)
    if (index === -1) throw new ApiError('not_found', 'Товар не найден')
    db.products.splice(index, 1)
    for (const order of db.orders) {
      if (order.productId === id) order.productId = null
    }
    for (const tradeIn of db.tradeIns) {
      if (tradeIn.desiredProductId === id) tradeIn.desiredProductId = null
    }
  })
}

/**
 * Меняет остаток на `delta` (+5 — приход, −1 — списание).
 * Остаток не может стать меньше нуля → `ApiError('out_of_stock')`.
 */
export async function adjustStock(id: string, delta: number): Promise<Product> {
  await delay()
  requireAdmin()
  if (!isInt(delta)) throw new ApiError('validation', 'Изменение остатка — целое число')
  let previousStock = 0
  const updated = mutate(['products'], (db) => {
    const product = db.products.find((p) => p.id === id)
    if (!product) throw new ApiError('not_found', 'Товар не найден')
    if (product.stock + delta < 0) {
      throw new ApiError('out_of_stock', `Нельзя списать больше, чем есть на складе (${product.stock} шт.)`)
    }
    previousStock = product.stock
    product.stock += delta
    product.updatedAt = nowISO()
    return clone(product)
  })
  notifyStock(updated, previousStock)
  return updated
}
