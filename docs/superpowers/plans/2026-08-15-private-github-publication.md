# dsh-skin-switch Private GitHub Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the verified DSH full-skin manager to the existing private `unpain/dsh-skin-switch` repository as an installable, reproducible `dsh-skin-switch` Git dependency and migrate the current maid/profile integration to that identity.

**Architecture:** Preserve the remote repository history, transplant only the manager source/tests/artifacts, and replace the machine-local build-helper import with one repository-owned tsdown configuration. Commit prebuilt `lib/` for Git URL installs; keep maid as a separate package that collaborates through the `skinManager` Cordis service.

**Tech Stack:** TypeScript, React 18, Cordis 4.0.1, DSH 0.1.0-rc.6 client modules, tsdown 0.22.14, lightningcss 1.32.x, Vitest 4.1.10, pnpm 10.33.0, GitHub Actions.

## Global Constraints

- The GitHub repository remains private throughout this plan.
- The package identity is exactly `dsh-skin-switch`; no `@dsh-local/dsh-client-ui-skin-switcher` compatibility alias remains.
- The repository contains only the manager; it MUST NOT contain maid source, images, maid build artifacts, maid LICENSE, or maid NOTICE.
- Git URL installation is the only distribution channel; do not publish npm, tags, or GitHub Releases.
- Commit `lib/index.js`, `lib/client.js`, and `lib/client.js.map` so installation does not build locally.
- Keep the existing remote MIT `LICENSE` unchanged.
- Do not copy `.dsh` profiles, credentials, sessions, absolute home paths, or `node_modules`.
- Preserve manager behavior: dedicated Settings/Skins section, one active full skin, persistence, unknown-ID default fallback, activation rollback, and settled error snapshots.
- Use a clean cutover for the package rename: migrate every maid/profile reference and leave zero old-name occurrences.

---

### Task 1: Transplant the manager and establish the Git package identity

**Files:**
- Create: `.gitignore`
- Create: `src/index.ts`
- Create: `src/client/index.ts`
- Create: `src/client/manager.ts`
- Create: `src/client/locales.ts`
- Create: `src/client/settings/SkinSettingsSection.tsx`
- Create: `src/client/settings/SkinSettingsSection.module.css`
- Create: `tests/manager.spec.ts`
- Create: `tests/settings.spec.ts`
- Create: `tests/package.spec.ts`
- Create: `cordis.patch.yml`
- Modify: `package.json`
- Preserve: `LICENSE`

**Interfaces:**
- Consumes: the verified files under `/Users/yujimaka/.dsh/plugins/skin-switcher`.
- Produces: package `dsh-skin-switch`, Cordis service `skinManager`, loader entry `dsh-skin-switch`, and the unchanged manager types exported from `src/client/index.ts`.

- [ ] **Step 1: Copy only the verified source and test inputs into the isolated repository clone**

```bash
mkdir -p src/client/settings tests
cp /Users/yujimaka/.dsh/plugins/skin-switcher/src/index.ts src/index.ts
cp /Users/yujimaka/.dsh/plugins/skin-switcher/src/client/index.ts src/client/index.ts
cp /Users/yujimaka/.dsh/plugins/skin-switcher/src/client/manager.ts src/client/manager.ts
cp /Users/yujimaka/.dsh/plugins/skin-switcher/src/client/locales.ts src/client/locales.ts
cp /Users/yujimaka/.dsh/plugins/skin-switcher/src/client/settings/SkinSettingsSection.tsx src/client/settings/SkinSettingsSection.tsx
cp /Users/yujimaka/.dsh/plugins/skin-switcher/src/client/settings/SkinSettingsSection.module.css src/client/settings/SkinSettingsSection.module.css
cp /Users/yujimaka/.dsh/plugins/skin-switcher/tests/manager.spec.ts tests/manager.spec.ts
cp /Users/yujimaka/.dsh/plugins/skin-switcher/tests/settings.spec.ts tests/settings.spec.ts
cp /Users/yujimaka/.dsh/plugins/skin-switcher/package.json package.json
cp /Users/yujimaka/.dsh/plugins/skin-switcher/cordis.patch.yml cordis.patch.yml
```

Expected: no maid files, profile files, credentials, or `node_modules` are copied.

- [ ] **Step 2: Add a failing install-manifest contract test**

Create `tests/package.spec.ts`:

```ts
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
```

- [ ] **Step 3: Run the package contract test and observe the old identity failure**

Run:

```bash
pnpm install --no-frozen-lockfile
pnpm test tests/package.spec.ts
```

Expected: FAIL because `package.json.name` is still `@dsh-local/dsh-client-ui-skin-switcher` and the patch still contains the old entry.

- [ ] **Step 4: Rename the package and complete its install manifest**

