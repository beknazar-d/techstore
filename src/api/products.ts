import { shop } from '../config/shop'
import type { Category, Product, ProductFilters, ProductInput, ProductSpecs, UsedInfo } from '../types'
import { slugify } from '../utils/slugify'
import { getCategory } from './categories'
import { emit, supabase, uniqueSlug, unwrap } from './client'
import { ApiError } from './errors'
import { msg } from '../i18n'

/** Колонки, доступные всем. min_price и cost_price анониму не выданы (права на колонки). */
const PUBLIC_COLUMNS =
  'id, category_id, name, slug, brand, description, condition, used_info, price, stock, is_active, images, specs, created_at, updated_at'
/** Для админки. */
const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, min_price, cost_price`

interface ProductRow {
  id: string
  category_id: string
  name: string
  slug: string
  brand: string
  description: string
  condition: Product['condition']
  used_info: UsedInfo | null
  price: number
  min_price?: number | null
  cost_price?: number | null
  stock: number
  is_active: boolean
  images: string[]
  specs: ProductSpecs
  created_at: string
  updated_at: string
}

function fromRow(row: ProductRow): Product {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    description: row.description,
    condition: row.condition,
    usedInfo: row.used_info,
    price: row.price,
    minPrice: row.min_price ?? null,
    costPrice: row.cost_price ?? null,
    stock: row.stock,
    isActive: row.is_active,
    images: row.images ?? [],
    specs: row.specs ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

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
  if (!info) throw new ApiError('validation', msg().errorsMore.usedGrade)
  const clean: UsedInfo = { grade: info.grade }
  if (info.batteryHealth !== undefined) {
    if (!isInt(info.batteryHealth) || info.batteryHealth < 1 || info.batteryHealth > 100) {
      throw new ApiError('validation', msg().errorsMore.battery)
    }
    clean.batteryHealth = info.batteryHealth
  }
  if (info.warrantyMonths !== undefined) {
    if (!isInt(info.warrantyMonths) || info.warrantyMonths < 0) {
      throw new ApiError('validation', msg().errorsMore.warranty)
    }
    clean.warrantyMonths = info.warrantyMonths
  }
  if (info.defects?.trim()) clean.defects = info.defects.trim()
  if (info.kit?.trim()) clean.kit = info.kit.trim()
  return clean
}

type ProductFields = Omit<Product, 'id' | 'slug' | 'createdAt' | 'updatedAt'>

/** Проверяет товар целиком (после слияния с изменениями) и возвращает строку для базы. */
async function validate(product: ProductFields): Promise<Record<string, unknown>> {
  const name = product.name.trim()
  if (!name) throw new ApiError('validation', msg().errorsMore.productName)
  const category = product.categoryId ? await getCategory(product.categoryId) : null
  if (!category) throw new ApiError('validation', msg().errorsMore.category)
  if (!isInt(product.price) || product.price <= 0) {
    throw new ApiError('validation', msg().errorsMore.price)
  }
  if (product.minPrice !== null) {
    if (!isInt(product.minPrice) || product.minPrice <= 0 || product.minPrice > product.price) {
      throw new ApiError('validation', msg().errorsMore.minPrice)
    }
  }
  if (product.costPrice !== null && (!isInt(product.costPrice) || product.costPrice < 0)) {
    throw new ApiError('validation', msg().errorsMore.costPrice)
  }
  if (!isInt(product.stock) || product.stock < 0) {
    throw new ApiError('validation', msg().errorsMore.stock)
  }
  if (product.images.length > shop.maxProductImages) {
    throw new ApiError('validation', msg().errorsMore.imagesMax(shop.maxProductImages))
  }
  return {
    category_id: product.categoryId,
    name,
    brand: product.brand.trim(),
    description: product.description.trim(),
    condition: product.condition,
    used_info: product.condition === 'used' ? cleanUsedInfo(product.usedInfo) : null,
    price: product.price,
    min_price: product.minPrice,
    cost_price: product.costPrice,
    stock: product.stock,
    is_active: product.isActive,
    images: product.images,
    specs: cleanSpecs(product.specs, category),
  }
}

/**
 * Список товаров, новые сверху.
 * `onlyActive` — для клиентской части: только активные товары из активных категорий
 * (без закупочной и минимальной цены). Без него — для админки, все поля.
 */
export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const columns = filters.onlyActive ? PUBLIC_COLUMNS : ADMIN_COLUMNS
  const needsCategory = filters.onlyActive || Boolean(filters.categorySlug)
  let query = supabase
    .from('products')
    .select(needsCategory ? `${columns}, category:categories!inner(slug, is_active)` : columns)
    .order('created_at', { ascending: false })

  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.categorySlug) query = query.eq('category.slug', filters.categorySlug)
  if (filters.condition) query = query.eq('condition', filters.condition)
  if (filters.onlyActive) query = query.eq('is_active', true).eq('category.is_active', true)
  const search = filters.search?.trim().replace(/[%_,()]/g, ' ')
  if (search) query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%`)
  if (filters.limit) query = query.limit(filters.limit)

  const rows = unwrap(await query, msg().errorsMore.productsLoad) as unknown as ProductRow[]
  return rows.map(fromRow)
}

