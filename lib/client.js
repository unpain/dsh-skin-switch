window.__ModuleLoader__.load({ id: "dsh-skin-switch", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
//#region src/client/manager.ts
const DEFAULT_SKIN_ID = "default";
const SKIN_STORAGE_KEY = "dsh-skin-manager:selected";
const DEFAULT_SKIN = {
	id: DEFAULT_SKIN_ID,
	name: "DSH 默认",
	description: "恢复 DeepSeek Harness 原生界面。",
	order: -1
};
/** Owns one full-skin activation at a time and publishes immutable UI snapshots. */
var SkinManager = class {
	storage;
	definitions = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Set();
	desiredId;
	active;
	pending = Promise.resolve();
	snapshot;
	constructor(storage) {
		this.storage = storage;
		this.desiredId = { current: storage.getItem("dsh-skin-manager:selected") ?? "default" };
		this.snapshot = {
			selectedId: DEFAULT_SKIN_ID,
			status: "idle",
			revision: 0,
			skins: [DEFAULT_SKIN]
		};
	}
	/** Registers one package-owned skin and restores it when it was persisted. */
	register(definition) {
		this.validateDefinition(definition);
		this.definitions.set(definition.id, definition);
		this.publishRegistry();
		if (this.desiredId.current === definition.id) this.enqueueRestore(definition).catch(() => void 0);
		return () => this.enqueueUnregister(definition);
	}
	/** Serializes selection so two rapid clicks cannot overlap activation fibers. */
	select(id) {
		return this.enqueue(id, true);
	}
	/** Exposes the transition queue for deterministic startup and tests. */
	whenIdle() {
		return this.pending;
	}
	/** React's external-store contract requires a stable snapshot reference. */
	getSnapshot = () => this.snapshot;
	/** Listener identity must survive React's subscribe/unsubscribe cycle. */
	subscribe = (listener) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};
	validateDefinition(definition) {
		if (definition.id.length === 0 || definition.id === "default") throw new Error(`invalid full-skin id "${definition.id}"`);
		if (this.definitions.has(definition.id)) throw new Error(`full skin "${definition.id}" is already registered`);
	}
	enqueue(id, persist) {
		const request = this.pending.then(() => this.transition(id, persist));
		this.pending = request.catch(() => void 0);
		return request;
	}
	enqueueRestore(definition) {
		const request = this.pending.then(() => {
			if (this.desiredId.current !== definition.id || this.definitions.get(definition.id) !== definition) return;
			return this.transition(definition.id, false);
		});
		this.pending = request.catch(() => void 0);
		return request;
	}
	enqueueUnregister(definition) {
		const request = this.pending.then(() => this.unregister(definition));
		this.pending = request.catch(() => void 0);
		return request;
	}
	async transition(id, persist) {
		const target = this.resolveTarget(id);
		const unknown = id !== "default" && target === void 0;
		const resolvedId = target?.id ?? "default";
		if (this.snapshot.selectedId === resolvedId) {
			this.commitSelection(resolvedId, persist);
			if (unknown) this.publish({
				status: "error",
				error: `unknown full skin "${id}"; restored default`
			});
			return;
		}
		const previous = this.active?.definition;
		this.publish({
			status: "switching",
			error: void 0
		});
		try {
			await this.disposeActive();
		} catch (cause) {
			const error = cause instanceof Error ? cause : new Error(String(cause));
			this.publish({
				status: "error",
				error: error.message
			});
			throw error;
		}
		await this.activateWithRollback(target, previous, persist);
		if (unknown) this.publish({
			status: "error",
			error: `unknown full skin "${id}"; restored default`
		});
	}
	resolveTarget(id) {
		if (id === "default") return void 0;
		return this.definitions.get(id);
	}
	async disposeActive() {
		const active = this.active;
		if (active === void 0) return;
		await active.dispose();
		if (this.active === active) this.active = void 0;
	}
	async activateWithRollback(target, previous, persist) {
		try {
			await this.activate(target);
		} catch (cause) {
			const activationError = cause instanceof Error ? cause : new Error(String(cause));
			try {
				await this.restore(previous);
			} catch (restoreCause) {
				const restoreError = restoreCause instanceof Error ? restoreCause : new Error(String(restoreCause));
				const message = `${activationError.message}; failed to restore "${previous?.id ?? "default"}": ${restoreError.message}`;
				this.active = void 0;
				this.publish({
					selectedId: DEFAULT_SKIN_ID,
					status: "error",
					error: message
				});
				throw new AggregateError([activationError, restoreError], message);
			}
			this.publish({
				status: "error",
				error: activationError.message
			});
			throw activationError;
		}
		this.commitSelection(target?.id ?? "default", persist);
	}
	async activate(definition) {
		if (definition === void 0) return;
		const dispose = await definition.activate();
		if (typeof dispose !== "function") throw new TypeError(`full skin "${definition.id}" returned no disposer`);
		this.active = {
			definition,
			dispose
		};
	}
	async restore(definition) {
		if (definition === void 0 || !this.definitions.has(definition.id)) return;
		await this.activate(definition);
	}
	commitSelection(id, persist) {
		this.desiredId.current = id;
		let persistenceError;
		if (persist) try {
			this.storage.setItem(SKIN_STORAGE_KEY, id);
		} catch (cause) {
			persistenceError = cause instanceof Error ? cause : new Error(String(cause));
		}
		this.publish({
			selectedId: id,
			status: persistenceError === void 0 ? "idle" : "error",
			error: persistenceError?.message
		});
		if (persistenceError !== void 0) throw persistenceError;
	}
	async unregister(definition) {
		if (this.definitions.get(definition.id) !== definition) return;
		this.definitions.delete(definition.id);
		let cleanupError;
		if (this.active?.definition === definition) {
			try {
				await this.disposeActive();
			} catch (cause) {
				cleanupError = cause instanceof Error ? cause : new Error(String(cause));
				this.active = void 0;
			}
			this.publish({
				selectedId: DEFAULT_SKIN_ID,
				status: cleanupError === void 0 ? "idle" : "error",
				error: cleanupError?.message
			});
		}
		this.publishRegistry();
		if (cleanupError !== void 0) throw cleanupError;
	}
	publishRegistry() {
		const skins = [...this.definitions.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)).map(({ activate: _activate, ...metadata }) => metadata);
		this.publish({ skins: [DEFAULT_SKIN, ...skins] });
	}
	publish(change) {
		this.snapshot = {
			...this.snapshot,
			...change,
			revision: this.snapshot.revision + 1
		};
		for (const listener of this.listeners) listener();
	}
};
//#endregion
//#region src/client/collections/dsh-web-ui.ts
var DshWebUiSwitchCommittedError = class extends Error {
	target;
	committed = true;
	constructor(target, cause) {
		const detail = cause instanceof Error ? cause.message : String(cause);
		super(`skin switch to "${target ?? "official"}" was accepted but not observed: ${detail}`, { cause });
		this.target = target;
		this.name = "DshWebUiSwitchCommittedError";
	}
};
const SELECTION_PREFIX = "dsh-web-ui:";
const PACKAGE_PREFIX = "@linxin666/dsh-client-ui-skin-";
const SKIN_CENTER_PACKAGE = `${PACKAGE_PREFIX}center`;
function dshWebUiSelectionId(id) {
	return `${SELECTION_PREFIX}${id}`;
}
function collectionSkinId(selectionId) {
	return selectionId.startsWith(SELECTION_PREFIX) ? selectionId.slice(11) : null;
}
function activeDshWebUiSkinId(entries) {
	return entries.find((entry) => entry.id.startsWith(PACKAGE_PREFIX) && entry.id !== SKIN_CENTER_PACKAGE)?.id.slice(30) ?? null;
}
function toSkinMetadata(skin) {
	return {
		id: dshWebUiSelectionId(skin.id),
		name: skin.name,
		description: skin.description,
		author: skin.author,
		order: skin.order
	};
}
/** Coordinates page-local skins with boot-graph skins without ever mounting both. */
var DshWebUiCollectionAdapter = class {
	manager;
	storage;
	gateway;
	listeners = /* @__PURE__ */ new Set();
	externalSkins = [];
	activeId;
	status;
	error;
	revision = 0;
	snapshot;
	pending = Promise.resolve();
	constructor(manager, storage, gateway, activeId) {
		this.manager = manager;
		this.storage = storage;
		this.gateway = gateway;
		this.activeId = activeId;
		this.snapshot = this.composeSnapshot();
		manager.subscribe(() => this.publish());
	}
	async initialize() {
		try {
			this.externalSkins = (await this.gateway.list()).map(toSkinMetadata);
			this.status = void 0;
			this.error = void 0;
			this.publish();
		} catch (cause) {
			this.fail(cause);
			throw cause;
		}
	}
	getSnapshot = () => this.snapshot;
	subscribe = (listener) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};
	register(definition) {
		return this.manager.register(definition);
	}
	whenIdle() {
		return this.pending.then(() => this.manager.whenIdle());
	}
	select(id) {
		const request = this.pending.then(() => this.transition(id));
		this.pending = request.catch(() => void 0);
		return request;
	}
	async transition(id) {
		const externalId = collectionSkinId(id);
		if (externalId !== null) return this.selectExternal(externalId);
		if (this.activeId !== null) return this.selectLocalAfterUnload(id);
		return this.manager.select(id);
	}
	async selectExternal(id) {
		if (this.activeId === id) return;
		if (this.activeId === null) await this.manager.whenIdle();
		const previousLocalId = this.manager.getSnapshot().selectedId;
		this.beginSwitch();
		try {
			if (this.activeId === null) await this.manager.select(DEFAULT_SKIN_ID);
			await this.gateway.apply(id);
			this.activeId = id;
			this.finishSwitch();
			this.gateway.reload();
		} catch (cause) {
			if (cause instanceof DshWebUiSwitchCommittedError) {
				this.activeId = id;
				this.fail(cause);
				this.gateway.reload();
				throw cause;
			}
			if (this.activeId === null && previousLocalId !== "default") await this.manager.select(previousLocalId);
			this.fail(cause);
			throw cause;
		}
	}
	async selectLocalAfterUnload(id) {
		const target = this.localTarget(id);
		const previous = this.storage.getItem("dsh-skin-manager:selected") ?? "default";
		this.storage.setItem(SKIN_STORAGE_KEY, target);
		this.beginSwitch();
		try {
			await this.gateway.apply(null);
			this.activeId = null;
			this.finishSwitch();
			this.gateway.reload();
		} catch (cause) {
			if (cause instanceof DshWebUiSwitchCommittedError) {
				this.activeId = null;
				this.fail(cause);
				this.gateway.reload();
				throw cause;
			}
			this.storage.setItem(SKIN_STORAGE_KEY, previous);
			this.fail(cause);
			throw cause;
		}
	}
	localTarget(id) {
		return this.manager.getSnapshot().skins.some((skin) => skin.id === id) ? id : DEFAULT_SKIN_ID;
	}
	beginSwitch() {
		this.status = "switching";
		this.error = void 0;
		this.publish();
	}
	finishSwitch() {
		this.status = void 0;
		this.error = void 0;
		this.publish();
	}
	fail(cause) {
		const error = cause instanceof Error ? cause : new Error(String(cause));
		this.status = "error";
		this.error = error.message;
		this.publish();
	}
	composeSnapshot() {
		const local = this.manager.getSnapshot();
		return {
			...local,
			selectedId: this.activeId === null ? local.selectedId : dshWebUiSelectionId(this.activeId),
			status: this.status ?? local.status,
			error: this.error ?? local.error,
			revision: local.revision + this.revision,
			skins: [...local.skins, ...this.externalSkins]
		};
	}
	publish() {
		this.revision += 1;
		this.snapshot = this.composeSnapshot();
		for (const listener of this.listeners) listener();
	}
};
//#endregion
//#region src/client/collections/dsh-web-ui-gateway.ts
const COLLECTION_ROUTE = "/api/dsh-skin-switch/collections/dsh-web-ui";
const APPLY_ROUTE = "/api/skin-center/apply";
const ACTIVE_SKIN_BUNDLE = /\/plugins\/@linxin666\/dsh-client-ui-skin-(?!center\/)[a-z0-9-]+\/client\.js/;
function manifestHasDshWebUiSkin(html, target) {
	if (target === null) return !ACTIVE_SKIN_BUNDLE.test(html);
	return html.includes(`/plugins/@linxin666/dsh-client-ui-skin-${target}/client.js`);
}
async function responseError(response) {
	try {
		const body = await response.json();
		if (typeof body.error === "string") return new Error(body.error);
	} catch {}
	return /* @__PURE__ */ new Error(`skin collection request failed (${response.status})`);
}
/** Calls the installed skin-center API and waits for its config watcher to publish. */
var DshWebUiHttpGateway = class {
	options;
	checks;
	constructor(options) {
		this.options = options;
		this.checks = options.manifestChecks ?? 80;
	}
	async list() {
		const response = await this.options.fetcher(COLLECTION_ROUTE, { cache: "no-store" });
		if (!response.ok) throw await responseError(response);
		const body = await response.json();
		if (!Array.isArray(body.skins)) throw new Error("invalid dsh-web-ui collection response");
		return body.skins;
	}
	async apply(id) {
		const body = id === null ? { official: true } : { skin: id };
		const response = await this.options.fetcher(APPLY_ROUTE, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body)
		});
		if (!response.ok) throw await responseError(response);
		try {
			await this.waitForManifest(id);
		} catch (cause) {
			throw new DshWebUiSwitchCommittedError(id, cause);
		}
	}
	reload() {
		this.options.location.reload();
	}
	async waitForManifest(target) {
		for (let attempt = 0; attempt < this.checks; attempt += 1) {
			const response = await this.options.fetcher(this.options.location.href, { cache: "no-store" });
			if (response.ok && manifestHasDshWebUiSkin(await response.text(), target)) return;
			if (attempt + 1 < this.checks) await this.options.sleep(100);
		}
		throw new Error(`timed out waiting for skin "${target ?? "official"}"`);
	}
};
//#endregion
//#region src/client/locales.ts
const SKIN_SETTINGS_NS = "settings.skins";
const zh = {
	nav: "皮肤",
	title: "界面皮肤",
	description: "完整皮肤会改变背景、装饰和界面样式；明暗模式仍在通用设置中控制。",
	defaultName: "DSH 默认",
	defaultDescription: "恢复 DeepSeek Harness 原生界面。",
	author: "作者：{name}",
	selected: "当前皮肤",
	switching: "正在切换皮肤…",
	error: "切换失败：{message}"
};
const en = {
	nav: "Skins",
	title: "Interface skin",
	description: "Full skins change backgrounds, ornaments, and interface styling. Light and dark mode remain under General.",
	defaultName: "DSH Default",
	defaultDescription: "Restore the native DeepSeek Harness interface.",
	author: "Author: {name}",
	selected: "Current skin",
	switching: "Switching skin…",
	error: "Switch failed: {message}"
};
//#endregion
//#region \0dsh-css:src/client/settings/SkinSettingsSection.module.css.mjs
const css$1 = ".LCzX1a_section{flex-direction:column;gap:20px;width:100%;display:flex}.LCzX1a_header{flex-direction:column;gap:4px;display:flex}.LCzX1a_title{color:var(--dsw-alias-label-primary);margin:0;font-size:18px;font-weight:600;line-height:26px}.LCzX1a_description{max-width:680px;color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:20px}.LCzX1a_grid{grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:12px;display:grid}.LCzX1a_card{min-width:0;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;flex-direction:column;padding:0;transition:border-color .14s,background-color .14s,box-shadow .14s;display:flex;overflow:hidden}.LCzX1a_card:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.LCzX1a_card:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.LCzX1a_card:disabled{cursor:wait;opacity:.68}.LCzX1a_card[data-selected=true]{border-color:var(--dsw-alias-brand-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}.LCzX1a_preview{aspect-ratio:16/9;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1);width:100%;position:relative;overflow:hidden}.LCzX1a_previewImage{object-fit:cover;width:100%;height:100%;display:block}.LCzX1a_defaultPreview{background:var(--dsw-alias-bg-base);grid-template-rows:1fr 28%;grid-template-columns:30% 1fr;gap:8px;height:100%;padding:16px;display:grid}.LCzX1a_defaultPreview span{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;display:block}.LCzX1a_defaultPreview span:first-child{grid-row:1/3}.LCzX1a_cardBody{flex-direction:column;gap:6px;min-height:112px;padding:14px;display:flex}.LCzX1a_cardHeading{justify-content:space-between;align-items:center;gap:12px;display:flex}.LCzX1a_cardName{font-size:14px;font-weight:600;line-height:22px}.LCzX1a_selectedIcon{width:18px;height:18px;color:var(--dsw-alias-brand-primary);flex:none}.LCzX1a_cardDescription,.LCzX1a_author,.LCzX1a_status,.LCzX1a_error{font-size:12px;line-height:18px}.LCzX1a_cardDescription,.LCzX1a_author{color:var(--dsw-alias-label-tertiary)}.LCzX1a_author{margin-top:auto}.LCzX1a_status{color:var(--dsw-alias-brand-primary);font-weight:600}.LCzX1a_error{color:var(--dsw-alias-state-error-primary,#c2413b);margin:0}";
const tagId$1 = "dsh-skin-switch/SkinSettingsSection.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = "dsh-skin-switch";
	tag.dataset.pluginCss = tagId$1;
	tag.textContent = css$1;
	document.head.appendChild(tag);
}
var SkinSettingsSection_module_css_default = {
	"author": "LCzX1a_author",
	"card": "LCzX1a_card",
	"cardBody": "LCzX1a_cardBody",
	"cardDescription": "LCzX1a_cardDescription",
	"cardHeading": "LCzX1a_cardHeading",
	"cardName": "LCzX1a_cardName",
	"defaultPreview": "LCzX1a_defaultPreview",
	"description": "LCzX1a_description",
	"error": "LCzX1a_error",
	"grid": "LCzX1a_grid",
	"header": "LCzX1a_header",
	"preview": "LCzX1a_preview",
	"previewImage": "LCzX1a_previewImage",
	"section": "LCzX1a_section",
	"selectedIcon": "LCzX1a_selectedIcon",
	"status": "LCzX1a_status",
	"title": "LCzX1a_title"
};
//#endregion
//#region src/client/settings/SkinSettingsSection.tsx
/** Keeps the selected marker semantic without depending on an icon package. */
function SelectedIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
		className: SkinSettingsSection_module_css_default.selectedIcon,
		viewBox: "0 0 20 20",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
			cx: "10",
			cy: "10",
			r: "8",
			fill: "currentColor"
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
			d: "m6.4 10.1 2.1 2.1 5-5",
			fill: "none",
			stroke: "white",
			strokeWidth: "1.8",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})]
	});
}
/** Uses package-provided art when available and a neutral DSH frame otherwise. */
function SkinPreview({ skin }) {
	if (skin.preview !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
		className: SkinSettingsSection_module_css_default.previewImage,
		src: skin.preview,
		alt: ""
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: SkinSettingsSection_module_css_default.defaultPreview,
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
		]
	});
}
function SkinCardBody({ selected, skin, t }) {
	const isDefault = skin.id === DEFAULT_SKIN_ID;
	const name = isDefault ? t("defaultName") : skin.name;
	const description = isDefault ? t("defaultDescription") : skin.description;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: SkinSettingsSection_module_css_default.cardBody,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SkinSettingsSection_module_css_default.cardHeading,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: SkinSettingsSection_module_css_default.cardName,
					children: name
				}), selected && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectedIcon, {})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: SkinSettingsSection_module_css_default.cardDescription,
				children: description
			}),
			skin.author !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: SkinSettingsSection_module_css_default.author,
				children: t("author", { name: skin.author })
			}),
			selected && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: SkinSettingsSection_module_css_default.status,
				children: t("selected")
			})
		]
	});
}
/** A button owns the whole card so mouse, keyboard, and pressed state stay aligned. */
function SkinCard({ disabled, onSelect, selected, skin, t }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
		type: "button",
		className: SkinSettingsSection_module_css_default.card,
		"data-selected": selected,
		"aria-pressed": selected,
		disabled,
		onClick: onSelect,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: SkinSettingsSection_module_css_default.preview,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkinPreview, { skin })
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkinCardBody, {
			selected,
			skin,
			t
		})]
	});
}
/** Renders the registry snapshot; all writes stay on the manager's serialized path. */
function SkinSettingsSection({ manager, t }) {
	const snapshot = (0, react.useSyncExternalStore)(manager.subscribe, manager.getSnapshot);
	const switching = snapshot.status === "switching";
	const select = (id) => {
		manager.select(id).catch(() => void 0);
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: SkinSettingsSection_module_css_default.section,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
				className: SkinSettingsSection_module_css_default.header,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					className: SkinSettingsSection_module_css_default.title,
					children: t("title")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: SkinSettingsSection_module_css_default.description,
					children: t("description")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: SkinSettingsSection_module_css_default.grid,
				children: snapshot.skins.map((skin) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkinCard, {
					skin,
					t,
					selected: snapshot.selectedId === skin.id,
					disabled: switching,
					onSelect: () => select(skin.id)
				}, skin.id))
			}),
			switching && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: SkinSettingsSection_module_css_default.status,
				children: t("switching")
			}),
			snapshot.error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: SkinSettingsSection_module_css_default.error,
				role: "alert",
				children: t("error", { message: snapshot.error })
			})
		]
	});
}
//#endregion
//#region \0dsh-css:src/client/settings/SkinNavIcon.module.css.mjs
const css = "nav button[data-dsh-skin-nav-icon]>svg:first-child{display:none}nav button[data-dsh-skin-nav-icon]:before{--dsh-skin-palette:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2a10 10 0 0 0 0 20h1.5a1.5 1.5 0 0 0 0-3H12a2 2 0 0 1 0-4h2c4.4 0 8-3.6 8-8 0-2.8-4.5-5-10-5Z'/%3E%3Ccircle cx='7.5' cy='10.5' r='1' fill='black' stroke='none'/%3E%3Ccircle cx='9' cy='6.5' r='1' fill='black' stroke='none'/%3E%3Ccircle cx='14' cy='6' r='1' fill='black' stroke='none'/%3E%3Ccircle cx='17.5' cy='9' r='1' fill='black' stroke='none'/%3E%3C/svg%3E\");content:\"\";width:16px;height:16px;mask:var(--dsh-skin-palette) center / contain no-repeat;-webkit-mask:var(--dsh-skin-palette) center / contain no-repeat;background:currentColor;flex:0 0 16px}";
const tagId = "dsh-skin-switch/SkinNavIcon.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = "dsh-skin-switch";
	tag.dataset.pluginCss = tagId;
	tag.textContent = css;
	document.head.appendChild(tag);
}
//#endregion
//#region src/client/settings/SkinNavIcon.ts
const ATTRIBUTE = "data-dsh-skin-nav-icon";
function isSkinNavButton(button, labels) {
	const label = button.querySelector(":scope > span")?.textContent?.trim();
	return button.querySelector(":scope > svg") !== null && label !== void 0 && labels.has(label);
}
function syncSkinNavIcon(labels) {
	for (const button of document.querySelectorAll(`[${ATTRIBUTE}]`)) button.removeAttribute(ATTRIBUTE);
	for (const button of document.querySelectorAll("nav button")) if (isSkinNavButton(button, labels)) button.setAttribute(ATTRIBUTE, "");
}
/** The settings slot has no icon field, so decorate only the localized Skins row. */
function installSkinNavIcon(labels) {
	const accepted = new Set(labels);
	const sync = () => syncSkinNavIcon(accepted);
	const observer = new MutationObserver(sync);
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true
	});
	sync();
	return () => {
		observer.disconnect();
		for (const button of document.querySelectorAll(`[${ATTRIBUTE}]`)) button.removeAttribute(ATTRIBUTE);
	};
}
//#endregion
//#region src/client/index.ts
function sleep(milliseconds) {
	const { promise, resolve } = Promise.withResolvers();
	window.setTimeout(resolve, milliseconds);
	return promise;
}
function activeCollectionSkin() {
	return activeDshWebUiSkinId(window.__DSH_BOOT__?.entries ?? []);
}
function createCollectionGateway() {
	return new DshWebUiHttpGateway({
		fetcher: (url, options) => fetch(url, options),
		location: {
			href: window.location.href,
			reload: () => window.location.reload()
		},
		sleep
	});
}
/** Provides the registry before managed skin packages can leave DI pending. */
function apply(ctx) {
	const externalActive = activeCollectionSkin();
	if (externalActive !== null) localStorage.setItem(SKIN_STORAGE_KEY, DEFAULT_SKIN_ID);
	const collection = new DshWebUiCollectionAdapter(new SkinManager(localStorage), localStorage, createCollectionGateway(), externalActive);
	collection.initialize().catch(() => void 0);
	ctx.provide("skinManager", collection);
	ctx.effect(() => ctx.locale.register(SKIN_SETTINGS_NS, {
		zh,
		en
	}), "skin-manager: settings dictionaries");
	const t = ctx.locale.bind(SKIN_SETTINGS_NS);
	ctx.effect(() => installSkinNavIcon([zh.nav, en.nav]), "skin-manager: settings navigation icon");
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "skins",
		order: 12,
		label: () => t("nav"),
		locale: SKIN_SETTINGS_NS,
		inject: () => ({ manager: collection })
	}, SkinSettingsSection));
}
const inject = ["slots", "locale"];
//#endregion
exports.DEFAULT_SKIN_ID = DEFAULT_SKIN_ID;
exports.DshWebUiCollectionAdapter = DshWebUiCollectionAdapter;
exports.SKIN_STORAGE_KEY = SKIN_STORAGE_KEY;
exports.SkinManager = SkinManager;
exports.activeDshWebUiSkinId = activeDshWebUiSkinId;
exports.apply = apply;
exports.dshWebUiSelectionId = dshWebUiSelectionId;
exports.inject = inject;

return module.exports; } });
//# sourceMappingURL=client.js.map