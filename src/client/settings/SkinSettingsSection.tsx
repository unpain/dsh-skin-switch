import { useSyncExternalStore } from 'react'
import { DEFAULT_SKIN_ID, type SkinManager, type SkinMetadata } from '../manager.ts'
import type { SkinSettingsKey } from '../locales.ts'
import styles from './SkinSettingsSection.module.css'

export type SkinManagerView = Pick<SkinManager, 'getSnapshot' | 'select' | 'subscribe'>

type Translate = (key: SkinSettingsKey, params?: Record<string, unknown>) => string

type SectionProps = {
  manager: SkinManagerView
  t: Translate
}

type CardProps = {
  disabled: boolean
  selected: boolean
  skin: SkinMetadata
  t: Translate
  onSelect: () => void
}

/** Keeps the selected marker semantic without depending on an icon package. */
function SelectedIcon(): React.JSX.Element {
  return (
    <svg className={styles.selectedIcon} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="currentColor" />
      <path d="m6.4 10.1 2.1 2.1 5-5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Uses package-provided art when available and a neutral DSH frame otherwise. */
function SkinPreview({ skin }: { skin: SkinMetadata }): React.JSX.Element {
  if (skin.preview !== undefined) {
    return <img className={styles.previewImage} src={skin.preview} alt="" />
  }
  return (
    <div className={styles.defaultPreview} aria-hidden="true">
      <span /><span /><span />
    </div>
  )
}

function SkinCardBody({ selected, skin, t }: Pick<CardProps, 'selected' | 'skin' | 't'>): React.JSX.Element {
  const isDefault = skin.id === DEFAULT_SKIN_ID
  const name = isDefault ? t('defaultName') : skin.name
  const description = isDefault ? t('defaultDescription') : skin.description
  return (
    <div className={styles.cardBody}>
      <div className={styles.cardHeading}>
        <span className={styles.cardName}>{name}</span>
        {selected && <SelectedIcon />}
      </div>
      <span className={styles.cardDescription}>{description}</span>
      {skin.author !== undefined && <span className={styles.author}>{t('author', { name: skin.author })}</span>}
      {selected && <span className={styles.status}>{t('selected')}</span>}
    </div>
  )
}

/** A button owns the whole card so mouse, keyboard, and pressed state stay aligned. */
function SkinCard({ disabled, onSelect, selected, skin, t }: CardProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={styles.card}
      data-selected={selected}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <div className={styles.preview}><SkinPreview skin={skin} /></div>
      <SkinCardBody selected={selected} skin={skin} t={t} />
    </button>
  )
}

/** Renders the registry snapshot; all writes stay on the manager's serialized path. */
export function SkinSettingsSection({ manager, t }: SectionProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot)
  const switching = snapshot.status === 'switching'
  const select = (id: string): void => {
    void manager.select(id).catch(() => undefined)
  }
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t('title')}</h2>
        <p className={styles.description}>{t('description')}</p>
      </header>
      <div className={styles.grid}>
        {snapshot.skins.map(skin => <SkinCard key={skin.id} skin={skin} t={t} selected={snapshot.selectedId === skin.id} disabled={switching} onSelect={() => select(skin.id)} />)}
      </div>
      {switching && <p className={styles.status}>{t('switching')}</p>}
      {snapshot.error !== undefined && <p className={styles.error} role="alert">{t('error', { message: snapshot.error })}</p>}
    </section>
  )
}
