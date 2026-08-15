// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, inject } from '../src/client/index.ts'

const registrations: Array<{ options: Record<string, unknown>; component: unknown }> = []
const provided = new Map<string, unknown>()

function testContext(): Context {
  return {
    effect(factory: () => unknown): unknown {
      return factory()
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

beforeEach(() => {
  registrations.length = 0
  provided.clear()
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('skin settings client wiring', () => {
  it('provides the manager and registers a dedicated Settings section', () => {
    apply(testContext())

    expect(inject).toEqual(['slots', 'locale'])
    expect(provided.has('skinManager')).toBe(true)
    expect(registrations).toHaveLength(1)
    expect(registrations[0]?.options).toMatchObject({
      name: 'settings.section',
      id: 'skins',
      order: 12,
      locale: 'settings.skins',
    })
  })

  it('does not mount the legacy floating switcher', () => {
    apply(testContext())

    expect(document.querySelector('[data-dsh-skin-switcher-root]')).toBeNull()
    expect(document.body.children).toHaveLength(0)
  })
})
