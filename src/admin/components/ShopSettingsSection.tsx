import { useState } from 'react'
import { getErrorMessage, getShopInfo, updateShopInfo } from '../../api'
import type { ShopInfo } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import { msg } from '../../i18n'
import { Section } from './AdminBlocks'
import styles from './ShopSettingsSection.module.css'

const MAX_PHONES = 3

/** Пустой список телефонов — показываем одно пустое поле. */
function toForm(info: ShopInfo): ShopInfo {
  return { ...info, phones: info.phones.length ? info.phones : [''] }
}

/** «Магазин и контакты»: название, адрес, часы, телефоны и мессенджеры — то, что видит покупатель. */
export function ShopSettingsSection() {
  const t = msg().adminSettings
  const { data, error: loadError } = useApiQuery(getShopInfo, [], ['shopSettings'])
  // null — админ ещё ничего не менял: показываем данные из базы.
  const [draft, setDraft] = useState<ShopInfo | null>(null)
  const form = draft ?? (data ? toForm(data) : null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loadError && !form) {
    return (
      <Section title={t.shopTitle}>
        <p className={styles.error} role="alert">
          {getErrorMessage(loadError)}
        </p>
      </Section>
    )
  }

  if (!form) {
    return (
      <Section title={t.shopTitle}>
        <div className={styles.loader}>
          <Spinner />
        </div>
      </Section>
    )
  }

  function set<K extends keyof ShopInfo>(key: K, value: ShopInfo[K]) {
    if (form) setDraft({ ...form, [key]: value })
    setSaved(false)
  }

  function setPhone(index: number, value: string) {
    if (!form) return
    set(
      'phones',
      form.phones.map((phone, i) => (i === index ? value : phone)),
    )
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    setError(null)
    try {
      const next = await updateShopInfo(form)
      setDraft(toForm(next))
      setSaved(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title={t.shopTitle}>
      <form className={styles.form} onSubmit={(e) => void handleSave(e)}>
        <p className={styles.hint}>{t.shopHint}</p>

        <Input label={t.shopName} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} required />

        <div className={styles.pair}>
          <Input label={t.shopCity} value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={80} />
          <Input
            label={t.shopCityKy}
            lang="ky"
            value={form.cityKy}
            onChange={(e) => set('cityKy', e.target.value)}
            maxLength={80}
          />
        </div>
        <div className={styles.pair}>
          <Input label={t.shopAddress} value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={300} />
          <Input
            label={t.shopAddressKy}
            lang="ky"
            value={form.addressKy}
            onChange={(e) => set('addressKy', e.target.value)}
            maxLength={300}
          />
        </div>
        <div className={styles.pair}>
          <Input
            label={t.shopHours}
            placeholder={t.shopHoursPlaceholder}
            value={form.workingHours}
            onChange={(e) => set('workingHours', e.target.value)}
            maxLength={120}
          />
          <Input
            label={t.shopHoursKy}
            lang="ky"
            value={form.workingHoursKy}
            onChange={(e) => set('workingHoursKy', e.target.value)}
            maxLength={120}
          />
        </div>
        <p className={styles.hint}>{t.shopKyHint}</p>

        <fieldset className={styles.group}>
          <legend>{t.shopPhones}</legend>
          <p className={styles.hint}>{t.shopPhonesHint}</p>
          {form.phones.map((phone, index) => (
            <div key={index} className={styles.phoneRow}>
              <Input
                label={index === 0 ? t.shopPhoneMain : t.shopPhoneExtra}
                type="tel"
                inputMode="tel"
                placeholder="+7 999 123-45-67"
                value={phone}
                onChange={(e) => setPhone(index, e.target.value)}
              />
              {form.phones.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  icon="close"
                  aria-label={t.shopPhoneRemove}
                  className={styles.removeButton}
                  onClick={() =>
                    set(
                      'phones',
                      form.phones.filter((_, i) => i !== index),
                    )
                  }
                />
              )}
            </div>
          ))}
          {form.phones.length < MAX_PHONES && (
            <Button type="button" variant="secondary" icon="add" onClick={() => set('phones', [...form.phones, ''])}>
              {t.shopPhoneAdd}
            </Button>
          )}
        </fieldset>

        <div className={styles.pair}>
          <Input
            label="WhatsApp"
            hint={t.shopWhatsappHint}
            type="tel"
            inputMode="tel"
            value={form.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
          />
          <Input
            label="Telegram"
            hint={t.shopTelegramHint}
            placeholder="@username"
            value={form.telegram}
            onChange={(e) => set('telegram', e.target.value)}
          />
        </div>
        <div className={styles.pair}>
          <Input
            label="Instagram"
            placeholder="@username"
            value={form.instagram}
            onChange={(e) => set('instagram', e.target.value)}
          />
          <Input
            label={t.shopEmail}
            type="email"
            inputMode="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>
        <Input
          label={t.shopMap}
          hint={t.shopMapHint}
          inputMode="url"
          placeholder="https://2gis.ru/…"
          value={form.mapUrl}
          onChange={(e) => set('mapUrl', e.target.value)}
        />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Button type="submit" loading={saving}>
            {t.saveSettings}
          </Button>
          {saved && <span className={styles.success}>{t.saved}</span>}
        </div>
      </form>
    </Section>
  )
}
