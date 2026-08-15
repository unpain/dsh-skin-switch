import {
  DEFAULT_SKIN_ID,
  SKIN_STORAGE_KEY,
  type SkinManager,
  type SkinDefinition,
  type SkinMetadata,
  type SkinSelectionStorage,
  type SkinSnapshot,
  type SkinStatus,
} from '../manager.ts'

export interface DshWebUiSkin {
  id: string
  name: string
  nameEn?: string
  description: string
  author?: string
  accent?: string
  order?: number
}

export interface DshWebUiCollectionGateway {
  list(): Promise<readonly DshWebUiSkin[]>
  apply(id: string | null): Promise<void>
  reload(): void
}

export class DshWebUiSwitchCommittedError extends Error {
  readonly committed = true

  constructor(readonly target: string | null, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`skin switch to "${target ?? 'official'}" was accepted but not observed: ${detail}`, { cause })
    this.name = 'DshWebUiSwitchCommittedError'
  }
}

const SELECTION_PREFIX = 'dsh-web-ui:'
const PACKAGE_PREFIX = '@linxin666/dsh-client-ui-skin-'
const SKIN_CENTER_PACKAGE = `${PACKAGE_PREFIX}center`

export function dshWebUiSelectionId(id: string): string {
  return `${SELECTION_PREFIX}${id}`
}

function collectionSkinId(selectionId: string): string | null {
  return selectionId.startsWith(SELECTION_PREFIX)
    ? selectionId.slice(SELECTION_PREFIX.length)
    : null
}

export function activeDshWebUiSkinId(entries: readonly { id: string }[]): string | null {
  const active = entries.find(entry => (
    entry.id.startsWith(PACKAGE_PREFIX) && entry.id !== SKIN_CENTER_PACKAGE
  ))
  return active?.id.slice(PACKAGE_PREFIX.length) ?? null
}

function toSkinMetadata(skin: DshWebUiSkin): SkinMetadata {
  return {
    id: dshWebUiSelectionId(skin.id),
    name: skin.name,
    description: skin.description,
    author: skin.author,
    order: skin.order,
  }
}

/** Coordinates page-local skins with boot-graph skins without ever mounting both. */
export class DshWebUiCollectionAdapter {
  private readonly listeners = new Set<() => void>()
  private externalSkins: readonly SkinMetadata[] = []
  private activeId: string | null
  private status: SkinStatus | undefined
  private error: string | undefined
  private revision = 0
  private snapshot: SkinSnapshot
  private pending: Promise<void> = Promise.resolve()

  constructor(
    private readonly manager: SkinManager,
    private readonly storage: SkinSelectionStorage,
    private readonly gateway: DshWebUiCollectionGateway,
    activeId: string | null,
  ) {
    this.activeId = activeId
    this.snapshot = this.composeSnapshot()
    manager.subscribe(() => this.publish())
  }

  async initialize(): Promise<void> {
    try {
      this.externalSkins = (await this.gateway.list()).map(toSkinMetadata)
      this.status = undefined
      this.error = undefined
      this.publish()
    } catch (cause) {
      this.fail(cause)
      throw cause
    }
  }

  getSnapshot = (): SkinSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  register(definition: SkinDefinition): () => Promise<void> {
    return this.manager.register(definition)
  }

  whenIdle(): Promise<void> {
    return this.pending.then(() => this.manager.whenIdle())
  }

  select(id: string): Promise<void> {
    const request = this.pending.then(() => this.transition(id))
    this.pending = request.catch(() => undefined)
    return request
  }

  private async transition(id: string): Promise<void> {
    const externalId = collectionSkinId(id)
    if (externalId !== null) return this.selectExternal(externalId)
    if (this.activeId !== null) return this.selectLocalAfterUnload(id)
    return this.manager.select(id)
  }

  private async selectExternal(id: string): Promise<void> {
    if (this.activeId === id) return
    if (this.activeId === null) await this.manager.whenIdle()
    const previousLocalId = this.manager.getSnapshot().selectedId
    this.beginSwitch()
    try {
      if (this.activeId === null) await this.manager.select(DEFAULT_SKIN_ID)
      await this.gateway.apply(id)
      this.activeId = id
      this.finishSwitch()
      this.gateway.reload()
    } catch (cause) {
      if (cause instanceof DshWebUiSwitchCommittedError) {
        this.activeId = id
        this.fail(cause)
        this.gateway.reload()
        throw cause
      }
      if (this.activeId === null && previousLocalId !== DEFAULT_SKIN_ID) {
        await this.manager.select(previousLocalId)
      }
      this.fail(cause)
      throw cause
    }
  }

  private async selectLocalAfterUnload(id: string): Promise<void> {
    const target = this.localTarget(id)
    const previous = this.storage.getItem(SKIN_STORAGE_KEY) ?? DEFAULT_SKIN_ID
    this.storage.setItem(SKIN_STORAGE_KEY, target)
    this.beginSwitch()
    try {
      await this.gateway.apply(null)
      this.activeId = null
      this.finishSwitch()
      this.gateway.reload()
    } catch (cause) {
      if (cause instanceof DshWebUiSwitchCommittedError) {
        this.activeId = null
        this.fail(cause)
        this.gateway.reload()
        throw cause
      }
      this.storage.setItem(SKIN_STORAGE_KEY, previous)
      this.fail(cause)
      throw cause
    }
  }

  private localTarget(id: string): string {
    return this.manager.getSnapshot().skins.some(skin => skin.id === id)
      ? id
      : DEFAULT_SKIN_ID
  }

  private beginSwitch(): void {
    this.status = 'switching'
    this.error = undefined
    this.publish()
  }

  private finishSwitch(): void {
    this.status = undefined
    this.error = undefined
    this.publish()
  }

  private fail(cause: unknown): void {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    this.status = 'error'
    this.error = error.message
    this.publish()
  }

  private composeSnapshot(): SkinSnapshot {
    const local = this.manager.getSnapshot()
    return {
      ...local,
      selectedId: this.activeId === null
        ? local.selectedId
        : dshWebUiSelectionId(this.activeId),
      status: this.status ?? local.status,
      error: this.error ?? local.error,
      revision: local.revision + this.revision,
      skins: [...local.skins, ...this.externalSkins],
    }
  }

  private publish(): void {
    this.revision += 1
    this.snapshot = this.composeSnapshot()
    for (const listener of this.listeners) listener()
  }
}
