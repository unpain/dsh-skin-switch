import { Context } from "@deepseek-ai/cordis";
//#region src/client/locales.d.ts
declare const zh: {
  readonly nav: "皮肤";
  readonly title: "界面皮肤";
  readonly description: "完整皮肤会改变背景、装饰和界面样式；明暗模式仍在通用设置中控制。";
  readonly defaultName: "DSH 默认";
  readonly defaultDescription: "恢复 DeepSeek Harness 原生界面。";
  readonly author: "作者：{name}";
  readonly selected: "当前皮肤";
  readonly switching: "正在切换皮肤…";
  readonly error: "切换失败：{message}";
};
type SkinSettingsKey = keyof typeof zh;
//#endregion
//#region src/client/manager.d.ts
declare const DEFAULT_SKIN_ID = "default";
declare const SKIN_STORAGE_KEY = "dsh-skin-manager:selected";
type SkinDisposer = () => void | Promise<void>;
type SkinActivator = () => SkinDisposer | Promise<SkinDisposer>;
type SkinStatus = "idle" | "switching" | "error";
interface SkinMetadata {
  id: string;
  name: string;
  description: string;
  author?: string;
  preview?: string;
  order?: number;
}
interface SkinDefinition extends SkinMetadata {
  activate: SkinActivator;
}
interface SkinSelectionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
interface SkinSnapshot {
  selectedId: string;
  status: SkinStatus;
  error?: string;
  revision: number;
  skins: readonly SkinMetadata[];
}
/** Owns one full-skin activation at a time and publishes immutable UI snapshots. */
declare class SkinManager {
  private readonly storage;
  private readonly definitions;
  private readonly listeners;
  private readonly desiredId;
  private active?;
  private pending;
  private snapshot;
  constructor(storage: SkinSelectionStorage);
  /** Registers one package-owned skin and restores it when it was persisted. */
  register(definition: SkinDefinition): () => Promise<void>;
  /** Serializes selection so two rapid clicks cannot overlap activation fibers. */
  select(id: string): Promise<void>;
  /** Exposes the transition queue for deterministic startup and tests. */
  whenIdle(): Promise<void>;
  /** React's external-store contract requires a stable snapshot reference. */
  getSnapshot: () => SkinSnapshot;
  /** Listener identity must survive React's subscribe/unsubscribe cycle. */
  subscribe: (listener: () => void) => (() => void);
  private validateDefinition;
  private enqueue;
  private enqueueRestore;
  private enqueueUnregister;
  private transition;
  private resolveTarget;
  private disposeActive;
  private activateWithRollback;
  private activate;
  private restore;
  private commitSelection;
  private unregister;
  private publishRegistry;
  private publish;
}
//#endregion
//#region src/client/index.d.ts
declare module "@deepseek-ai/cordis" {
  interface Context {
    skinManager: SkinManager;
  }
}
declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "settings.skins": SkinSettingsKey;
  }
}
/** Provides the registry before managed skin packages can leave DI pending. */
declare function apply(ctx: Context): void;
declare const inject: string[];
//#endregion
export { DEFAULT_SKIN_ID, SKIN_STORAGE_KEY, type SkinActivator, type SkinDefinition, type SkinDisposer, SkinManager, type SkinMetadata, type SkinSelectionStorage, type SkinSnapshot, type SkinStatus, apply, inject };