import type { Category, CategoryFilters, CategoryInput, SpecField } from '../types'
import { slugify } from '../utils/slugify'
import { requireAdmin } from './auth'
import { clone, createId, delay, mutate, readDb, uniqueSlug } from './db'
import { ApiError } from './errors'

/** Проверяет и чистит шаблон характеристик. Пустой ключ строится из подписи. */
function cleanSpecFields(fields: SpecField[]): SpecField[] {
  const keys = new Set<string>()
  return fields.map((field) => {
    const label = field.label.trim()
    if (!label) throw new ApiError('validation', 'У каждой характеристики должно быть название')

    const key = slugify(field.key.trim() || label, '_')
    if (!key) throw new ApiError('validation', `Не удалось построить ключ для характеристики «${label}»`)
    if (keys.has(key)) throw new ApiError('validation', `Характеристика «${label}» повторяется`)
    keys.add(key)

    const clean: SpecField = { key, label, type: field.type }
    const unit = field.unit?.trim()
    if (unit) clean.unit = unit
    if (field.type === 'select') {
      const options = [...new Set((field.options ?? []).map((o) => o.trim()).filter(Boolean))]
      if (options.length === 0) {
        throw new ApiError('validation', `Добавьте варианты выбора для характеристики «${label}»`)
      }
      clean.options = options
    }
    return clean
  })
}

function bySortOrder(a: Category, b: Category): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru')
}

/** Категории по порядку `sortOrder`. */
export async function listCategories(filters: CategoryFilters = {}): Promise<Category[]> {
  await delay()
  const { categories } = readDb()
  const result = filters.onlyActive ? categories.filter((c) => c.isActive) : categories
  return clone(result.sort(bySortOrder))
}

/** Для клиентской части: находит только активную категорию. */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  await delay()
  return clone(readDb().categories.find((c) => c.slug === slug && c.isActive) ?? null)
}

/** Находит любую категорию, в том числе скрытую. */
export async function getCategory(id: string): Promise<Category | null> {
  await delay()
  return clone(readDb().categories.find((c) => c.id === id) ?? null)
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  await delay()
  requireAdmin()
  const name = input.name.trim()
  if (!name) throw new ApiError('validation', 'Укажите название категории')
  const specFields = cleanSpecFields(input.specFields)

  return mutate(['categories'], (db) => {
    const maxOrder = Math.max(0, ...db.categories.map((c) => c.sortOrder))
    const category: Category = {
      id: createId(),
      name,
      slug: uniqueSlug(slugify(input.slug?.trim() || name), db.categories.map((c) => c.slug)),
      sortOrder: input.sortOrder ?? maxOrder + 1,
      isActive: input.isActive ?? true,
      specFields,
    }
    db.categories.push(category)
    return clone(category)
  })
}

export async function updateCategory(id: string, patch: Partial<CategoryInput>): Promise<Category> {
  await delay()
  requireAdmin()
  const name = patch.name?.trim()
  if (patch.name !== undefined && !name) throw new ApiError('validation', 'Укажите название категории')
  const specFields = patch.specFields ? cleanSpecFields(patch.specFields) : undefined

  return mutate(['categories'], (db) => {
    const category = db.categories.find((c) => c.id === id)
    if (!category) throw new ApiError('not_found', 'Категория не найдена')

    if (name) category.name = name
    if (patch.slug !== undefined) {
      const others = db.categories.filter((c) => c.id !== id).map((c) => c.slug)
      category.slug = uniqueSlug(slugify(patch.slug.trim() || category.name), others)
    }
    if (patch.sortOrder !== undefined) category.sortOrder = patch.sortOrder
    if (patch.isActive !== undefined) category.isActive = patch.isActive
    if (specFields) category.specFields = specFields
    return clone(category)
  })
}

/** Удаляет категорию. Если в ней есть товары — `ApiError('category_not_empty')`. */
export async function deleteCategory(id: string): Promise<void> {
  await delay()
  requireAdmin()
  mutate(['categories'], (db) => {
    const index = db.categories.findIndex((c) => c.id === id)
    if (index === -1) throw new ApiError('not_found', 'Категория не найдена')
    const count = db.products.filter((p) => p.categoryId === id).length
    if (count > 0) {
      throw new ApiError(
        'category_not_empty',
        `В категории есть товары (${count} шт.). Сначала перенесите или удалите их.`,
      )
    }
    db.categories.splice(index, 1)
  })
}
