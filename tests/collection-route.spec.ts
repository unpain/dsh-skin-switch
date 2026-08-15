import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import { apply, inject } from '../src/index.ts'
import {
  DSH_WEB_UI_COLLECTION_ROUTE,
  createDshWebUiCollectionRoute,
  resolveDshWebUiSkinsDir,
} from '../src/collections/dsh-web-ui-host.ts'

function fixture(): { root: string; skins: string } {
  const root = mkdtempSync(join(tmpdir(), 'dsh-skin-route-'))
  const skins = join(root, 'profiles', 'custom', 'node_modules', '@linxin666', 'dsh-skins', 'skins')
  mkdirSync(join(skins, 'minecraft'), { recursive: true })
  writeFileSync(join(skins, 'minecraft', 'skin.json'), JSON.stringify({
    id: 'minecraft',
    name: '方块世界',
    description: 'Voxel',
    package: '@linxin666/dsh-client-ui-skin-minecraft',
  }))
  return { root, skins }
}

describe('dsh-web-ui collection host route', () => {
  it('resolves the installed collection from DSH home and profile', () => {
    expect(resolveDshWebUiSkinsDir({
      env: { DSH_HOME: ' /tmp/custom-home ', DSH_PROFILE: ' custom ' },
      home: '/unused',
    })).toBe('/tmp/custom-home/profiles/custom/node_modules/@linxin666/dsh-skins/skins')
  })

  it('uses the cwd-selected custom profile when no environment override is set', () => {
    const { root, skins } = fixture()
    try {
      expect(resolveDshWebUiSkinsDir({
        env: { DSH_HOME: root },
        home: '/unused',
        cwd: join(root, 'profiles', 'custom'),
      })).toBe(skins)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('serves discovered metadata as JSON', () => {
    const { root, skins } = fixture()
    try {
      const route = createDshWebUiCollectionRoute(skins)
      const response = {
        status: 0,
        headers: {} as Record<string, string>,
        body: '',
        writeHead(status: number, headers: Record<string, string>): void {
          this.status = status
          this.headers = headers
        },
        end(body: string): void { this.body = body },
      }

      route.handler({ method: 'GET' } as never, response as never)

      expect(route).toMatchObject({ kind: 'exact', path: DSH_WEB_UI_COLLECTION_ROUTE })
      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('application/json')
      expect(JSON.parse(response.body)).toMatchObject({
        ok: true,
        skins: [{ id: 'minecraft', name: '方块世界' }],
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('registers the route behind the webServer injection', () => {
    const register = vi.fn(() => () => undefined)
    const effect = vi.fn((factory: () => unknown) => factory())
    apply({ webServer: { register }, effect } as unknown as Context)

    expect(inject).toEqual(['webServer'])
    expect(register).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'exact',
      path: DSH_WEB_UI_COLLECTION_ROUTE,
    }))
  })
})
