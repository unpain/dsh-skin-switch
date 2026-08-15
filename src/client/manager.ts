export const DEFAULT_SKIN_ID = 'default'
export const SKIN_STORAGE_KEY = 'dsh-skin-manager:selected'

export type SkinDisposer = () => void | Promise<void>
export type SkinActivator = () => SkinDisposer | Promise<SkinDisposer>
export type SkinStatus = 'idle' | 'switching' | 'error'

export interface SkinMetadata {
  id: string
  name: string
  description: string
  author?: string
  preview?: string
  order?: number
}

export interface SkinDefinition extends SkinMetadata {
  activate: SkinActivator
}

export interface SkinSelectionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface SkinSnapshot {
  selectedId: string
  status: SkinStatus
  error?: string
  revision: number
  skins: readonly SkinMetadata[]
}

type ActiveSkin = {
  definition: SkinDefinition
  dispose: SkinDisposer
}

const DEFAULT_SKIN: SkinMetadata = {
  id: DEFAULT_SKIN_ID,
  name: 'DSH 默认',
  description: '恢复 DeepSeek Harness 原生界面。',
  order: -1,
}

/** Owns one full-skin activation at a time and publishes immutable UI snapshots. */
export class SkinManager {
  private readonly definitions = new Map<string, SkinDefinition>()
  private readonly listeners = new Set<() => void>()
  private readonly desiredId: { current: string }
  private active?: ActiveSkin
  private pending: Promise<void> = Promise.resolve()
  private snapshot: SkinSnapshot

  constructor(private readonly storage: SkinSelectionStorage) {
    this.desiredId = {
      current: storage.getItem(SKIN_STORAGE_KEY) ?? DEFAULT_SKIN_ID,
    }
    this.snapshot = {
      selectedId: DEFAULT_SKIN_ID,
      status: 'idle',
      revision: 0,
      skins: [DEFAULT_SKIN],
    }
  }

  /** Registers one package-owned skin and restores it when it was persisted. */
  register(definition: SkinDefinition): () => Promise<void> {
    this.validateDefinition(definition)
    this.definitions.set(definition.id, definition)
    this.publishRegistry()
    if (this.desiredId.current === definition.id) {
      void this.enqueueRestore(definition).catch(() => undefined)
    }
    return () => this.enqueueUnregister(definition)
  }

  /** Serializes selection so two rapid clicks cannot overlap activation fibers. */
  select(id: string): Promise<void> {
    return this.enqueue(id, true)
  }

  /** Exposes the transition queue for deterministic startup and tests. */
  whenIdle(): Promise<void> {
    return this.pending
  }

  /** React's external-store contract requires a stable snapshot reference. */
  getSnapshot = (): SkinSnapshot => this.snapshot

