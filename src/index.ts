import type { Context } from '@deepseek-ai/cordis'
import {
  createDshWebUiCollectionRoute,
  type DshWebUiCollectionRoute,
} from './collections/dsh-web-ui-host.ts'

type HostContext = Context & {
  webServer: {
    register(route: DshWebUiCollectionRoute): () => void
  }
}

/** Exposes installed collection metadata without coupling the browser to profile paths. */
export function apply(ctx: Context): void {
  const host = ctx as HostContext
  ctx.effect(
    () => host.webServer.register(createDshWebUiCollectionRoute()),
    'skin-manager: dsh-web-ui collection route',
  )
}

export const inject: string[] = ['webServer']
