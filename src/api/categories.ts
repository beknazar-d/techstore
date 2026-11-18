import type { Category, CategoryFilters, CategoryInput, SpecField } from '../types'
import { slugify } from '../utils/slugify'
import { emit, supabase, uniqueSlug, unwrap } from './client'
import { ApiError } from './errors'
import { msg } from '../i18n'

const COLUMNS = 'id, name, slug, sort_order, is_active, spec_fields'

interface CategoryRow {
  id: string
  name: string
  slug: string
  sort_order: number
  is_active: boolean
  spec_fields: SpecField[]
}

function fromRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    specFields: row.spec_fields ?? [],
  }
}

/** Проверяет и чистит шаблон характеристик. Пустой ключ строится из подписи. */
function cleanSpecFields(fields: SpecField[]): SpecField[] {
  const keys = new Set<string>()
  return fields.map((field) => {
    const label = field.label.trim()
    if (!label) throw new ApiError('validation', msg().errorsMore.specLabel)

    const key = slugify(field.key.trim() || label, '_')
    if (!key) throw new ApiError('validation', msg().errorsMore.specKey(label))
    if (keys.has(key)) throw new ApiError('validation', msg().errorsMore.specDuplicate(label))
    keys.add(key)

    const clean: SpecField = { key, label, type: field.type }
    const unit = field.unit?.trim()
    if (unit) clean.unit = unit
    if (field.type === 'select') {
      const options = [...new Set((field.options ?? []).map((o) => o.trim()).filter(Boolean))]
      if (options.length === 0) {
        throw new ApiError('validation', msg().errorsMore.specOptions(label))
      }
      clean.options = options
    }
    return clean
  })
}

/** Категории по порядку `sortOrder`. Аноним видит только активные (RLS). */
export async function listCategories(filters: CategoryFilters = {}): Promise<Category[]> {
  let query = supabase.from('categories').select(COLUMNS).order('sort_order').order('name')
  if (filters.onlyActive) query = query.eq('is_active', true)
  const rows = unwrap(await query, msg().errorsMore.categoriesLoad) as CategoryRow[]
  return rows.map(fromRow)
}

/** Для клиентской части: находит только активную категорию. */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const row = unwrap(
    await supabase.from('categories').select(COLUMNS).eq('slug', slug).eq('is_active', true).maybeSingle(),
  ) as CategoryRow | null
  return row ? fromRow(row) : null
}

/** Находит любую категорию, в том числе скрытую (скрытые видит только админ). */
export async function getCategory(id: string): Promise<Category | null> {
  const row = unwrap(await supabase.from('categories').select(COLUMNS).eq('id', id).maybeSingle()) as CategoryRow | null
  return row ? fromRow(row) : null
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const name = input.name.trim()
  if (!name) throw new ApiError('validation', msg().errorsMore.categoryName)
  const specFields = cleanSpecFields(input.specFields)

  let sortOrder = input.sortOrder
  if (sortOrder === undefined) {
    const last = unwrap(
      await supabase.from('categories').select('sort_order').order('sort_order', { ascending: false }).limit(1),
    ) as { sort_order: number }[]
    sortOrder = (last[0]?.sort_order ?? 0) + 1
  }

  const row = unwrap(
    await supabase
      .from('categories')
      .insert({
        name,
        slug: await uniqueSlug('categories', slugify(input.slug?.trim() || name)),
        sort_order: sortOrder,
        is_active: input.isActive ?? true,
        spec_fields: specFields,
      })
      .select(COLUMNS)
      .single(),
    msg().errorsMore.categoryCreate,
  ) as CategoryRow
  emit(['categories'])
  return fromRow(row)
}

export async function updateCategory(id: string, patch: Partial<CategoryInput>): Promise<Category> {
  const name = patch.name?.trim()
  if (patch.name !== undefined && !name) throw new ApiError('validation', msg().errorsMore.categoryName)

  const changes: Record<string, unknown> = {}
  if (name) changes.name = name
  if (patch.slug !== undefined) {
    let base = patch.slug.trim()
    if (!base) {
      const current = await getCategory(id)
      if (!current) throw new ApiError('not_found', msg().errorsMore.categoryNotFound)
      base = name ?? current.name
    }
    changes.slug = await uniqueSlug('categories', slugify(base), id)
  }
  if (patch.sortOrder !== undefined) changes.sort_order = patch.sortOrder
  if (patch.isActive !== undefined) changes.is_active = patch.isActive
  if (patch.specFields) changes.spec_fields = cleanSpecFields(patch.specFields)

  const row = unwrap(
    await supabase.from('categories').update(changes).eq('id', id).select(COLUMNS).maybeSingle(),
    msg().errorsMore.categorySave,
  ) as CategoryRow | null
  if (!row) throw new ApiError('not_found', msg().errorsMore.categoryNotFound)
  emit(['categories'])
  return fromRow(row)
}

/** Удаляет категорию. Если в ней есть товары — `ApiError('category_not_empty')`. */
export async function deleteCategory(id: string): Promise<void> {
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
  if (error) throw new ApiError('storage', msg().errorsMore.categoryCheck)
  if (count && count > 0) {
    throw new ApiError(
      'category_not_empty',
      msg().errorsMore.categoryNotEmpty(count ?? 0),
    )
  }
  const rows = unwrap(await supabase.from('categories').delete().eq('id', id).select('id')) as { id: string }[]
  if (rows.length === 0) throw new ApiError('not_found', msg().errorsMore.categoryNotFound)
  emit(['categories'])
}