/** Для клиентской части: находит только активный товар из активной категории. */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const row = unwrap(
    await supabase
      .from('products')
      .select(`${PUBLIC_COLUMNS}, category:categories!inner(is_active)`)
      .eq('slug', slug)
      .eq('is_active', true)
      .eq('category.is_active', true)
      .maybeSingle(),
  ) as unknown as ProductRow | null
  return row ? fromRow(row) : null
}

/** Для админки: находит любой товар, в том числе скрытый. */
export async function getProduct(id: string): Promise<Product | null> {
  const row = unwrap(
    await supabase.from('products').select(ADMIN_COLUMNS).eq('id', id).maybeSingle(),
  ) as unknown as ProductRow | null
  return row ? fromRow(row) : null
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const fields = await validate({
    categoryId: input.categoryId,
    name: input.name,
    brand: input.brand,
    description: input.description,
    condition: input.condition ?? 'new',
    usedInfo: input.usedInfo ?? null,
    price: input.price,
    minPrice: input.minPrice ?? null,
    costPrice: input.costPrice ?? null,
    stock: input.stock,
    isActive: input.isActive,
    images: input.images,
    specs: input.specs,
  })
  const slug = await uniqueSlug('products', slugify(input.slug?.trim() || String(fields.name)))
  const row = unwrap(
    await supabase.from('products').insert({ ...fields, slug }).select(ADMIN_COLUMNS).single(),
    msg().errorsMore.productCreate,
  ) as unknown as ProductRow
  emit(['products'])
  return fromRow(row)
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
  const current = await getProduct(id)
  if (!current) throw new ApiError('not_found', msg().errorsMore.productNotFound)

  const { slug, ...fields } = patch
  // undefined в patch означает «не менять».
  const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined))
  const next: Product = { ...current, ...changes }
  const row: Record<string, unknown> = await validate(next)
  if (slug !== undefined) {
    row.slug = await uniqueSlug('products', slugify(slug.trim() || next.name), id)
  }

  const updated = unwrap(
    await supabase.from('products').update(row).eq('id', id).select(ADMIN_COLUMNS).maybeSingle(),
    msg().errorsMore.productSave,
  ) as unknown as ProductRow | null
  if (!updated) throw new ApiError('not_found', msg().errorsMore.productNotFound)
  emit(['products'])
  return fromRow(updated)
}

/** Удаляет товар. Заказы и заявки trade-in остаются: в них сохранены название и цена. */
export async function deleteProduct(id: string): Promise<void> {
  const rows = unwrap(await supabase.from('products').delete().eq('id', id).select('id')) as { id: string }[]
  if (rows.length === 0) throw new ApiError('not_found', msg().errorsMore.productNotFound)
  emit(['products', 'orders', 'tradeIns'])
}

/**
 * Меняет остаток на `delta` (+5 — приход, −1 — списание). Атомарно в базе (RPC adjust_stock).
 * Остаток не может стать меньше нуля → `ApiError('out_of_stock')`.
 */
export async function adjustStock(id: string, delta: number): Promise<Product> {
  if (!isInt(delta)) throw new ApiError('validation', msg().errorsMore.stockDelta)
  unwrap(await supabase.rpc('adjust_stock', { p_product_id: id, p_delta: delta }))
  const product = await getProduct(id)
  if (!product) throw new ApiError('not_found', msg().errorsMore.productNotFound)
  emit(['products'])
  return product
}
