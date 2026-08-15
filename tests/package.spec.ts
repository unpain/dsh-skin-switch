import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
const patch = readFileSync(resolve(process.cwd(), 'cordis.patch.yml'), 'utf8')

describe('installable package contract', () => {
  it('uses the public Git package identity and ships runtime artifacts', () => {
    expect(manifest.name).toBe('dsh-skin-switch')
    expect(manifest.private).toBe(true)
    expect(manifest.files).toEqual([
      'lib/index.js',
      'lib/client.js',
      'lib/client.js.map',
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
})
