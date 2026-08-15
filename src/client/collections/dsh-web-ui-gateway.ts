import {
  DshWebUiSwitchCommittedError,
  type DshWebUiCollectionGateway,
  type DshWebUiSkin,
} from './dsh-web-ui.ts'

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

type GatewayOptions = {
  fetcher: Fetcher
  location: { href: string; reload(): void }
  sleep: (milliseconds: number) => Promise<void>
  manifestChecks?: number
}

const COLLECTION_ROUTE = '/api/dsh-skin-switch/collections/dsh-web-ui'
const APPLY_ROUTE = '/api/skin-center/apply'
const ACTIVE_SKIN_BUNDLE = /\/plugins\/@linxin666\/dsh-client-ui-skin-(?!center\/)[a-z0-9-]+\/client\.js/

export function manifestHasDshWebUiSkin(html: string, target: string | null): boolean {
  if (target === null) return !ACTIVE_SKIN_BUNDLE.test(html)
  return html.includes(`/plugins/@linxin666/dsh-client-ui-skin-${target}/client.js`)
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body = await response.json() as { error?: unknown }
    if (typeof body.error === 'string') return new Error(body.error)
  } catch {
    // Fall through to the status text when the endpoint did not answer JSON.
  }
  return new Error(`skin collection request failed (${response.status})`)
}

/** Calls the installed skin-center API and waits for its config watcher to publish. */
export class DshWebUiHttpGateway implements DshWebUiCollectionGateway {
  private readonly checks: number

  constructor(private readonly options: GatewayOptions) {
    this.checks = options.manifestChecks ?? 80
  }

  async list(): Promise<readonly DshWebUiSkin[]> {
    const response = await this.options.fetcher(COLLECTION_ROUTE, { cache: 'no-store' })
    if (!response.ok) throw await responseError(response)
    const body = await response.json() as { skins?: unknown }
    if (!Array.isArray(body.skins)) throw new Error('invalid dsh-web-ui collection response')
    return body.skins as DshWebUiSkin[]
  }

  async apply(id: string | null): Promise<void> {
    const body = id === null ? { official: true } : { skin: id }
    const response = await this.options.fetcher(APPLY_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw await responseError(response)
    try {
      await this.waitForManifest(id)
    } catch (cause) {
      throw new DshWebUiSwitchCommittedError(id, cause)
    }
  }

  reload(): void {
    this.options.location.reload()
  }

  private async waitForManifest(target: string | null): Promise<void> {
    for (let attempt = 0; attempt < this.checks; attempt += 1) {
      const response = await this.options.fetcher(this.options.location.href, { cache: 'no-store' })
      if (response.ok && manifestHasDshWebUiSkin(await response.text(), target)) return
      if (attempt + 1 < this.checks) await this.options.sleep(100)
    }
    throw new Error(`timed out waiting for skin "${target ?? 'official'}"`)
  }
}
