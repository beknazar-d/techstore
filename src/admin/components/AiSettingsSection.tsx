import { useState } from 'react'
import {
  AI_KEY_PLACEHOLDERS,
  AI_PROVIDER_NAMES,
  AI_PROVIDERS,
  AI_SECRET_PROVIDERS,
  connectAiKey,
  disconnectAiKey,
  ELEVENLABS_MODELS,
  getAiSettings,
  getErrorMessage,
  listElevenLabsVoices,
  OPENAI_VOICES,
  updateAiSettings,
} from '../../api'
import type { AiProvider, AiSecretProvider, AiSettings, ElevenLabsVoice, VoiceProvider } from '../../types'
import { useApiQuery } from '../../hooks/useApiQuery'
import { msg } from '../../i18n'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Textarea } from '../../components/ui/Textarea'
import { Section } from './AdminBlocks'
import styles from './AiSettingsSection.module.css'

/** Загружает настройки ИИ и показывает спиннер, пока их нет. */
function useAiSettings() {
  return useApiQuery(() => getAiSettings(), [], ['aiSettings']).data
}

/** Меняется только при подключении/отключении ключей. */
function keysKey(data: AiSettings): string {
  return JSON.stringify(data.keyHints)
}

function Loader() {
  return (
    <div className={styles.loader}>
      <Spinner />
    </div>
  )
}

