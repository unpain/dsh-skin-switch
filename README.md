English | [简体中文](README.zh-CN.md)

# dsh-skin-switch

A full-skin manager for DeepSeek Harness Web. It adds `Settings > Skins`, owns one full skin at a time, persists the selection, and restores the previous skin when activation fails.

> This repository is private. Installation requires an authorized GitHub account and working Git credentials.

## Requirements

- DeepSeek Harness Web `0.1.0-rc.6`
- Git access to this private repository

If this machine is not authenticated yet, GitHub CLI can configure Git once:

```sh
gh auth login
gh auth setup-git
```

`git ls-remote https://github.com/unpain/dsh-skin-switch.git HEAD` should succeed before installation.

## One-command install

```sh
dsh plugin --profile web add https://github.com/unpain/dsh-skin-switch.git
```

The install command adds both the host and browser bundles. pnpm may report missing DSH or React peer dependencies because the Web profile supplies them through its base bundles; the installation succeeded when the command exits with status 0 and lists `dsh-skin-switch` as added.

Restart DSH Web, then open `Settings > Skins`. A manager-only installation shows `DSH Default`.

## Add skin cards

Compatible full-skin plugins appear automatically when they call `ctx.skinManager.register()`. To add the ten skins from the `dsh-web-ui` collection without the rest of its UI bundle:

```sh
dsh plugin --profile web add @linxin666/dsh-skins
```

Restart DSH Web after installation. Installing `@linxin666/dsh-web-ui-all` also exposes the same collection, together with its other UI plugins.

Collection skins are discovered from their `skin.json` files. Selection delegates to the installed skin-center API, waits until the DSH boot manifest contains the requested skin, and then reloads the page. Switching between a registered skin and a collection skin unloads the current backend first, so their DOM and styles never overlap. The standalone `dsh-skin` executable is not required.

## Register a full skin

A compatible client plugin registers one `SkinDefinition` with the `skinManager` service:

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

// Await this when the registering plugin is disposed.
await unregister()
```

`SkinDefinition` contains:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | `string` | yes | Stable, unique skin identifier. It must be non-empty and must not be `default`. |
| `name` | `string` | yes | Display name shown on the skin card. |
| `description` | `string` | yes | Short user-facing description. |
| `author` | `string` | no | Skin author or publisher. |
| `preview` | `string` | no | Image source assigned to the preview card's `<img>`. |
| `order` | `number` | no | Sort order among registered skin cards; lower values appear first. |
| `activate` | `() => SkinDisposer \| Promise<SkinDisposer>` | yes | Activates the complete skin. It may be async and must return a disposer that removes every change made by that skin. The disposer may also be async. |

`ctx.skinManager.register()` returns an async unregister function. A full-skin package must call it during disposal so the manager can remove the card and clean up the active skin.

## Development

Install the locked dependencies, build the committed client artifacts, and run the test suite:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

The generated files in `lib/` are committed because DSH installs the plugin directly from Git. After building, `git diff --exit-code -- lib` must report no changes.

## Compatibility

This package targets DeepSeek Harness Web `0.1.0-rc.6`. Its DSH client peer dependencies use the matching `0.1.0-rc.6` line.

## Assets and license

This repository does not bundle maid images, styles, fonts, source files, profiles, credentials, or other maid assets. Compatible full-skin packages provide and own their assets independently.

`dsh-skin-switch` is licensed under the MIT License. See `LICENSE`.
