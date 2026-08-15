import { describe, expect, it } from 'vitest'
import {
  DshWebUiCollectionAdapter,
  DshWebUiSwitchCommittedError,
  activeDshWebUiSkinId,
  dshWebUiSelectionId,
  type DshWebUiCollectionGateway,
  type DshWebUiSkin,
} from '../src/client/collections/dsh-web-ui.ts'
import {
  SKIN_STORAGE_KEY,
  SkinManager,
  type SkinDefinition,
  type SkinSelectionStorage,
} from '../src/client/manager.ts'

class MemoryStorage implements SkinSelectionStorage {
  private readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

class Gateway implements DshWebUiCollectionGateway {
  readonly events: string[] = []
  reloads = 0
  failure?: Error

  constructor(readonly skins: readonly DshWebUiSkin[]) {}

  async list(): Promise<readonly DshWebUiSkin[]> { return this.skins }

  async apply(id: string | null): Promise<void> {
    this.events.push(`apply:${id ?? 'official'}`)
    if (this.failure !== undefined) throw this.failure
  }

  reload(): void { this.reloads += 1 }
}

const minecraft: DshWebUiSkin = {
  id: 'minecraft',
  name: '方块世界',
  nameEn: 'Minecraft Voxel',
  description: 'Voxel skin',
  author: 'dsh-web-ui',
  accent: '#7cbd4b',
  order: 8,
}

function localSkin(id: string, events: string[]): SkinDefinition {
  return {
    id,
    name: id,
    description: id,
    activate: () => {
      events.push(`activate:${id}`)
      return () => { events.push(`dispose:${id}`) }
    },
  }
}

describe('dsh-web-ui collection adapter', () => {
  it('detects active collection skins from the boot graph but excludes skin-center', () => {
    expect(activeDshWebUiSkinId([
      { id: '@linxin666/dsh-client-ui-skin-center' },
      { id: '@linxin666/dsh-client-ui-skin-minecraft' },
    ])).toBe('minecraft')
    expect(activeDshWebUiSkinId([{ id: '@linxin666/dsh-client-ui-skin-center' }])).toBeNull()
  })

  it('merges discovered skins and marks the boot-active skin instead of default', async () => {
    const storage = new MemoryStorage()
    const manager = new SkinManager(storage)
    const adapter = new DshWebUiCollectionAdapter(manager, storage, new Gateway([minecraft]), 'minecraft')

    await adapter.initialize()

    expect(adapter.getSnapshot().skins.map(skin => skin.id)).toEqual([
      'default',
      dshWebUiSelectionId('minecraft'),
    ])
    expect(adapter.getSnapshot().selectedId).toBe(dshWebUiSelectionId('minecraft'))
  })

  it('disposes a local skin before applying an external skin', async () => {
    const storage = new MemoryStorage()
    const events: string[] = []
    const manager = new SkinManager(storage)
    manager.register(localSkin('maid', events))
    await manager.select('maid')
    events.length = 0
    const gateway = new Gateway([minecraft])
    const adapter = new DshWebUiCollectionAdapter(manager, storage, gateway, null)
    await adapter.initialize()

    await adapter.select(dshWebUiSelectionId('minecraft'))

    expect(events).toEqual(['dispose:maid'])
    expect(gateway.events).toEqual(['apply:minecraft'])
    expect(gateway.reloads).toBe(1)
    expect(adapter.getSnapshot().selectedId).toBe(dshWebUiSelectionId('minecraft'))
  })

  it('defers local activation until the external skin is unloaded and the page reloads', async () => {
    const storage = new MemoryStorage()
    const events: string[] = []
    const manager = new SkinManager(storage)
    manager.register(localSkin('maid', events))
    const gateway = new Gateway([minecraft])
    const adapter = new DshWebUiCollectionAdapter(manager, storage, gateway, 'minecraft')
    await adapter.initialize()

    await adapter.select('maid')

    expect(events).toEqual([])
    expect(storage.getItem(SKIN_STORAGE_KEY)).toBe('maid')
    expect(gateway.events).toEqual(['apply:official'])
    expect(gateway.reloads).toBe(1)
  })

  it('restores the previous local skin when external activation fails', async () => {
    const storage = new MemoryStorage()
    const events: string[] = []
    const manager = new SkinManager(storage)
    manager.register(localSkin('maid', events))
    await manager.select('maid')
    events.length = 0
    const gateway = new Gateway([minecraft])
    gateway.failure = new Error('apply failed')
    const adapter = new DshWebUiCollectionAdapter(manager, storage, gateway, null)
    await adapter.initialize()

    await expect(adapter.select(dshWebUiSelectionId('minecraft'))).rejects.toThrow('apply failed')

    expect(events).toEqual(['dispose:maid', 'activate:maid'])
    expect(manager.getSnapshot().selectedId).toBe('maid')
    expect(gateway.reloads).toBe(0)
    expect(adapter.getSnapshot().status).toBe('error')
  })

  it('waits for a persisted local restore before capturing external rollback state', async () => {
    const storage = new MemoryStorage()
    storage.setItem(SKIN_STORAGE_KEY, 'maid')
    const events: string[] = []
    const firstActivation = Promise.withResolvers<void>()
    const releaseActivation = Promise.withResolvers<void>()
    let activations = 0
    const manager = new SkinManager(storage)
    const gateway = new Gateway([minecraft])
    gateway.failure = new Error('apply failed')
    const adapter = new DshWebUiCollectionAdapter(manager, storage, gateway, null)
    await adapter.initialize()
    manager.register({
      id: 'maid',
      name: 'maid',
      description: 'maid',
      activate: async () => {
        activations += 1
        events.push('activate:maid')
        if (activations === 1) {
          firstActivation.resolve()
          await releaseActivation.promise
        }
        return () => { events.push('dispose:maid') }
      },
    })

    const selection = adapter.select(dshWebUiSelectionId('minecraft'))
    await firstActivation.promise
    releaseActivation.resolve()
    await expect(selection).rejects.toThrow('apply failed')

    expect(events).toEqual(['activate:maid', 'dispose:maid', 'activate:maid'])
    expect(manager.getSnapshot().selectedId).toBe('maid')
  })

  it('treats an acknowledged external switch as authoritative after polling times out', async () => {
    const storage = new MemoryStorage()
    const events: string[] = []
    const manager = new SkinManager(storage)
    manager.register(localSkin('maid', events))
    await manager.select('maid')
    events.length = 0
    const gateway = new Gateway([minecraft])
    gateway.failure = new DshWebUiSwitchCommittedError('minecraft', new Error('poll timed out'))
    const adapter = new DshWebUiCollectionAdapter(manager, storage, gateway, null)
    await adapter.initialize()

    await expect(adapter.select(dshWebUiSelectionId('minecraft')))
      .rejects.toBeInstanceOf(DshWebUiSwitchCommittedError)

    expect(events).toEqual(['dispose:maid'])
    expect(storage.getItem(SKIN_STORAGE_KEY)).toBe('default')
    expect(adapter.getSnapshot().selectedId).toBe(dshWebUiSelectionId('minecraft'))
    expect(gateway.reloads).toBe(1)
  })

  it('keeps a local restore target after an acknowledged external unload times out', async () => {
    const storage = new MemoryStorage()
    const manager = new SkinManager(storage)
    manager.register(localSkin('maid', []))
    const gateway = new Gateway([minecraft])
    gateway.failure = new DshWebUiSwitchCommittedError(null, new Error('poll timed out'))
    const adapter = new DshWebUiCollectionAdapter(manager, storage, gateway, 'minecraft')
    await adapter.initialize()

    await expect(adapter.select('maid')).rejects.toBeInstanceOf(DshWebUiSwitchCommittedError)

    expect(storage.getItem(SKIN_STORAGE_KEY)).toBe('maid')
    expect(gateway.reloads).toBe(1)
  })
})
