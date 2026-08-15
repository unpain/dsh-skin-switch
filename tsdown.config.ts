import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

const ID = 'dsh-skin-switch'
const ROOT = dirname(fileURLToPath(import.meta.url))
const CSS_PREFIX = '\0dsh-css:'
const CSS_SUFFIX = '.mjs'
const CLIENT_EXTERNALS = ['react', 'react/jsx-runtime']
const cssFiles = new Map<string, string>()

const nodeConfig: UserConfig = {
  name: ID,
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: { neverBundle: ['@deepseek-ai/cordis'] },
}

const clientConfig: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: CLIENT_EXTERNALS,
    alwaysBundle: id => CLIENT_EXTERNALS.includes(id) ? undefined : true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  plugins: [{
    name: 'dsh-client-bundle-purity',
    resolveId(source) {
      if (!source.startsWith('@deepseek-ai/')) return null
      throw new Error(`client bundle purity: runtime import "${source}" must use a Cordis service`)
    },
  }, {
    name: 'dsh-css-modules-inline',
    resolveId(source, importer) {
      if (!source.endsWith('.module.css') || importer === undefined) return null
      const absolute = resolve(dirname(importer), source)
      const sourceId = relative(ROOT, absolute).split(sep).join('/')
      const virtualId = CSS_PREFIX + sourceId + CSS_SUFFIX
      cssFiles.set(virtualId, absolute)
      return virtualId
    },
    async load(virtualId) {
      if (!virtualId.startsWith(CSS_PREFIX)) return null
      const sourceId = virtualId.slice(CSS_PREFIX.length, -CSS_SUFFIX.length)
      const filename = cssFiles.get(virtualId)
      if (filename === undefined) throw new Error(`missing CSS source for ${sourceId}`)
      this.addWatchFile(filename)
      const { code, exports } = transform({
        filename: sourceId,
        code: await readFile(filename),
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classes: Record<string, string> = {}
      for (const [local, value] of Object.entries(exports ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
        classes[local] = value.name
      }
      const tagId = `${ID}/${basename(sourceId)}`
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
        `  const tag = document.createElement('style');`,
        `  tag.dataset.plugin = ${JSON.stringify(ID)};`,
        `  tag.dataset.pluginCss = tagId;`,
        `  tag.textContent = css;`,
        `  document.head.appendChild(tag);`,
        `}`,
        `export default ${JSON.stringify(classes)};`,
      ].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    sourcemapPathTransform(source, sourcemapPath) {
      if (!source.startsWith('.')) return source
      return relative(ROOT, resolve(dirname(sourcemapPath), source)).split(sep).join('/')
    },
    postBanner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
    postFooter: 'return module.exports; } });',
  },
}

const clientDtsConfig: UserConfig = {
  name: `${ID}/client-types`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'esm',
  fixedExtension: false,
  dts: { oxc: true, emitDtsOnly: true },
  clean: false,
}

export default [nodeConfig, clientConfig, clientDtsConfig]
