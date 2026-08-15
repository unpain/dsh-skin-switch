// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Context } from '@deepseek-ai/cordis'
import { apply, inject } from '../src/client/index.ts'
import { en, type SkinSettingsKey, zh } from '../src/client/locales.ts'
import { SkinManager } from '../src/client/manager.ts'
import { SkinSettingsSection } from '../src/client/settings/SkinSettingsSection.tsx'

const registrations: Array<{ options: Record<string, unknown>; component: unknown }> = []
const provided = new Map<string, unknown>()
const effects: Array<() => void> = []

function testContext(): Context {
  return {
    effect(factory: () => unknown): unknown {
      const result = factory()
      if (typeof result === 'function') effects.push(result as () => void)
      return result
    },
    locale: {
      bind: () => (key: string) => key,
      register: vi.fn(() => () => undefined),
    },
    provide(name: string, value: unknown): void {
      provided.set(name, value)
    },
    slots: {
      inject(_name: string, callback: () => unknown): unknown {
        return callback()
      },
      register(options: Record<string, unknown>, component: unknown): () => void {
        registrations.push({ options, component })
        return () => undefined
      },
    },
  } as unknown as Context
}

function renderSettings(dictionary: Record<SkinSettingsKey, string>): string {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const t = (key: SkinSettingsKey): string => dictionary[key]
  flushSync(() => root.render(createElement(SkinSettingsSection, {
    manager: new SkinManager(localStorage),
    t,
  })))
  const rendered = container.textContent ?? ''
  root.unmount()
  return rendered
}

beforeEach(() => {
  registrations.length = 0
  effects.length = 0
  provided.clear()
  document.body.innerHTML = ''
  localStorage.clear()
  Reflect.deleteProperty(window, '__DSH_BOOT__')
  vi.unstubAllGlobals()
})

afterEach(() => {
  for (const dispose of effects.splice(0)) dispose()
})

describe('skin settings client wiring', () => {
  it('provides the manager and registers a dedicated Settings section', () => {
    apply(testContext())

    expect(inject).toEqual(['slots', 'locale'])
    expect(provided.has('skinManager')).toBe(true)
    expect(registrations).toHaveLength(1)
    const sectionInject = registrations[0]?.options.inject as () => { manager: unknown }
    expect(provided.get('skinManager')).toBe(sectionInject().manager)
    expect(registrations[0]?.options).toMatchObject({
      name: 'settings.section',
      id: 'skins',
      order: 12,
      locale: 'settings.skins',
    })
  })

  it('adopts the boot-active collection skin before local restore can overlap it', async () => {
    localStorage.setItem('dsh-skin-manager:selected', 'maid-atelier')
    Object.defineProperty(window, '__DSH_BOOT__', {
      configurable: true,
      value: {
        entries: [
          { id: '@linxin666/dsh-client-ui-skin-center' },
          { id: '@linxin666/dsh-client-ui-skin-minecraft' },
        ],
      },
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      skins: [{
        id: 'minecraft',
        name: '方块世界',
        description: 'Voxel',
        package: '@linxin666/dsh-client-ui-skin-minecraft',
      }],
    }), { status: 200 })))

    apply(testContext())
    const injectSection = registrations[0]?.options.inject as () => { manager: SkinManager }
    const view = injectSection().manager
    await vi.waitFor(() => {
      expect(view.getSnapshot().skins).toHaveLength(2)
    })

    expect(localStorage.getItem('dsh-skin-manager:selected')).toBe('default')
    expect(view.getSnapshot().selectedId).toBe('dsh-web-ui:minecraft')
  })

  it('does not mount the legacy floating switcher', () => {
    apply(testContext())

    expect(document.querySelector('[data-dsh-skin-switcher-root]')).toBeNull()
    expect(document.body.children).toHaveLength(0)
  })

  it('marks the Skins navigation button and removes the marker on disposal', async () => {
    apply(testContext())
    document.body.innerHTML = [
      '<button><svg></svg><span>Skins</span></button>',
      '<nav><button><svg></svg><span>Skins</span></button></nav>',
    ].join('')
    const navButton = document.querySelector('nav button')

    await vi.waitFor(() => {
      expect(navButton?.hasAttribute('data-dsh-skin-nav-icon')).toBe(true)
    })
    expect(document.querySelector('body > button')?.hasAttribute('data-dsh-skin-nav-icon')).toBe(false)

    for (const dispose of effects.splice(0)) dispose()
    expect(navButton?.hasAttribute('data-dsh-skin-nav-icon')).toBe(false)
  })

  it.each([
    [zh, 'DSH 默认', '恢复 DeepSeek Harness 原生界面。', 'DSH Default'],
    [en, 'DSH Default', 'Restore the native DeepSeek Harness interface.', 'DSH 默认'],
  ] as const)('renders localized default metadata', (dictionary, name, description, otherName) => {
    const rendered = renderSettings(dictionary)

    expect(rendered).toContain(name)
    expect(rendered).toContain(description)
    expect(rendered).not.toContain(otherName)
  })
})
