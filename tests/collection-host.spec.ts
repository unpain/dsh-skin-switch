import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverDshWebUiSkins } from '../src/collections/dsh-web-ui-host.ts'

const roots: string[] = []

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-skin-collection-'))
  roots.push(root)
  return root
}

function writeSkin(root: string, directory: string, metadata: unknown): void {
  const skinDir = join(root, directory)
  mkdirSync(skinDir, { recursive: true })
  writeFileSync(join(skinDir, 'skin.json'), JSON.stringify(metadata))
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('dsh-web-ui collection discovery', () => {
  it('discovers valid skin metadata in display order', () => {
    const root = fixture()
    writeSkin(root, 'xp', {
      id: 'xp', name: 'Windows XP', nameEn: 'Windows XP', description: 'Luna',
      author: 'author-x', accent: '#316ac5', order: 6,
      package: '@linxin666/dsh-client-ui-skin-xp',
    })
    writeSkin(root, 'minecraft', {
      id: 'minecraft', name: '方块世界', nameEn: 'Minecraft Voxel', description: 'Voxel',
      accent: '#7cbd4b', order: 2,
      package: '@linxin666/dsh-client-ui-skin-minecraft',
    })

    expect(discoverDshWebUiSkins(root)).toEqual([
      {
        id: 'minecraft', name: '方块世界', nameEn: 'Minecraft Voxel',
        description: 'Voxel', accent: '#7cbd4b', order: 2,
      },
      {
        id: 'xp', name: 'Windows XP', nameEn: 'Windows XP', description: 'Luna',
        author: 'author-x', accent: '#316ac5', order: 6,
      },
    ])
  })

  it('ignores malformed and path-mismatched skin metadata', () => {
    const root = fixture()
    writeSkin(root, 'wrong-directory', {
      id: 'minecraft', name: 'Minecraft', description: 'Voxel',
      package: '@linxin666/dsh-client-ui-skin-minecraft',
    })
    writeSkin(root, 'unsafe', {
      id: '../unsafe', name: 'Unsafe', description: 'Unsafe', package: 'other-package',
    })
    writeSkin(root, 'valid', {
      id: 'valid', name: 'Valid', description: 'Safe',
      package: '@linxin666/dsh-client-ui-skin-valid',
    })

    expect(discoverDshWebUiSkins(root).map(skin => skin.id)).toEqual(['valid'])
  })

  it('returns an empty collection when the carrier is absent', () => {
    expect(discoverDshWebUiSkins(join(fixture(), 'missing'))).toEqual([])
  })
})
