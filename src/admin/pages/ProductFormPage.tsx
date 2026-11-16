import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getErrorMessage } from '../../api/errors'
import { listCategories } from '../../api/categories'
import { createProduct, getProduct, updateProduct, deleteProduct } from '../../api/products'
import { useApiQuery } from '../../hooks/useApiQuery'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { LinkButton } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Checkbox } from '../../components/ui/Checkbox'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../components/AdminBlocks'
import { ProductSpecsFields } from '../components/ProductSpecsFields'
import { ImagePicker } from '../../components/ui/ImagePicker'
import { CONDITION_LABELS, DEVICE_GRADE_LABELS, DEVICE_GRADES } from '../../config/labels'
import styles from './ProductFormPage.module.css'
import type { ProductInput, Product, ProductSpecs, UsedInfo, ProductCondition, Category, DeviceGrade } from '../../types'

export function ProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = !id

  const {
    data: categories = [],
    loading: categoriesLoading,
    error: categoriesError,
  } = useApiQuery(() => listCategories({ onlyActive: false }), [], ['categories'])

  const {
    data: product,
    loading: productLoading,
    error: productError,
  } = useApiQuery(
    () => getProduct(id!),
    [id!],
    ['products']
  )

  if (categoriesLoading || (!isNew && productLoading)) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--color-primary)' }}>
            hourglass_empty
          </span>
        </div>
      </div>
    )
  }

  if (categoriesError) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon="error"
          title="Ошибка загрузки категорий"
          text={getErrorMessage(categoriesError)}
          tone="error"
        />
      </div>
    )
  }

  if (!isNew && productError) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon="error"
          title="Ошибка загрузки товара"
          text={getErrorMessage(productError)}
          tone="error"
        />
      </div>
    )
  }

  if (!isNew && !product) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon="inventory_2"
          title="Товар не найден"
          text="Возможно, он был удалён."
          action={<LinkButton to="/admin/products">Назад к списку</LinkButton>}
          tone="error"
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <ProductForm
        key={product?.id ?? 'new'}
        isNew={isNew}
        categories={categories}
        initialProduct={product || null}
        onSaved={() => navigate('/admin/products')}
      />
    </div>
  )
}

interface ProductFormProps {
  isNew: boolean
  categories: Category[]
  initialProduct: Product | null
  onSaved: () => void
}

