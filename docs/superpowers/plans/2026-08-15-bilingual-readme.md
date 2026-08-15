# Bilingual README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `README.md` as the English landing page and add a complete, installable Simplified Chinese README with reciprocal language links.

**Architecture:** The two README files mirror the same sections and commands. `package.json#files` ships both documents, while `tests/package.spec.ts` defends the language links, shared installation commands, and package payload.

**Tech Stack:** Markdown, JSON, TypeScript, Vitest, pnpm

## Global Constraints

- `README.md` remains the default English document.
- The Chinese document is named `README.zh-CN.md`.
- Commands, package names, paths, API identifiers, and version numbers remain identical between languages.
- Chinese text uses direct, natural technical language.
- Runtime behavior and dependencies do not change.

---

### Task 1: Add and ship the bilingual README pair

**Files:**
- Create: `README.zh-CN.md`
- Modify: `README.md:1`
- Modify: `package.json:15-23`
- Test: `tests/package.spec.ts`

**Interfaces:**
- Consumes: the existing installation commands and `SkinDefinition` API documented in `README.md`
- Produces: reciprocal `README.md` and `README.zh-CN.md` language links; a package payload containing both documents

- [ ] **Step 1: Write the failing package contract test**

Add the two README constants after `clientDeclarationPath`, then add the test below the runtime-artifact test:

```ts
const englishReadme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8')
const chineseReadme = readFileSync(resolve(process.cwd(), 'README.zh-CN.md'), 'utf8')

it('ships linked English and Simplified Chinese documentation', () => {
  expect(manifest.files).toContain('README.md')
  expect(manifest.files).toContain('README.zh-CN.md')
  expect(englishReadme).toContain('English | [简体中文](README.zh-CN.md)')
  expect(chineseReadme).toContain('[English](README.md) | 简体中文')

  const commands = [
    'dsh plugin --profile web add https://github.com/unpain/dsh-skin-switch.git',
    'dsh plugin --profile web add @linxin666/dsh-skins',
  ]
  for (const command of commands) {
    expect(englishReadme).toContain(command)
    expect(chineseReadme).toContain(command)
  }
})
```

Update the exact `manifest.files` expectation to include the Chinese document:

```ts
expect(manifest.files).toEqual([
  'lib/index.js',
  'lib/client.js',
  'lib/client.js.map',
  'lib/client.d.ts',
  'cordis.patch.yml',
  'README.md',
  'README.zh-CN.md',
  'LICENSE',
])
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```sh
pnpm exec vitest run tests/package.spec.ts
```

Expected: FAIL because `README.zh-CN.md` does not exist and is absent from `package.json#files`.

- [ ] **Step 3: Add the English language switch**

Insert these lines before the existing `# dsh-skin-switch` heading in `README.md`:

```md
English | [简体中文](README.zh-CN.md)

```

- [ ] **Step 4: Create the complete Chinese README**

Create `README.zh-CN.md` with this content:

````md
[English](README.md) | 简体中文

# dsh-skin-switch

DeepSeek Harness Web 的完整皮肤管理器。它会在 `设置 > 皮肤` 中加入皮肤列表，同一时间只启用一套完整皮肤，并保存当前选择。切换失败时，管理器会恢复之前使用的皮肤。

> 本仓库为私有仓库。安装前需要确认当前 GitHub 账号有访问权限，并且 Git 凭据已经配置好。

## 使用要求

- DeepSeek Harness Web `0.1.0-rc.6`
- Git 可以访问本私有仓库

如果这台机器尚未登录 GitHub，可以用 GitHub CLI 配置：

```sh
gh auth login
gh auth setup-git
```

安装前，`git ls-remote https://github.com/unpain/dsh-skin-switch.git HEAD` 应当能正常返回提交信息。

## 一条命令安装

```sh
dsh plugin --profile web add https://github.com/unpain/dsh-skin-switch.git
```

这条命令会同时安装 host 端和浏览器端模块。pnpm 可能提示缺少 DSH 或 React peer dependency，这是因为 Web profile 通过基础 bundle 提供这些依赖。只要命令以状态码 0 退出，并显示已添加 `dsh-skin-switch`，安装就已经成功。

重启 DSH Web，然后打开 `设置 > 皮肤`。只安装管理器时，列表中会显示 `DSH Default`。

## 添加皮肤卡片

