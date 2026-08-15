import { describe, expect, it, vi } from 'vitest'
import {
  DshWebUiSwitchCommittedError,
} from '../src/client/collections/dsh-web-ui.ts'
import {
  DshWebUiHttpGateway,
  manifestHasDshWebUiSkin,
} from '../src/client/collections/dsh-web-ui-gateway.ts'

const minecraft = {
  id: 'minecraft',
  name: '方块世界',
  description: 'Voxel',
  package: '@linxin666/dsh-client-ui-skin-minecraft',
}

describe('dsh-web-ui browser gateway', () => {
  it('loads the host-discovered collection', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      skins: [minecraft],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const gateway = new DshWebUiHttpGateway({
      fetcher,
      location: { href: 'http://127.0.0.1:3080/', reload: vi.fn() },
      sleep: async () => undefined,
    })

    await expect(gateway.list()).resolves.toEqual([minecraft])
    expect(fetcher).toHaveBeenCalledWith(
      '/api/dsh-skin-switch/collections/dsh-web-ui',
      expect.objectContaining({ cache: 'no-store' }),
    )
  })

  it('applies a skin and waits until the served boot manifest contains it', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const manifests = [
      '<script src="/plugins/@linxin666/dsh-client-ui-skin-center/client.js"></script>',
      '<script src="/plugins/@linxin666/dsh-client-ui-skin-minecraft/client.js"></script>',
    ]
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url === '/api/skin-center/apply') {
        return new Response(JSON.stringify({ ok: true, active: 'minecraft' }), { status: 200 })
      }
      return new Response(manifests.shift() ?? '', { status: 200 })
    })
    const gateway = new DshWebUiHttpGateway({
      fetcher,
      location: { href: 'http://127.0.0.1:3080/', reload: vi.fn() },
      sleep: async () => undefined,
      manifestChecks: 3,
    })

    await gateway.apply('minecraft')

    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ skin: 'minecraft' })
    expect(calls.filter(call => call.url === 'http://127.0.0.1:3080/')).toHaveLength(2)
  })

  it('requests official and waits until no collection skin remains in the manifest', async () => {
    const bodies: unknown[] = []
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/skin-center/apply') {
        bodies.push(JSON.parse(String(init?.body)))
        return new Response(JSON.stringify({ ok: true, active: 'none' }), { status: 200 })
      }
      return new Response('<script src="/plugins/@linxin666/dsh-client-ui-skin-center/client.js"></script>', { status: 200 })
    })
    const gateway = new DshWebUiHttpGateway({
      fetcher,
      location: { href: 'http://127.0.0.1:3080/', reload: vi.fn() },
      sleep: async () => undefined,
    })

    await gateway.apply(null)

    expect(bodies).toEqual([{ official: true }])
  })

  it('marks a manifest timeout as an already committed host switch', async () => {
    const fetcher = vi.fn(async (url: string) => (
      url === '/api/skin-center/apply'
        ? new Response(JSON.stringify({ ok: true, active: 'minecraft' }), { status: 200 })
        : new Response('<html>old manifest</html>', { status: 200 })
    ))
    const gateway = new DshWebUiHttpGateway({
      fetcher,
      location: { href: 'http://127.0.0.1:3080/', reload: vi.fn() },
      sleep: async () => undefined,
      manifestChecks: 2,
    })

    await expect(gateway.apply('minecraft')).rejects.toBeInstanceOf(DshWebUiSwitchCommittedError)
  })

  it('distinguishes skin-center from an active collection skin', () => {
    expect(manifestHasDshWebUiSkin(
      '<script src="/plugins/@linxin666/dsh-client-ui-skin-center/client.js"></script>',
      null,
    )).toBe(true)
    expect(manifestHasDshWebUiSkin(
      '<script src="/plugins/@linxin666/dsh-client-ui-skin-minecraft/client.js"></script>',
      null,
    )).toBe(false)
  })
})