function ProductForm({ isNew, categories, initialProduct, onSaved }: ProductFormProps) {
  const [categoryId, setCategoryId] = useState<string>(initialProduct?.categoryId ?? '')
  const [name, setName] = useState(initialProduct?.name ?? '')
  const [brand, setBrand] = useState(initialProduct?.brand ?? '')
  const [description, _setDescription] = useState(initialProduct?.description ?? '')
  const [condition, setCondition] = useState<ProductCondition>(initialProduct?.condition ?? 'new')
  const [usedInfo, setUsedInfo] = useState<UsedInfo | null>(initialProduct?.usedInfo ?? null)
  const [price, setPrice] = useState<number | ''>(initialProduct?.price ?? '')
  const [minPrice, setMinPrice] = useState<number | '' | null>(initialProduct?.minPrice ?? null)
  const [stock, setStock] = useState<number | ''>(initialProduct?.stock ?? '')
  const [isActive, setIsActive] = useState(initialProduct?.isActive ?? true)
  const [images, setImages] = useState<string[]>(initialProduct?.images ?? [])
  const [specs, setSpecs] = useState<ProductSpecs>(initialProduct?.specs ?? {})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const selectedCategory = categories.find((c) => c.id === categoryId)

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCatId = e.target.value
    setCategoryId(newCatId)
    // При смене категории сбрасываем характеристики
    setSpecs({})
  }

  function validate(): string | null {
    if (!categoryId) return 'Выберите категорию'
    if (!name.trim()) return 'Укажите название товара'
    if (!brand.trim()) return 'Укажите бренд'
    const priceNum = typeof price === 'number' ? price : Number(price)
    if (!Number.isInteger(priceNum) || priceNum <= 0) return 'Цена — целое число больше нуля'
    if (minPrice !== null && minPrice !== '') {
      const minPriceNum = typeof minPrice === 'number' ? minPrice : Number(minPrice)
      if (!Number.isInteger(minPriceNum) || minPriceNum <= 0 || minPriceNum > priceNum) {
        return 'Минимальная цена должна быть больше нуля и не выше обычной цены'
      }
    }
    const stockNum = typeof stock === 'number' ? stock : Number(stock)
    if (!Number.isInteger(stockNum) || stockNum < 0) return 'Остаток — целое число, не меньше нуля'
    if (condition === 'used') {
      if (!usedInfo) return 'Для Б/У товара укажите состояние'
      if (!usedInfo.grade) return 'Выберите состояние Б/У товара'
      if (
        usedInfo.batteryHealth !== undefined &&
        (!Number.isInteger(usedInfo.batteryHealth) || usedInfo.batteryHealth < 1 || usedInfo.batteryHealth > 100)
      ) {
        return 'Ёмкость аккумулятора — целое число от 1 до 100'
      }
      if (
        usedInfo.warrantyMonths !== undefined &&
        (!Number.isInteger(usedInfo.warrantyMonths) || usedInfo.warrantyMonths < 0)
      ) {
        return 'Гарантия — целое число месяцев'
      }
    }
    return null
  }

  async function handleSave() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setSaving(true)

    try {
      const input: ProductInput = {
        categoryId,
        name: name.trim(),
        brand: brand.trim(),
        description: description.trim(),
        condition,
        usedInfo: condition === 'used' ? usedInfo : null,
        price: typeof price === 'number' ? price : Number(price),
        minPrice:
          minPrice !== null && minPrice !== '' ? (typeof minPrice === 'number' ? minPrice : Number(minPrice)) : null,
        stock: typeof stock === 'number' ? stock : Number(stock),
        isActive,
        images,
        specs,
      }

      if (isNew) {
        await createProduct(input)
      } else if (initialProduct) {
        await updateProduct(initialProduct.id, input)
      }
      onSaved()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialProduct) return
    setSaving(true)
    try {
      await deleteProduct(initialProduct.id)
      onSaved()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      <PageHeader
        backTo="/admin/products"
        title={isNew ? 'Новый товар' : 'Редактирование товара'}
        actions={
          !isNew && (
            <Button variant="danger" onClick={() => setDeleteConfirm(true)}>
              <span className="material-symbols-outlined">delete</span>
              Удалить
            </Button>
          )
        }
      />

      <section className={styles.section}>
        <div className={styles.fields}>
          <Select
            label="Категория"
            placeholder="Выберите категорию"
            options={categoryOptions}
            value={categoryId}
            onChange={handleCategoryChange}
            required
          />

          <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} required />

          <Input label="Бренд" value={brand} onChange={(e) => setBrand(e.target.value)} required />

          <Input
            label="Цена, ₽"
            type="number"
            inputMode="numeric"
            value={price}
            onChange={(e) => {
              const val = e.target.value
              setPrice(val === '' ? '' : Number(val))
            }}
            required
            min="1"
            step="1"
          />

          <Input
            label="Мин. цена для торга, ₽"
            type="number"
            inputMode="numeric"
            value={minPrice ?? ''}
            onChange={(e) => {
              const val = e.target.value
              setMinPrice(val === '' ? null : Number(val))
            }}
            min="1"
            step="1"
            hint="Видит только админ, для Telegram-бота"
          />

          <Input
            label="Остаток на складе"
            type="number"
            inputMode="numeric"
            value={stock}
            onChange={(e) => {
              const val = e.target.value
              setStock(val === '' ? '' : Number(val))
            }}
            required
            min="0"
            step="1"
          />

          <Checkbox
            label="Показывать на сайте"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />

          <Select
            label="Состояние"
            options={Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label }))}
            value={condition}
            onChange={(e) => {
              const next = e.target.value as ProductCondition
              setCondition(next)
              if (next === 'new') setUsedInfo(null)
            }}
          />
        </div>

        {condition === 'used' && (
          <div className={styles.usedInfo}>
            <h3 className={styles.usedInfoTitle}>Сведения о Б/У устройстве</h3>
            <div className={styles.fields}>
              <Select
                label="Состояние"
                placeholder="Выберите состояние"
                options={DEVICE_GRADES.map((g) => ({ value: g, label: DEVICE_GRADE_LABELS[g] }))}
                value={usedInfo?.grade ?? ''}
                onChange={(e) =>
                  setUsedInfo({
                    ...(usedInfo ?? { grade: 'excellent' }),
                    grade: e.target.value as DeviceGrade,
                  })
                }
                required
              />
              <Input
                label="Аккумулятор, %"
                type="number"
                inputMode="numeric"
                value={usedInfo?.batteryHealth ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  setUsedInfo({
                    ...(usedInfo ?? { grade: 'excellent' }),
                    batteryHealth: val === '' ? undefined : Number(val),
                  })
                }}
                min="1"
                max="100"
                step="1"
              />
              <Input
                label="Гарантия, мес."
                type="number"
                inputMode="numeric"
                value={usedInfo?.warrantyMonths ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  setUsedInfo({
                    ...(usedInfo ?? { grade: 'excellent' }),
                    warrantyMonths: val === '' ? undefined : Number(val),
                  })
                }}
                min="0"
                step="1"
              />
              <Input
                label="Дефекты"
                value={usedInfo?.defects ?? ''}
                onChange={(e) =>
                  setUsedInfo({
                    ...(usedInfo ?? { grade: 'excellent' }),
                    defects: e.target.value.trim() || undefined,
                  })
                }
              />
              <Input
                label="Комплект"
                value={usedInfo?.kit ?? ''}
                onChange={(e) =>
                  setUsedInfo({
                    ...(usedInfo ?? { grade: 'excellent' }),
                    kit: e.target.value.trim() || undefined,
                  })
                }
              />
            </div>
          </div>
        )}

        <div className={styles.specs}>
          <ProductSpecsFields
            fields={selectedCategory?.specFields ?? []}
            value={specs}
            onChange={setSpecs}
            disabled={!selectedCategory}
          />
        </div>

        <div className={styles.images}>
          <ImagePicker
            label="Фото товара"
            value={images}
            onChange={setImages}
            max={8}
            markFirst
            hint="Первое фото — главное. Макс. 8 фото."
          />
        </div>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <div className={styles.footer}>
          <LinkButton to="/admin/products" variant="secondary">
            Отмена
          </LinkButton>
          <Button type="submit" loading={saving} onClick={handleSave}>
            Сохранить
          </Button>
        </div>
      </section>

      <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Удалить товар" size="sm">
        <p>Товар будет удалён безвозвратно. В заказах и заявках trade-in останутся название и цена.</p>
        <div className={styles.footer} style={{ marginTop: 'var(--space-6)' }}>
          <Button variant="secondary" onClick={() => setDeleteConfirm(false)}>
            Отмена
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={saving}>
            Удалить
          </Button>
        </div>
      </Modal>
    </form>
  )
}
