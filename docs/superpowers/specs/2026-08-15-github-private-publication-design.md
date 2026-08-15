# dsh-skin-switch 私有 GitHub 发布设计

## 目标

将本机 `~/.dsh/plugins/skin-switcher` 中已验证的完整皮肤管理器整理到现有 GitHub 仓库 `unpain/dsh-skin-switch`。仓库在本阶段保持 private；流程跑通后再单独决定是否公开。

完成后，拥有仓库访问权限的用户可以直接执行：

```sh
dsh plugin --profile web add https://github.com/unpain/dsh-skin-switch.git
```

仓库提交预构建客户端产物，因此安装者不需要本地构建。管理器本身只提供“DSH 默认”皮肤；其他完整皮肤通过 `skinManager.register()` 注册。

## 范围

### 包含

- 皮肤管理器源码、设置页、本地化字典和样式。
- 管理器生命周期、失败回滚和设置注册测试。
- DSH bundle patch 与 package manifest。
- 可复现的仓库内构建配置。
- 预构建 `lib/` 产物。
- GitHub Actions 构建与测试检查。
- 安装、使用、开发和完整皮肤接入说明。
- 本机 maid-atelier 与 Web profile 对新包名的同步迁移。

### 不包含

- maid-atelier 源码、图片、预构建产物、LICENSE 或 NOTICE。
- 用户 `.dsh` profile、会话、凭据或模型配置。
- npm 发布和 GitHub Release。
- GitHub 仓库公开操作。
- 旧包名兼容层。

## 仓库策略

远端仓库当前只有 `Initial commit`、MIT `LICENSE` 和占位 README。实施使用现有 `main` 历史作为基础，在其上加入完整项目内容；不 force-push，不创建无关历史。

目标结构：

```text
.github/workflows/ci.yml
.gitignore
LICENSE
README.md
package.json
pnpm-lock.yaml
tsdown.config.ts
cordis.patch.yml
src/
tests/
lib/
docs/superpowers/specs/
```

MIT `LICENSE` 保持不变。仓库只包含管理器代码，因此不会混入 maid-atelier 的 CC BY-NC-SA 许可边界。

## 包身份与迁移

包身份统一改为：

```text
dsh-skin-switch
```

需要原子更新的引用：

- 仓库 `package.json.name`。
- `cordis.patch.yml` 的 loader entry `id` 与 `name`。
- 客户端 ModuleLoader 注册 ID。
- README 安装和接入示例。
- 本机 maid-atelier 的 `dsh.client.inject` 与 peer dependency。
- 本机 Web profile 的 dependency key 和 bundle 名称。

不保留 `@dsh-local/dsh-client-ui-skin-switcher` alias。迁移后检查全部调用点，旧名称必须为零。

## 可移植构建

当前本机构建入口引用 `../../_theme-source/maid-atelier/build/tsdown.client.ts`，不能发布。仓库改为最小、自包含的 `tsdown.config.ts`：

1. Node half 将 `src/index.ts` 输出为 `lib/index.js`，保持 Cordis 为 external。
2. Browser half 将 `src/client/index.ts` 输出为 DSH `window.__ModuleLoader__.load()` CJS closure，注册 ID 为 `dsh-skin-switch`。
3. React 和 DSH shell 共享模块保持 external，避免重复运行时实例。
4. CSS Modules 使用仓库内 lightningcss 插件内联，并注入带 package owner 标记的 style tag。
5. Source map 使用仓库相对路径，不包含 `/Users/yujimaka` 或其他本机绝对路径。

`lightningcss` 作为明确 dev dependency。`lib/` 进入 Git，供 Git URL 安装直接使用。

## 运行时结构

- Host entry 仍为空操作，仅提供标准 DSH bundle 形状。
- Client entry 提供 `skinManager` Cordis 服务，并在 `settings.section` 注册 `Skins` 分区。
- 完整皮肤包通过 manager service 注册 metadata 和异步 activator。
- 管理器序列化切换；成功后持久化选择；未知 ID 回退默认。
- disposer、目标激活或旧皮肤恢复失败时必须发布 settled error snapshot，不能停留在 switching。
- 插件卸载时撤销设置注册、服务和活动完整皮肤。

## 用户文档

README 覆盖：

1. 功能与截图级文字说明。
2. DSH rc.6 前置条件。
3. Git URL 安装命令与重启步骤。
4. `Settings > Skins` 使用入口。
5. “仅安装管理器时只有 DSH 默认”的明确说明。
6. 开发者 `skinManager.register()` 接入契约。
7. `pnpm install`、`pnpm build`、`pnpm test` 开发命令。
8. 当前仓库为 private 时，安装者需要 GitHub 访问权限。

README 不包含本机绝对路径。

## CI

GitHub Actions 在 push 和 pull request 上执行：

1. Node 与 pnpm 固定版本安装。
2. `pnpm install --frozen-lockfile`。
3. `pnpm build`。
4. `pnpm test`。
5. 检查 `lib/` 在构建后没有未提交差异。

任何测试失败或预构建产物过期都会使 CI 失败。

## 本机迁移

发布仓库整理完成后，同步更新当前可运行环境：

- maid-atelier 注入依赖改为 `dsh-skin-switch`。
- Web profile dependency 和 bundle 名改为 `dsh-skin-switch`，link 路径可继续指向当前本地插件目录。
- 重新安装或刷新 profile lockfile，使包身份与 symlink 一致。
- 重新构建 manager 与 maid 客户端产物。

迁移必须是 clean cutover；不存在同时加载新旧 manager 的状态。

## 验证

### 静态与仓库检查

- 搜索旧包名，结果为零。
- 搜索 `/Users/yujimaka`、`.credentials`、session 和 maid 素材引用，结果为零。
- Git 只包含预期源码、测试、文档、构建配置和 `lib/`。
- 从新的 private remote clone 执行 frozen install、build、test 成功。

### 自动化测试

- 管理器和 settings 测试全部通过。
- disposer rejection、rollback rejection、unregister rejection 和 unknown ID fallback 均保持覆盖。

### 实际 DSH 冒烟

使用更新后的本机 profile 启动新的 DSH Web 实例，验证：

- boot manifest 中 `dsh-skin-switch` 依赖 runtime、locale 和 settings。
- maid-atelier 依赖 `dsh-skin-switch`。
- `Settings > Skins` 显示默认与 maid 卡片。
- default → maid → default 双向切换完整清理 DOM/CSS。
- 刷新恢复已选择皮肤。
- 页面不存在旧浮动按钮，也不存在 Failed to load plugins。

## 提交与推送

- 在现有 private 仓库 `main` 上提交设计文档和实现提交。
- 推送前运行完整验证。
- 推送后通过新的临时 clone 再验证一次安装、构建和测试。
- 确认远端 `main` 指向已验证提交。
- 本阶段不修改 repository visibility，不创建 tag、Release 或 npm publication。