Set these exact manifest fields while retaining the verified runtime/dev dependency versions:

```json
{
  "name": "dsh-skin-switch",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js",
    "./package.json": "./package.json"
  },
  "files": [
    "lib/index.js",
    "lib/client.js",
    "lib/client.js.map",
    "cordis.patch.yml",
    "README.md",
    "LICENSE"
  ]
}
```

Keep `dsh.client.inject` exactly as asserted by the test. Replace `cordis.patch.yml` with:

```yaml
# Adds the full-skin manager to the Web client roster.
- insert:
    - id: dsh-skin-switch
      name: 'dsh-skin-switch'
```

Replace all manager ModuleLoader/package ID string occurrences with `dsh-skin-switch`; do not rename the `skinManager` service or storage key.

Create `.gitignore`:

```gitignore
node_modules/
.DS_Store
coverage/
*.log
```

- [ ] **Step 5: Run the source and manifest tests**

Run:

```bash
pnpm test
```

Expected: 3 test files pass; manager lifecycle, Settings registration, and package identity contracts are green.

- [ ] **Step 6: Commit the transplant and identity migration**

```bash
git add .gitignore package.json pnpm-lock.yaml cordis.patch.yml src tests
git commit -m "feat: publish the full-skin manager package"
```

---

### Task 2: Replace the machine-local build helper with a repository-owned build

**Files:**
- Create: `tsdown.config.ts`
- Create: `tests/artifact.spec.ts`
- Create/Update: `lib/index.js`
- Create/Update: `lib/client.js`
- Create/Update: `lib/client.js.map`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `src/index.ts`, `src/client/index.ts`, React platform modules, and CSS Modules.
- Produces: `lib/index.js` plus a `window.__ModuleLoader__.load({ id: 'dsh-skin-switch', factory })` browser artifact with inline CSS and repository-relative sourcemaps.

- [ ] **Step 1: Add a failing built-artifact contract test**

Create `tests/artifact.spec.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('prebuilt DSH artifacts', () => {
  it('registers the new package id without machine-local paths', () => {
    const client = readFileSync(resolve(process.cwd(), 'lib/client.js'), 'utf8')
    const map = readFileSync(resolve(process.cwd(), 'lib/client.js.map'), 'utf8')
    expect(client).toContain('window.__ModuleLoader__.load({ id: "dsh-skin-switch"')
    expect(client).not.toContain('@dsh-local/dsh-client-ui-skin-switcher')
    expect(map).not.toContain('/Users/yujimaka')
  })
})
```

- [ ] **Step 2: Copy the current prebuilt artifacts and verify the test fails on the old ID**

```bash
mkdir -p lib
cp /Users/yujimaka/.dsh/plugins/skin-switcher/lib/index.js lib/index.js
cp /Users/yujimaka/.dsh/plugins/skin-switcher/lib/client.js lib/client.js
cp /Users/yujimaka/.dsh/plugins/skin-switcher/lib/client.js.map lib/client.js.map
pnpm test tests/artifact.spec.ts
```

Expected: FAIL because the copied client bundle registers the old scoped package ID.

- [ ] **Step 3: Create the self-contained tsdown configuration**

Create `tsdown.config.ts` with these exact responsibilities and values:

```ts
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
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [nodeConfig, clientConfig]
```

Add `lightningcss` version `^1.32.0` to `devDependencies`; keep `tsdown` at `0.22.14`.

- [ ] **Step 4: Refresh the lockfile and build**

```bash
pnpm install --no-frozen-lockfile
pnpm build
```

Expected: `lib/index.js`, `lib/client.js`, and `lib/client.js.map` are emitted without tsdown `external`/`noExternal` deprecation warnings.

- [ ] **Step 5: Run all tests and reproducibility checks**

```bash
pnpm test
pnpm build
git diff --exit-code -- lib
```

Expected: 4 test files pass; the second build leaves `lib/` byte-for-byte unchanged.

- [ ] **Step 6: Commit the portable build**

```bash
git add tsdown.config.ts package.json pnpm-lock.yaml tests/artifact.spec.ts lib
git commit -m "build: make the DSH client bundle reproducible"
```

---

### Task 3: Add user documentation and continuous verification

**Files:**
- Modify: `README.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: package identity `dsh-skin-switch` and service `skinManager`.
- Produces: private Git URL installation instructions and CI that rejects broken tests or stale committed artifacts.

- [ ] **Step 1: Replace the placeholder README with complete user and developer instructions**

The README must contain these exact facts:

```markdown
# dsh-skin-switch

A full-skin manager for DeepSeek Harness Web. It adds `Settings > Skins`, owns one full skin at a time, persists the selection, and restores the previous skin when activation fails.

> This repository is currently private. Installation requires GitHub access.

## Install

