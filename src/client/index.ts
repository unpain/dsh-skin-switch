import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { en, SKIN_SETTINGS_NS, type SkinSettingsKey, zh } from './locales.ts'
import { SkinManager } from './manager.ts'
import { SkinSettingsSection } from './settings/SkinSettingsSection.tsx'

declare module '@deepseek-ai/cordis' {
  interface Context {
    skinManager: SkinManager
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.skins': SkinSettingsKey
  }
}

/** Provides the registry before managed skin packages can leave DI pending. */
export function apply(ctx: Context): void {
  const manager = new SkinManager(localStorage)
  ctx.provide('skinManager', manager)
  ctx.effect(
    () => ctx.locale.register(SKIN_SETTINGS_NS, { zh, en }),
    'skin-manager: settings dictionaries',
  )
  const t = ctx.locale.bind(SKIN_SETTINGS_NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skins',
    order: 12,
    label: () => t('nav'),
    locale: SKIN_SETTINGS_NS,
    inject: () => ({ manager }),
  }, SkinSettingsSection))
}

export const inject: string[] = ['slots', 'locale']

export {
  DEFAULT_SKIN_ID,
  SKIN_STORAGE_KEY,
  SkinManager,
  type SkinActivator,
  type SkinDefinition,
  type SkinDisposer,
  type SkinMetadata,
  type SkinSelectionStorage,
  type SkinSnapshot,
  type SkinStatus,
} from './manager.ts'

