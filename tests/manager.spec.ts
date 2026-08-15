import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SKIN_ID,
  SkinManager,
  type SkinDefinition,
  type SkinSelectionStorage,
} from '../src/client/manager.ts'

class MemoryStorage implements SkinSelectionStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function skin(id: string, events: string[], failure?: Error): SkinDefinition {
  return {
    id,
    name: id,
    description: `${id} description`,
    activate: async () => {
      events.push(`activate:${id}`)
      if (failure) throw failure
      return async () => {
        events.push(`dispose:${id}`)
      }
    },
  }
}

describe('SkinManager', () => {
  it('activates exactly one registered skin and retracts it for the default skin', async () => {
    const storage = new MemoryStorage()
    const events: string[] = []
    const manager = new SkinManager(storage)
    manager.register(skin('maid-atelier', events))

    await manager.select('maid-atelier')
    expect(manager.getSnapshot().selectedId).toBe('maid-atelier')
    expect(storage.getItem('dsh-skin-manager:selected')).toBe('maid-atelier')

    await manager.select(DEFAULT_SKIN_ID)
    expect(events).toEqual(['activate:maid-atelier', 'dispose:maid-atelier'])
    expect(manager.getSnapshot().selectedId).toBe(DEFAULT_SKIN_ID)
  })

  it('disposes the old skin before activating the next skin', async () => {
    const events: string[] = []
    const manager = new SkinManager(new MemoryStorage())
    manager.register(skin('maid-atelier', events))
    manager.register(skin('future-skin', events))

    await manager.select('maid-atelier')
    await manager.select('future-skin')

    expect(events).toEqual([
      'activate:maid-atelier',
      'dispose:maid-atelier',
      'activate:future-skin',
    ])
  })

  it('restores the previous skin when the next activation fails', async () => {
    const events: string[] = []
    const manager = new SkinManager(new MemoryStorage())
    manager.register(skin('maid-atelier', events))
    manager.register(skin('broken', events, new Error('broken activation')))
    await manager.select('maid-atelier')

    await expect(manager.select('broken')).rejects.toThrow('broken activation')

    expect(events).toEqual([
      'activate:maid-atelier',
      'dispose:maid-atelier',
      'activate:broken',
      'activate:maid-atelier',
    ])
    expect(manager.getSnapshot()).toMatchObject({
      selectedId: 'maid-atelier',
      status: 'error',
      error: 'broken activation',
    })
  })

  it('restores a persisted skin when that package registers', async () => {
    const storage = new MemoryStorage()
    const events: string[] = []
    storage.setItem('dsh-skin-manager:selected', 'maid-atelier')
    const manager = new SkinManager(storage)

    manager.register(skin('maid-atelier', events))
    await manager.whenIdle()

    expect(events).toEqual(['activate:maid-atelier'])
    expect(manager.getSnapshot().selectedId).toBe('maid-atelier')
  })

  it('ignores a persisted restore queued after a same-tick default selection', async () => {
    const storage = new MemoryStorage()
    const events: string[] = []
    storage.setItem('dsh-skin-manager:selected', 'maid-atelier')
    const manager = new SkinManager(storage)

    const selection = manager.select(DEFAULT_SKIN_ID)
    manager.register(skin('maid-atelier', events))
    await selection
    await manager.whenIdle()

    expect(events).toEqual([])
    expect(storage.getItem('dsh-skin-manager:selected')).toBe(DEFAULT_SKIN_ID)
    expect(manager.getSnapshot()).toMatchObject({
      selectedId: DEFAULT_SKIN_ID,
      status: 'idle',
    })
  })

  it('publishes stable snapshots when registry or selection changes', async () => {
    const manager = new SkinManager(new MemoryStorage())
    const listener = vi.fn()
    const unsubscribe = manager.subscribe(listener)
    const before = manager.getSnapshot()

    manager.register(skin('maid-atelier', []))
    const registered = manager.getSnapshot()
    await manager.select('maid-atelier')

    expect(registered).not.toBe(before)
    expect(registered.skins.map((entry) => entry.id)).toEqual([
      DEFAULT_SKIN_ID,
      'maid-atelier',
    ])
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it('settles in error when the active skin disposer rejects', async () => {
    const manager = new SkinManager(new MemoryStorage())
    manager.register({
      id: 'fragile',
      name: 'fragile',
      description: 'fragile description',
      activate: async () => async () => {
        throw new Error('dispose failed')
      },
    })
    await manager.select('fragile')

    await expect(manager.select(DEFAULT_SKIN_ID)).rejects.toThrow('dispose failed')

    expect(manager.getSnapshot()).toMatchObject({
      selectedId: 'fragile',
      status: 'error',
      error: 'dispose failed',
    })
  })

  it('falls back to default when both activation and rollback fail', async () => {
    const manager = new SkinManager(new MemoryStorage())
    let activations = 0
    manager.register({
      id: 'fragile',
      name: 'fragile',
      description: 'fragile description',
      activate: async () => {
        activations += 1
        if (activations > 1) throw new Error('restore failed')
        return async () => undefined
      },
    })
    manager.register(skin('broken', [], new Error('broken activation')))
    await manager.select('fragile')

    await expect(manager.select('broken')).rejects.toThrow(
      'broken activation; failed to restore "fragile": restore failed',
    )

    expect(manager.getSnapshot()).toMatchObject({
      selectedId: DEFAULT_SKIN_ID,
      status: 'error',
      error: 'broken activation; failed to restore "fragile": restore failed',
    })
  })

  it('removes a skin and settles in error when unregister cleanup rejects', async () => {
    const manager = new SkinManager(new MemoryStorage())
    const unregister = manager.register({
      id: 'fragile',
      name: 'fragile',
      description: 'fragile description',
      activate: async () => async () => {
        throw new Error('unregister cleanup failed')
      },
    })
    await manager.select('fragile')

    await expect(unregister()).rejects.toThrow('unregister cleanup failed')

    expect(manager.getSnapshot()).toMatchObject({
      selectedId: DEFAULT_SKIN_ID,
      status: 'error',
      error: 'unregister cleanup failed',
    })
    expect(manager.getSnapshot().skins.map(entry => entry.id)).toEqual([DEFAULT_SKIN_ID])
  })

  it('falls back to the default skin when an unknown id is selected', async () => {
    const storage = new MemoryStorage()
    const events: string[] = []
    const manager = new SkinManager(storage)
    manager.register(skin('maid-atelier', events))
    await manager.select('maid-atelier')

    await manager.select('removed-skin')

    expect(events).toEqual(['activate:maid-atelier', 'dispose:maid-atelier'])
    expect(storage.getItem('dsh-skin-manager:selected')).toBe(DEFAULT_SKIN_ID)
    expect(manager.getSnapshot()).toMatchObject({
      selectedId: DEFAULT_SKIN_ID,
      status: 'error',
      error: 'unknown full skin "removed-skin"; restored default',
    })
  })
})