  /** Listener identity must survive React's subscribe/unsubscribe cycle. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private validateDefinition(definition: SkinDefinition): void {
    if (definition.id.length === 0 || definition.id === DEFAULT_SKIN_ID) {
      throw new Error(`invalid full-skin id "${definition.id}"`)
    }
    if (this.definitions.has(definition.id)) {
      throw new Error(`full skin "${definition.id}" is already registered`)
    }
  }

  private enqueue(id: string, persist: boolean): Promise<void> {
    const request = this.pending.then(() => this.transition(id, persist))
    this.pending = request.catch(() => undefined)
    return request
  }

  private enqueueRestore(definition: SkinDefinition): Promise<void> {
    const request = this.pending.then(() => {
      if (
        this.desiredId.current !== definition.id
        || this.definitions.get(definition.id) !== definition
      ) return
      return this.transition(definition.id, false)
    })
    this.pending = request.catch(() => undefined)
    return request
  }

  private enqueueUnregister(definition: SkinDefinition): Promise<void> {
    const request = this.pending.then(() => this.unregister(definition))
    this.pending = request.catch(() => undefined)
    return request
  }

  private async transition(id: string, persist: boolean): Promise<void> {
    const target = this.resolveTarget(id)
    const unknown = id !== DEFAULT_SKIN_ID && target === undefined
    const resolvedId = target?.id ?? DEFAULT_SKIN_ID
    if (this.snapshot.selectedId === resolvedId) {
      this.commitSelection(resolvedId, persist)
      if (unknown) {
        this.publish({
          status: 'error',
          error: `unknown full skin "${id}"; restored default`,
        })
      }
      return
    }
    const previous = this.active?.definition
    this.publish({ status: 'switching', error: undefined })
    try {
      await this.disposeActive()
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause))
      this.publish({ status: 'error', error: error.message })
      throw error
    }
    await this.activateWithRollback(target, previous, persist)
    if (unknown) {
      this.publish({
        status: 'error',
        error: `unknown full skin "${id}"; restored default`,
      })
    }
  }

  private resolveTarget(id: string): SkinDefinition | undefined {
    if (id === DEFAULT_SKIN_ID) return undefined
    return this.definitions.get(id)
  }

  private async disposeActive(): Promise<void> {
    const active = this.active
    if (active === undefined) return
    await active.dispose()
    if (this.active === active) this.active = undefined
  }

  private async activateWithRollback(
    target: SkinDefinition | undefined,
    previous: SkinDefinition | undefined,
    persist: boolean,
  ): Promise<void> {
    try {
      await this.activate(target)
    } catch (cause) {
      const activationError = cause instanceof Error ? cause : new Error(String(cause))
      try {
        await this.restore(previous)
      } catch (restoreCause) {
        const restoreError = restoreCause instanceof Error
          ? restoreCause
          : new Error(String(restoreCause))
        const message = `${activationError.message}; failed to restore "${previous?.id ?? DEFAULT_SKIN_ID}": ${restoreError.message}`
        this.active = undefined
        this.publish({
          selectedId: DEFAULT_SKIN_ID,
          status: 'error',
          error: message,
        })
        throw new AggregateError([activationError, restoreError], message)
      }
      this.publish({ status: 'error', error: activationError.message })
      throw activationError
    }
    this.commitSelection(target?.id ?? DEFAULT_SKIN_ID, persist)
  }

  private async activate(definition: SkinDefinition | undefined): Promise<void> {
    if (definition === undefined) return
    const dispose = await definition.activate()
    if (typeof dispose !== 'function') {
      throw new TypeError(`full skin "${definition.id}" returned no disposer`)
    }
    this.active = { definition, dispose }
  }

  private async restore(definition: SkinDefinition | undefined): Promise<void> {
    if (definition === undefined || !this.definitions.has(definition.id)) return
    await this.activate(definition)
  }

  private commitSelection(id: string, persist: boolean): void {
    this.desiredId.current = id
    let persistenceError: Error | undefined
    if (persist) {
      try {
        this.storage.setItem(SKIN_STORAGE_KEY, id)
      } catch (cause) {
        persistenceError = cause instanceof Error ? cause : new Error(String(cause))
      }
    }
    this.publish({
      selectedId: id,
      status: persistenceError === undefined ? 'idle' : 'error',
      error: persistenceError?.message,
    })
    if (persistenceError !== undefined) throw persistenceError
  }

  private async unregister(definition: SkinDefinition): Promise<void> {
    if (this.definitions.get(definition.id) !== definition) return
    this.definitions.delete(definition.id)
    let cleanupError: Error | undefined
    if (this.active?.definition === definition) {
      try {
        await this.disposeActive()
      } catch (cause) {
        cleanupError = cause instanceof Error ? cause : new Error(String(cause))
        this.active = undefined
      }
      this.publish({
        selectedId: DEFAULT_SKIN_ID,
        status: cleanupError === undefined ? 'idle' : 'error',
        error: cleanupError?.message,
      })
    }
    this.publishRegistry()
    if (cleanupError !== undefined) throw cleanupError
  }

  private publishRegistry(): void {
    const skins = [...this.definitions.values()]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
      .map(({ activate: _activate, ...metadata }) => metadata)
    this.publish({ skins: [DEFAULT_SKIN, ...skins] })
  }

  private publish(change: Partial<SkinSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...change,
      revision: this.snapshot.revision + 1,
    }
    for (const listener of this.listeners) listener()
  }
}