/** Ключи ИИ-сервисов — общие для ассистента в админке и Telegram-бота. */
export function AiKeysSection() {
  const t = msg().adminSettings
  const data = useAiSettings()
  return (
    <Section title={t.aiKeysTitle}>
      {data === undefined ? (
        <Loader />
      ) : (
        <div className={styles.body}>
          <p className={styles.intro}>{t.aiIntro}</p>
          <ul className={styles.keyList}>
            {AI_SECRET_PROVIDERS.map((provider) => (
              <KeyRow key={provider} provider={provider} hint={data.keyHints[provider]} />
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}

/** Модель и указания ИИ-ассистента в админке (кружок в углу). */
export function AssistantSection() {
  const t = msg().adminSettings
  const data = useAiSettings()
  return (
    <Section title={t.assistantProvider}>
      {/* key: подключили/отключили ключ — форма берёт свежие значения; после «Сохранить» остаётся (видно «Сохранено»). */}
      {data === undefined ? <Loader /> : <RoleModelForm key={`assistant-${keysKey(data)}`} role="assistant" initial={data} />}
    </Section>
  )
}

/** Какая модель отвечает клиентам в Telegram и каким голосом. */
export function BotAiSection() {
  const t = msg().adminSettings
  const data = useAiSettings()
  return (
    <>
      <Section title={t.botProvider}>
        {data === undefined ? <Loader /> : <RoleModelForm key={`bot-${keysKey(data)}`} role="bot" initial={data} />}
      </Section>
      <Section title={t.voice}>
        {data === undefined ? <Loader /> : <VoiceForm key={`voice-${keysKey(data)}`} initial={data} />}
      </Section>
    </>
  )
}

function KeyRow({ provider, hint }: { provider: AiSecretProvider; hint?: string }) {
  const t = msg().adminSettings
  const name = AI_PROVIDER_NAMES[provider]
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)

  async function handleConnect() {
    setLoading(true)
    setError('')
    try {
      await connectAiKey(provider, key)
      setKey('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setConfirm(false)
    setLoading(true)
    setError('')
    try {
      await disconnectAiKey(provider)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <li className={styles.keyRow}>
      <div className={styles.keyHeader}>
        <span className={styles.keyName}>{name}</span>
        {hint ? (
          <Badge tone="success" dot>
            {t.connected} · ••••{hint}
          </Badge>
        ) : (
          <Badge tone="neutral">{t.keyNotConnected}</Badge>
        )}
      </div>
      <p className={styles.keyWhere}>{t.keyWhere[provider]}</p>

      {hint ? (
        <div className={styles.keyActions}>
          <Button variant="secondary" size="sm" loading={loading} onClick={() => setConfirm(true)}>
            {t.disconnect}
          </Button>
        </div>
      ) : (
        <div className={styles.keyForm}>
          <Input
            label={t.keyLabel(name)}
            type="password"
            autoComplete="off"
            placeholder={AI_KEY_PLACEHOLDERS[provider]}
            hint={t.keySecret}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <div className={styles.keyActions}>
            <Button icon="key" size="sm" loading={loading} disabled={!key.trim()} onClick={handleConnect}>
              {t.connectKey}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t.disconnectKeyTitle(name)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={handleDisconnect}>
              {t.disconnect}
            </Button>
          </>
        }
      >
        <p className={styles.modalText}>{t.disconnectKeyText}</p>
      </Modal>
    </li>
  )
}

/** Модели провайдера для списка: первая — рекомендуемая; текущая остаётся, даже если пропала. */
function modelOptions(settings: AiSettings, provider: AiProvider, current: string) {
  const t = msg().adminSettings
  const list = settings.models[provider] ?? []
  const ids = current && !list.includes(current) ? [current, ...list] : list
  return ids.map((id) => ({ value: id, label: id === list[0] ? `${id} — ${t.recommended}` : id }))
}

function RoleModelForm({ initial, role }: { initial: AiSettings; role: 'assistant' | 'bot' }) {
  const t = msg().adminSettings
  const connected = AI_PROVIDERS.filter((p) => initial.keyHints[p])
  const isBot = role === 'bot'
  const [provider, setProvider] = useState(isBot ? initial.botProvider : initial.assistantProvider)
  const [model, setModel] = useState(isBot ? initial.botModel : initial.assistantModel)
  const [instructions, setInstructions] = useState(initial.assistantInstructions)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  if (connected.length === 0) {
    return <p className={styles.note}>{t.noModelsYet}</p>
  }

  const providerOptions = connected.map((p) => ({ value: p, label: AI_PROVIDER_NAMES[p] }))
  // Если выбранный раньше провайдер отключён, в списке его нет — показываем как есть, админ сменит.
  if (!connected.includes(provider)) {
    providerOptions.push({ value: provider, label: `${AI_PROVIDER_NAMES[provider]} — ${t.keyNotConnected}` })
  }
  const firstModel = (p: AiProvider) => initial.models[p]?.[0] ?? ''

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await updateAiSettings(
        isBot
          ? { botProvider: provider, botModel: model }
          : { assistantProvider: provider, assistantModel: model, assistantInstructions: instructions },
      )
      setSaved(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.group}>
      <p className={styles.roleHint}>{isBot ? t.botHint : t.assistantHint}</p>
      <div className={styles.pair}>
        <Select
          label={t.provider}
          options={providerOptions}
          value={provider}
          onChange={(e) => {
            const p = e.target.value as AiProvider
            setProvider(p)
            setModel(firstModel(p))
            setSaved(false)
          }}
        />
        <Select
          label={t.model}
          options={modelOptions(initial, provider, model)}
          value={model}
          onChange={(e) => {
            setModel(e.target.value)
            setSaved(false)
          }}
        />
      </div>
      {!isBot && (
        <Textarea
          label={t.assistantInstructions}
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          hint={t.assistantInstructionsHint}
        />
      )}

      <div className={styles.footer}>
        <Button onClick={handleSave} loading={saving}>
          {t.save}
        </Button>
        {saved && <p className={styles.savedText}>{t.saved}</p>}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

function VoiceForm({ initial }: { initial: AiSettings }) {
  const t = msg().adminSettings
  const [voiceReplies, setVoiceReplies] = useState(initial.voiceReplies)
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>(initial.voiceProvider)
  const [voiceId, setVoiceId] = useState(initial.elevenlabsVoiceId)
  const [elevenModel, setElevenModel] = useState(initial.elevenlabsModel)
  const [openaiVoice, setOpenaiVoice] = useState(initial.openaiVoice)
  const [voices, setVoices] = useState<ElevenLabsVoice[] | null>(null)
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const hasKey = Boolean(initial.keyHints[voiceProvider])
  const elevenModelLabels: Record<string, string> = {
    eleven_v4: t.voiceModelV4,
    eleven_v4_turbo: t.voiceModelV4Turbo,
    eleven_v3: t.voiceModelV3,
    eleven_multilingual_v2: t.voiceModelMultilingual,
    eleven_flash_v2_5: t.voiceModelFlash,
  }

  async function handleLoadVoices() {
    setVoicesLoading(true)
    setError('')
    try {
      setVoices(await listElevenLabsVoices())
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setVoicesLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await updateAiSettings({
        voiceReplies,
        voiceProvider,
        elevenlabsVoiceId: voiceId,
        elevenlabsModel: elevenModel,
        openaiVoice,
      })
      setSaved(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.group}>
      <div className={styles.group}>
        <Checkbox
          label={t.voiceReplies}
          checked={voiceReplies}
          onChange={(e) => setVoiceReplies(e.target.checked)}
        />
        <p className={styles.checkboxHint}>{t.voiceRepliesHint}</p>
      </div>

      <Select
        label={t.voiceProvider}
        options={[
          { value: 'elevenlabs', label: t.voiceElevenlabs },
          { value: 'openai', label: t.voiceOpenai },
        ]}
        value={voiceProvider}
        onChange={(e) => setVoiceProvider(e.target.value as VoiceProvider)}
        hint={t.voiceKyHint}
      />
      {!hasKey && <p className={styles.note}>{t.voiceNeedsKey(AI_PROVIDER_NAMES[voiceProvider])}</p>}

      {voiceProvider === 'elevenlabs' ? (
        <>
          <Input
            label={t.voiceId}
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value.trim())}
            placeholder="21m00Tcm4TlvDq8ikWAM"
            hint={t.voiceIdHint}
          />
          {initial.keyHints.elevenlabs && (
            <div className={styles.voicePicker}>
              {voices ? (
                <Select
                  label={t.pickVoice}
                  placeholder={t.pickVoice}
                  options={voices.map((v) => ({ value: v.id, label: `${v.name} · ${v.id}` }))}
                  value={voices.some((v) => v.id === voiceId) ? voiceId : ''}
                  onChange={(e) => setVoiceId(e.target.value)}
                />
              ) : (
                <Button variant="secondary" size="sm" icon="record_voice_over" loading={voicesLoading} onClick={handleLoadVoices}>
                  {t.loadVoices}
                </Button>
              )}
            </div>
          )}
          <Select
            label={t.voiceModel}
            options={ELEVENLABS_MODELS.map((id) => ({ value: id, label: elevenModelLabels[id] ?? id }))}
            value={elevenModel}
            onChange={(e) => setElevenModel(e.target.value)}
          />
        </>
      ) : (
        <Select
          label={t.openaiVoice}
          options={OPENAI_VOICES.map((id) => ({ value: id, label: id }))}
          value={openaiVoice}
          onChange={(e) => setOpenaiVoice(e.target.value)}
        />
      )}

      <div className={styles.footer}>
        <Button onClick={handleSave} loading={saving}>
          {t.save}
        </Button>
        {saved && <p className={styles.savedText}>{t.saved}</p>}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
