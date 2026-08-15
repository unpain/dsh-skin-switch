import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  DshWebUiCollectionAdapter,
  activeDshWebUiSkinId,
} from './collections/dsh-web-ui.ts'
import { DshWebUiHttpGateway } from './collections/dsh-web-ui-gateway.ts'
import { en, SKIN_SETTINGS_NS, type SkinSettingsKey, zh } from './locales.ts'
import { DEFAULT_SKIN_ID, SKIN_STORAGE_KEY, SkinManager } from './manager.ts'
import { SkinSettingsSection } from './settings/SkinSettingsSection.tsx'
import './settings/SkinNavIcon.module.css'
import { installSkinNavIcon } from './settings/SkinNavIcon.ts'

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


type BootWindow = Window & {
  __DSH_BOOT__?: {
    entries?: Array<{ id: string }>
  }
}

function sleep(milliseconds: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  window.setTimeout(resolve, milliseconds)
  return promise
}

function activeCollectionSkin(): string | null {
  return activeDshWebUiSkinId((window as BootWindow).__DSH_BOOT__?.entries ?? [])
}

function createCollectionGateway(): DshWebUiHttpGateway {
  return new DshWebUiHttpGateway({
    fetcher: (url, options) => fetch(url, options),
    location: {
      href: window.location.href,
      reload: () => window.location.reload(),
    },
    sleep,
  })
}
/** Provides the registry before managed skin packages can leave DI pending. */
export function apply(ctx: Context): void {
  const externalActive = activeCollectionSkin()
  if (externalActive !== null) localStorage.setItem(SKIN_STORAGE_KEY, DEFAULT_SKIN_ID)
  const manager = new SkinManager(localStorage)
  const collection = new DshWebUiCollectionAdapter(
    manager,
    localStorage,
    createCollectionGateway(),
    externalActive,
  )
  void collection.initialize().catch(() => undefined)
  ctx.provide('skinManager', collection)
  ctx.effect(
    () => ctx.locale.register(SKIN_SETTINGS_NS, { zh, en }),
    'skin-manager: settings dictionaries',
  )
  const t = ctx.locale.bind(SKIN_SETTINGS_NS)
  ctx.effect(
    () => installSkinNavIcon([zh.nav, en.nav]),
    'skin-manager: settings navigation icon',
  )
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skins',
    order: 12,
    label: () => t('nav'),
    locale: SKIN_SETTINGS_NS,
    inject: () => ({ manager: collection }),
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

export {
  DshWebUiCollectionAdapter,
  activeDshWebUiSkinId,
  dshWebUiSelectionId,
  type DshWebUiCollectionGateway,
  type DshWebUiSkin,
} from './collections/dsh-web-ui.ts'