```sh
dsh plugin --profile web add https://github.com/unpain/dsh-skin-switch.git
```

Restart DSH Web, then open `Settings > Skins`.

The manager alone provides only `DSH Default`. Additional cards appear when compatible full-skin packages register through `ctx.skinManager.register()`.
```

Also document the `SkinDefinition` fields (`id`, `name`, `description`, optional `author`, `preview`, `order`, and async `activate` returning a disposer), build/test commands, DSH `0.1.0-rc.6` compatibility, MIT license, and the absence of bundled maid assets.

- [ ] **Step 2: Add the GitHub Actions workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.0
      - uses: actions/setup-node@v4
        with:
          node-version: 24.14.0
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
      - run: git diff --exit-code -- lib
```

- [ ] **Step 3: Check repository disclosure boundaries**

Run:

```bash
git grep -n -E '/Users/yujimaka|\.credentials|session_projcache|maid-atelier|@dsh-local/dsh-client-ui-skin-switcher' -- . ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*'
```

Expected: no matches. The design and plan may name migration sources; runtime repository files may not.

- [ ] **Step 4: Run the same commands CI will run**

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
git diff --exit-code -- lib
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit documentation and CI**

```bash
git add README.md .github/workflows/ci.yml
git commit -m "docs: add private Git installation guide"
```

---

### Task 4: Migrate the current maid and Web profile to `dsh-skin-switch`

**Files:**
- Modify: `/Users/yujimaka/.dsh/plugins/skin-switcher/package.json`
- Modify: `/Users/yujimaka/.dsh/plugins/skin-switcher/cordis.patch.yml`
- Replace: `/Users/yujimaka/.dsh/plugins/skin-switcher/tsdown.config.ts`
- Update: `/Users/yujimaka/.dsh/plugins/skin-switcher/pnpm-lock.yaml`
- Update: `/Users/yujimaka/.dsh/plugins/skin-switcher/lib/*`
- Modify: `/Users/yujimaka/.dsh/_theme-source/maid-atelier/package.json`
- Modify: `/Users/yujimaka/.dsh/_theme-source/maid-atelier/tests/apply.spec.ts`
- Modify: `/Users/yujimaka/.dsh/profiles/web/package.json`
- Update: `/Users/yujimaka/.dsh/profiles/web/pnpm-lock.yaml`

**Interfaces:**
- Consumes: repository package identity `dsh-skin-switch`.
- Produces: maid `dsh.client.inject: ['dsh-skin-switch']` and a Web profile whose bundle/dependency name is `dsh-skin-switch` while its link path remains `/Users/yujimaka/.dsh/plugins/skin-switcher`.

- [ ] **Step 1: Update the maid manifest test first**

Change the expected client declaration in `maid-atelier/tests/apply.spec.ts` to:

```ts
expect(manifest.dsh.client).toEqual({
  inject: ['dsh-skin-switch'],
  platform: 'web',
})
```

Run:

```bash
pnpm test tests/apply.spec.ts
```

Expected: FAIL because the maid manifest still injects the old scoped package name.

- [ ] **Step 2: Apply the clean package-identity migration**

- Sync the verified repository `package.json`, `cordis.patch.yml`, `tsdown.config.ts`, source, tests, and `lib/` back to `/Users/yujimaka/.dsh/plugins/skin-switcher`.
- In maid `package.json`, replace both the `dsh.client.inject` value and optional peer dependency key with `dsh-skin-switch` at version `0.1.0`.
- In profile `package.json`, replace the bundle name and dependency key with `dsh-skin-switch`; retain the link value `link:/Users/yujimaka/.dsh/plugins/skin-switcher`.
- Do not retain the old package key anywhere.

- [ ] **Step 3: Refresh manager and profile dependency graphs**

```bash
pnpm install --no-frozen-lockfile
```

Run once in `/Users/yujimaka/.dsh/plugins/skin-switcher` and once in `/Users/yujimaka/.dsh/profiles/web`.

Expected: manager and profile lockfiles refer to `dsh-skin-switch`; the profile symlink resolves to the existing manager directory.

- [ ] **Step 4: Prove the old name is gone from active runtime inputs**

Run:

```bash
git grep -n '@dsh-local/dsh-client-ui-skin-switcher' -- package.json src tests cordis.patch.yml
```

in the manager repository and maid repository, then search the profile `package.json` and lockfile.

Expected: zero old-name occurrences outside historical design/plan documents.

- [ ] **Step 5: Build and test both packages**

```bash
pnpm build && pnpm test
```

Run in the manager directory and maid directory.

Expected: manager 4 test files pass; maid 81 tests pass; both builds exit 0.

---

### Task 5: Verify the migrated package in a real DSH Web process

