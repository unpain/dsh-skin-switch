import type { Context } from '@deepseek-ai/cordis'
import type {
  SkinDefinition,
  SkinDisposer,
  SkinManager,
} from 'dsh-skin-switch/client'

const dispose: SkinDisposer = () => undefined

const definition: SkinDefinition = {
  id: 'consumer-skin',
  name: 'Consumer skin',
  description: 'Public client API contract',
  activate: () => dispose,
}

export function registerConsumerSkin(ctx: Context): () => Promise<void> {
  const manager: SkinManager = ctx.skinManager
  return manager.register(definition)
}
