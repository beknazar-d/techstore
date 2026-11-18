import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createProduct, deleteProduct, getErrorMessage, getProduct, listCategories, updateProduct } from '../../api'
import { useApiQuery } from '../../hooks/useApiQuery'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { LinkButton } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Spinner } from '../../components/ui/Spinner'
import { Select } from '../../components/ui/Select'
import { Checkbox } from '../../components/ui/Checkbox'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../components/AdminBlocks'
import { ProductSpecsFields } from '../components/ProductSpecsFields'
import { ImagePicker } from '../../components/ui/ImagePicker'
import { CONDITION_LABELS, DEVICE_GRADE_LABELS, DEVICE_GRADES } from '../../config/labels'
import { formatPrice } from '../../utils/format'
import { shop } from '../../config/shop'
import { msg } from '../../i18n'
import styles from './ProductFormPage.module.css'
import type { ProductInput, Product, ProductSpecs, UsedInfo, ProductCondition, Category, DeviceGrade } from '../../types'

export function ProductFormPage() {
  const t = msg().adminProducts
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = !id

  const {
    data: categories,
    error: categoriesError,
  } = useApiQuery(() => listCategories({ onlyActive: false }), [], ['categories'])

  const {
    data: product,
    error: productError,
  } = useApiQuery(
    () => (id ? getProduct(id) : Promise.resolve(null)),
    [id],
    ['products']
  )

  // Спиннер только при первой загрузке: при фоновом обновлении форма не размонтируется.
  if (categories === undefined || product === undefined) {
    if (categoriesError || productError) {
      return (
        <div className={styles.page}>
          <EmptyState icon="error" title={t.loadError} text={categoriesError ?? productError ?? ''} tone="error" />
        </div>
      )
    }
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <Spinner />
        </div>
      </div>
    )
  }

  if (categoriesError) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon="error"
          title={t.categoriesLoadError}
          text={categoriesError}
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
          title={t.productLoadError}
          text={productError}
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
          title={t.notFound}
          text={t.notFoundText}
          action={<LinkButton to="/admin/products">{t.backToList}</LinkButton>}
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
  const t = msg().adminProducts
  const e = msg().errorsMore
  const [categoryId, setCategoryId] = useState<string>(initialProduct?.categoryId ?? '')
  const [name, setName] = useState(initialProduct?.name ?? '')
  const [brand, setBrand] = useState(initialProduct?.brand ?? '')
  const [description, setDescription] = useState(initialProduct?.description ?? '')
  const [condition, setCondition] = useState<ProductCondition>(initialProduct?.condition ?? 'new')
  const [usedInfo, setUsedInfo] = useState<UsedInfo | null>(initialProduct?.usedInfo ?? null)
  const [price, setPrice] = useState<number | ''>(initialProduct?.price ?? '')
  const [oldPrice, setOldPrice] = useState<number | '' | null>(initialProduct?.oldPrice ?? null)
  const [minPrice, setMinPrice] = useState<number | '' | null>(initialProduct?.minPrice ?? null)
  const [costPrice, setCostPrice] = useState<number | '' | null>(initialProduct?.costPrice ?? null)
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
    if (!categoryId) return e.category
    if (!name.trim()) return e.productName
    if (!brand.trim()) return t.errBrand
    const priceNum = typeof price === 'number' ? price : Number(price)
    if (!Number.isInteger(priceNum) || priceNum <= 0) return e.price
    if (oldPrice !== null && oldPrice !== '') {
      if (!Number.isInteger(oldPrice) || oldPrice <= priceNum) return e.oldPrice
    }
    if (minPrice !== null && minPrice !== '') {
      const minPriceNum = typeof minPrice === 'number' ? minPrice : Number(minPrice)
      if (!Number.isInteger(minPriceNum) || minPriceNum <= 0 || minPriceNum > priceNum) {
        return e.minPrice
      }
    }
    if (costPrice !== null && costPrice !== '') {
      const costPriceNum = typeof costPrice === 'number' ? costPrice : Number(costPrice)
      if (!Number.isInteger(costPriceNum) || costPriceNum < 0) {
        return e.costPrice
      }
    }
    const stockNum = typeof stock === 'number' ? stock : Number(stock)
    if (!Number.isInteger(stockNum) || stockNum < 0) return e.stock
    if (condition === 'used') {
      if (!usedInfo) return e.usedGrade
      if (!usedInfo.grade) return t.errUsedGrade
      if (
        usedInfo.batteryHealth !== undefined &&
        (!Number.isInteger(usedInfo.batteryHealth) || usedInfo.batteryHealth < 1 || usedInfo.batteryHealth > 100)
      ) {
        return e.battery
      }
      if (
        usedInfo.warrantyMonths !== undefined &&
        (!Number.isInteger(usedInfo.warrantyMonths) || usedInfo.warrantyMonths < 0)
      ) {
        return e.warranty
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
        usedInfo:
          condition === 'used' && usedInfo
            ? { ...usedInfo, defects: usedInfo.defects?.trim() || undefined, kit: usedInfo.kit?.trim() || undefined }
            : null,
        price: typeof price === 'number' ? price : Number(price),
        oldPrice: oldPrice !== null && oldPrice !== '' ? oldPrice : null,
        minPrice:
          minPrice !== null && minPrice !== '' ? (typeof minPrice === 'number' ? minPrice : Number(minPrice)) : null,
        costPrice:
          costPrice !== null && costPrice !== '' ? (typeof costPrice === 'number' ? costPrice : Number(costPrice)) : null,
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
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        void handleSave()
      }}
    >
      <PageHeader
        backTo="/admin/products"
        title={isNew ? t.newTitle : t.editTitle}
        actions={
          !isNew && (
            <Button variant="danger" icon="delete" onClick={() => setDeleteConfirm(true)}>
              {t.delete}
            </Button>
          )
        }
      />

      <section className={styles.section}>
        <div className={styles.fields}>
          <Select
            label={t.category}
            placeholder={t.chooseCategory}
            options={categoryOptions}
            value={categoryId}
            onChange={handleCategoryChange}
            required
          />

          <Input label={t.name} value={name} onChange={(e) => setName(e.target.value)} required />

          <Input label={t.brand} value={brand} onChange={(e) => setBrand(e.target.value)} required />

          <Textarea
            label={t.description}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />

          <Input
            label={t.price}
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
            label={t.oldPrice}
            type="number"
            inputMode="numeric"
            value={oldPrice ?? ''}
            onChange={(e) => {
              const val = e.target.value
              setOldPrice(val === '' ? null : Number(val))
            }}
            min="1"
            step="1"
            hint={t.oldPriceHint}
          />

          {price !== '' && oldPrice !== null && oldPrice !== '' && (
            <div className={styles.marginInfo}>
              {oldPrice <= price ? (
                <span className={styles.marginError}>{t.oldPriceLow}</span>
              ) : (
                <span className={styles.discountInfo}>
                  {t.discountInfo(Math.round(((oldPrice - price) / oldPrice) * 100), formatPrice(oldPrice - price))}
                </span>
              )}
            </div>
          )}

          <Input
            label={t.minPrice}
            type="number"
            inputMode="numeric"
            value={minPrice ?? ''}
            onChange={(e) => {
              const val = e.target.value
              setMinPrice(val === '' ? null : Number(val))
            }}
            min="1"
            step="1"
            hint={t.minPriceHint}
          />

          <Input
            label={t.costPrice}
            type="number"
            inputMode="numeric"
            value={costPrice ?? ''}
            onChange={(e) => {
              const val = e.target.value
              setCostPrice(val === '' ? null : Number(val))
            }}
            min="0"
            step="1"
            hint={t.costPriceHint}
          />

          {price !== '' && costPrice !== null && costPrice !== '' && (
            <div className={styles.marginInfo}>
              {costPrice > price ? (
                <span className={styles.marginError}>
                  {t.costAbovePrice}
                </span>
              ) : (
                <span>
                  {t.margin(formatPrice(price - costPrice), Math.round((price - costPrice) / price * 100))}
                </span>
              )}
            </div>
          )}

          <Input
            label={t.stock}
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
            label={t.showOnSite}
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />

          <Select
            label={t.condition}
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
            <h3 className={styles.usedInfoTitle}>{t.usedTitle}</h3>
            <div className={styles.fields}>
              <Select
                label={t.condition}
                placeholder={t.chooseGrade}
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
                label={t.battery}
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
                label={t.warranty}
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
                label={t.defects}
                value={usedInfo?.defects ?? ''}
                onChange={(e) =>
                  setUsedInfo({
                    ...(usedInfo ?? { grade: 'excellent' }),
                    defects: e.target.value,
                  })
                }
              />
              <Input
                label={t.kit}
                value={usedInfo?.kit ?? ''}
                onChange={(e) =>
                  setUsedInfo({
                    ...(usedInfo ?? { grade: 'excellent' }),
                    kit: e.target.value,
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
            label={t.photos}
            value={images}
            onChange={setImages}
            max={shop.maxProductImages}
            markFirst
            hint={t.photosHint(shop.maxProductImages)}
          />
        </div>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <div className={styles.footer}>
          <LinkButton to="/admin/products" variant="secondary">
            {t.cancel}
          </LinkButton>
          <Button type="submit" loading={saving}>
            {t.save}
          </Button>
        </div>
      </section>

      <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title={t.deleteTitle} size="sm">
        <p>{t.deleteText}</p>
        <div className={`${styles.footer} ${styles.modalFooter}`}>
          <Button variant="secondary" onClick={() => setDeleteConfirm(false)}>
            {t.cancel}
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} loading={saving}>
            {t.delete}
          </Button>
        </div>
      </Modal>
    </form>
  )
}