**Files:**
- Verify: `/Users/yujimaka/.dsh/profiles/web/package.json`
- Verify: generated DSH boot manifest and browser DOM.

**Interfaces:**
- Consumes: migrated profile, manager, and maid packages.
- Produces: runtime evidence that the renamed graph boots and the Settings/full-skin lifecycle still works.

- [ ] **Step 1: Confirm the composed profile tree**

```bash
dsh --profile web --dump-config
```

Expected: active loader entries named `dsh-skin-switch` and `@dsh-external/dsh-client-ui-skin-maid-atelier`; no disabled manager/maid row and no old package name.

- [ ] **Step 2: Start an isolated DSH Web instance**

Use Node with exposed internals and a free port:

```bash
node --expose-internals /Users/yujimaka/.npm-global/lib/node_modules/@deepseek-ai/dsh/lib/bin.js --profile web --port 3081
```

Expected readiness log: `dsh web: http://127.0.0.1:3081`.

- [ ] **Step 3: Browser-check the boot dependency graph**

Inspect `window.__DSH_BOOT__.entries` and require:

```json
{
  "id": "dsh-skin-switch",
  "inject": [
    "@deepseek-ai/dsh-client-runtime",
    "@deepseek-ai/dsh-client-locale",
    "@deepseek-ai/dsh-client-ui-settings"
  ]
}
```

The maid entry must have `inject: ['dsh-skin-switch']`. The page must not contain `Failed to load plugins` or `[data-dsh-skin-switcher-root]`.

- [ ] **Step 4: Browser-check full-skin lifecycle and persistence**

Open Settings → Skins and execute:

1. Select maid; require `data-dsh-maid-atelier`, title `深海女仆工坊 · DeepSeek Harness`, and persisted ID `maid-atelier`.
2. Select default; require no maid body attribute, zero `[data-skin-owner="maid-atelier"]`, and title `DeepSeek Harness`.
3. Select maid and reload; require maid to reactivate.

Expected: every assertion passes and cards remain enabled after each transition.

- [ ] **Step 5: Stop the isolated process without touching the user's existing 3080 process**

Expected: only the supervised 3081 process is stopped.

---

### Task 6: Push private `main` and verify from a fresh remote clone

**Files:**
- Commit: all repository source, tests, docs, CI, lockfile, and `lib/` changes.
- Verify: private remote `https://github.com/unpain/dsh-skin-switch.git`.

**Interfaces:**
- Consumes: the fully verified local repository clone.
- Produces: a private remote `main` that authenticated users can install by Git URL.

- [ ] **Step 1: Run the final local repository gate**

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
git diff --exit-code -- lib
git status --short
```

Expected: build/test pass; `lib/` clean; only intended uncommitted plan/implementation files remain before the final commit.

- [ ] **Step 2: Commit any final implementation changes**

```bash
git add .
git commit -m "chore: prepare private GitHub distribution"
```

Expected: working tree clean. Do not amend the existing design commits.

- [ ] **Step 3: Push the existing main history without changing visibility**

```bash
git push origin main
```

Expected: push succeeds; no force flag; repository remains private.

- [ ] **Step 4: Exercise the documented DSH Git URL install in an isolated home**

```bash
rm -rf /tmp/dsh-skin-switch-install-home
DSH_HOME=/tmp/dsh-skin-switch-install-home dsh plugin --profile web add https://github.com/unpain/dsh-skin-switch.git
DSH_HOME=/tmp/dsh-skin-switch-install-home dsh --profile web --dump-config
```

Expected: DSH initializes a clean Web profile, pnpm installs the authenticated private Git dependency under its true name `dsh-skin-switch`, profile reconciliation appends that bundle, and config composition succeeds without a local checkout or prepare build.

- [ ] **Step 5: Clone the private remote into a new temporary directory**

```bash
git clone --depth 1 https://github.com/unpain/dsh-skin-switch.git /tmp/dsh-skin-switch-release-check
cd /tmp/dsh-skin-switch-release-check
pnpm install --frozen-lockfile
pnpm build
pnpm test
git diff --exit-code -- lib
```

Expected: authenticated clone, frozen install, build, tests, and artifact reproducibility all pass from remote content alone.

- [ ] **Step 6: Verify the remote head and installation metadata**

```bash
git ls-remote https://github.com/unpain/dsh-skin-switch.git refs/heads/main
node -e "const p=require('./package.json'); if(p.name!=='dsh-skin-switch') process.exit(1); console.log(p.name)"
```

Expected: `refs/heads/main` points to the pushed commit and the fresh clone prints `dsh-skin-switch`.

- [ ] **Step 7: Remove only temporary verification state**

Delete `/tmp/dsh-skin-switch-release-check` and `/tmp/dsh-skin-switch-install-home` after evidence is captured. Keep the main isolated clone and the user's live package directories intact.