兼容的完整皮肤插件调用 `ctx.skinManager.register()` 后，会自动出现在列表中。如果只想安装 `dsh-web-ui` 集合中的 10 套皮肤，不需要其余 UI 插件，可以运行：

```sh
dsh plugin --profile web add @linxin666/dsh-skins
```

安装后重启 DSH Web。安装 `@linxin666/dsh-web-ui-all` 也会提供同一套皮肤集合，但它还会安装该项目的其他 UI 插件。

管理器从各皮肤的 `skin.json` 读取元数据。选择集合皮肤时，它会调用已安装的 skin-center API，等待 DSH 启动清单出现目标皮肤，然后重新加载页面。在注册型皮肤和集合皮肤之间切换时，管理器会先卸载当前皮肤，避免两套 DOM 和样式同时存在。不需要单独安装 `dsh-skin` 命令。

## 注册完整皮肤

兼容的浏览器端插件需要向 `skinManager` 服务注册一个 `SkinDefinition`：

```ts
const unregister = ctx.skinManager.register({
  id: 'example-dark',
  name: 'Example Dark',
  description: 'A complete dark interface for DSH Web.',
  author: 'Example Team',
  preview: 'https://example.com/example-dark.png',
  order: 100,
  activate: async () => {
    document.documentElement.dataset.skin = 'example-dark'

    return async () => {
      delete document.documentElement.dataset.skin
    }
  },
})

// 注册该皮肤的插件卸载时，需要等待注销完成。
await unregister()
```

`SkinDefinition` 字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | 稳定且唯一的皮肤标识。不能为空，也不能使用 `default`。 |
| `name` | `string` | 是 | 皮肤卡片上显示的名称。 |
| `description` | `string` | 是 | 面向用户的简短说明。 |
| `author` | `string` | 否 | 皮肤作者或发布者。 |
| `preview` | `string` | 否 | 预览卡片 `<img>` 使用的图片地址。 |
| `order` | `number` | 否 | 注册型皮肤的排序值，数值越小越靠前。 |
| `activate` | `() => SkinDisposer \| Promise<SkinDisposer>` | 是 | 启用完整皮肤。可以是异步函数，但必须返回清理函数；清理函数负责撤销该皮肤写入的全部内容，也可以是异步函数。 |

`ctx.skinManager.register()` 返回一个异步注销函数。完整皮肤插件卸载时必须调用它，以便管理器移除卡片；如果该皮肤正在使用，管理器也会执行清理。

## 开发

安装锁定版本的依赖，生成需要提交的浏览器端文件，然后运行测试：

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

DSH 会直接从 Git 安装本插件，因此 `lib/` 中的生成文件需要提交。构建完成后，`git diff --exit-code -- lib` 应当没有输出。

## 兼容性

本插件面向 DeepSeek Harness Web `0.1.0-rc.6`，DSH 浏览器端 peer dependency 使用对应的 `0.1.0-rc.6` 版本线。

## 资源与许可证

本仓库不包含女仆皮肤的图片、样式、字体、源码、profile、凭据或其他资源。兼容的完整皮肤插件自行提供并管理这些内容。

`dsh-skin-switch` 使用 MIT License，详见 `LICENSE`。
````

- [ ] **Step 5: Include the Chinese README in the package payload**

Add `README.zh-CN.md` immediately after `README.md` in `package.json#files`:

```json
"README.md",
"README.zh-CN.md",
"LICENSE"
```

- [ ] **Step 6: Run the focused contract test**

Run:

```sh
pnpm exec vitest run tests/package.spec.ts
```

Expected: `tests/package.spec.ts` passes.

- [ ] **Step 7: Run the complete test suite**

Run:

```sh
pnpm test
```

Expected: all test files and tests pass, including type checking.

- [ ] **Step 8: Review Chinese copy and repository status**

Check that the Chinese README uses the same commands, version, section order, and API identifiers as the English README. Then run:

```sh
git status --short
```

Expected changed paths:

```text
 M README.md
 M package.json
 M tests/package.spec.ts
?? README.zh-CN.md
?? docs/superpowers/plans/2026-08-15-bilingual-readme.md
```

- [ ] **Step 9: Commit the implementation**

```sh
git add README.md README.zh-CN.md package.json tests/package.spec.ts docs/superpowers/plans/2026-08-15-bilingual-readme.md
git commit -m "docs: add Simplified Chinese README"
```

- [ ] **Step 10: Push and verify remote main**

```sh
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: the local and remote hashes are identical.
