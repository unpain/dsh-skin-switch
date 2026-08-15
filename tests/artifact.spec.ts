import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('prebuilt DSH artifacts', () => {
  it('registers the new package id without machine-local paths', () => {
    const client = readFileSync(resolve(process.cwd(), 'lib/client.js'), 'utf8')
    const map = readFileSync(resolve(process.cwd(), 'lib/client.js.map'), 'utf8')
    expect(client).toContain('window.__ModuleLoader__.load({ id: "dsh-skin-switch"')
    expect(client).toContain('var module = { exports: {} }; var exports = module.exports;')
    expect(client).not.toContain('@dsh-local/dsh-client-ui-skin-switcher')
    expect(map).not.toContain('/Users/yujimaka')
  })
})
