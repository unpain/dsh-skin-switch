import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
const patch = readFileSync(resolve(process.cwd(), 'cordis.patch.yml'), 'utf8')

const clientDeclarationPath = resolve(process.cwd(), 'lib/client.d.ts')

describe('installable package contract', () => {
  it('uses the public Git package identity and ships runtime artifacts', () => {
    expect(manifest.name).toBe('dsh-skin-switch')
    expect(manifest.private).toBe(true)
    expect(manifest.files).toEqual([
      'lib/index.js',
      'lib/client.js',
      'lib/client.js.map',
      'lib/client.d.ts',
      'cordis.patch.yml',
      'README.md',
      'LICENSE',
    ])
    expect(manifest.dsh.client.inject).toEqual([
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-ui-settings',
    ])
    expect(patch).toContain("id: dsh-skin-switch")
    expect(patch).toContain("name: 'dsh-skin-switch'")
  })

  it('publishes the client runtime with generated public declarations', () => {
    expect(manifest.exports['./client']).toEqual({
      types: './lib/client.d.ts',
      default: './lib/client.js',
    })
    expect(existsSync(clientDeclarationPath)).toBe(true)

    const declaration = readFileSync(clientDeclarationPath, 'utf8')
    expect(declaration).toMatch(/declare module ["']@deepseek-ai\/cordis["']/)
    expect(declaration).toMatch(/interface Context\s*\{\s*skinManager: SkinManager;/)
    expect(declaration).toMatch(
      /export \{[^}]*type SkinDefinition[^}]*type SkinDisposer[^}]*\}/,
    )
    expect(declaration).not.toMatch(/\/(?:Users|private|tmp)\//)
  })
})
