[English](README.md) | 简体中文

# dsh-skin-switch

DeepSeek Harness Web 的完整皮肤管理器。它会在 `设置 > 皮肤` 中加入皮肤列表，同一时间只启用一套完整皮肤，并保存当前选择。切换失败时，管理器会恢复之前使用的皮肤。

## 使用要求

- DeepSeek Harness Web `0.1.0-rc.6`

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

## 相关项目

如有兴趣，可体验作者开发的明日香 / EVA 二号机主题皮肤：[`dsh-skin-asuka`](https://github.com/unpain/dsh-skin-asuka)。

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
