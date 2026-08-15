import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

export interface DshWebUiSkinMetadata {
  id: string
  name: string
  nameEn?: string
  description: string
  author?: string
  accent?: string
  order?: number
}

export interface DshWebUiCollectionRoute {
  kind: 'exact'
  path: string
  handler(request: IncomingMessage, response: ServerResponse): void
}

export interface DshWebUiPathOptions {
  env?: Record<string, string | undefined>
  home?: string
  cwd?: string
}

export const DSH_WEB_UI_COLLECTION_ROUTE = '/api/dsh-skin-switch/collections/dsh-web-ui'

type SkinRecord = Record<string, unknown>

const SKIN_ID = /^[a-z0-9-]+$/
const PACKAGE_PREFIX = '@linxin666/dsh-client-ui-skin-'

function firstNonBlank(...values: Array<string | undefined>): string | undefined {
  return values.map(value => value?.trim()).find(value => value !== undefined && value.length > 0)
}

function profileFromCwd(cwd: string, profilesRoot: string): string | undefined {
  const normalizedCwd = resolve(cwd)
  const canonical = (path: string): string => {
    try {
      return realpathSync(path)
    } catch {
      return resolve(path)
    }
  }
  if (canonical(dirname(normalizedCwd)) !== canonical(profilesRoot)) return undefined
  const profile = basename(normalizedCwd)
  try {
    return profile !== '' && statSync(normalizedCwd, { throwIfNoEntry: false })?.isDirectory() === true
      ? profile
      : undefined
  } catch {
    return undefined
  }
}

export function resolveDshWebUiSkinsDir(options: DshWebUiPathOptions = {}): string {
  const env = options.env ?? process.env
  const harnessHome = firstNonBlank(env.DSH_HOME) ?? join(options.home ?? homedir(), '.dsh')
  const profilesRoot = join(harnessHome, 'profiles')
  const profile = firstNonBlank(env.DSH_SKIN_PROFILE, env.DSH_PROFILE)
    ?? profileFromCwd(options.cwd ?? process.cwd(), profilesRoot)
    ?? 'web'
  return join(profilesRoot, profile, 'node_modules', '@linxin666', 'dsh-skins', 'skins')
}

function optionalString(record: SkinRecord, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function parseSkin(directory: string, value: unknown): DshWebUiSkinMetadata | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as SkinRecord
  const id = optionalString(record, 'id')
  const name = optionalString(record, 'name')
  const description = optionalString(record, 'description')
  if (id === undefined || !SKIN_ID.test(id) || id !== directory) return null
  if (name === undefined || description === undefined) return null
  if (record.package !== `${PACKAGE_PREFIX}${id}`) return null
  const order = typeof record.order === 'number' && Number.isFinite(record.order)
    ? record.order
    : undefined
  return {
    id,
    name,
    nameEn: optionalString(record, 'nameEn'),
    description,
    author: optionalString(record, 'author'),
    accent: optionalString(record, 'accent'),
    order,
  }
}

function readSkin(skinsDir: string, directory: string): DshWebUiSkinMetadata | null {
  try {
    const value: unknown = JSON.parse(readFileSync(join(skinsDir, directory, 'skin.json'), 'utf8'))
    return parseSkin(directory, value)
  } catch {
    return null
  }
}

export function discoverDshWebUiSkins(skinsDir: string): DshWebUiSkinMetadata[] {
  let directories: string[]
  try {
    directories = readdirSync(skinsDir)
  } catch {
    return []
  }
  return directories
    .map(directory => readSkin(skinsDir, directory))
    .filter((skin): skin is DshWebUiSkinMetadata => skin !== null)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name))
}

function answerJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

export function createDshWebUiCollectionRoute(
  skinsDir = resolveDshWebUiSkinsDir(),
): DshWebUiCollectionRoute {
  return {
    kind: 'exact',
    path: DSH_WEB_UI_COLLECTION_ROUTE,
    handler(request, response) {
      if (request.method !== 'GET') {
        answerJson(response, 405, { ok: false, error: 'method-not-allowed' })
        return
      }
      answerJson(response, 200, { ok: true, skins: discoverDshWebUiSkins(skinsDir) })
    },
  }
}
