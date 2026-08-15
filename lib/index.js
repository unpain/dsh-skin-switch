import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
//#region src/collections/dsh-web-ui-host.ts
const DSH_WEB_UI_COLLECTION_ROUTE = "/api/dsh-skin-switch/collections/dsh-web-ui";
const SKIN_ID = /^[a-z0-9-]+$/;
const PACKAGE_PREFIX = "@linxin666/dsh-client-ui-skin-";
function firstNonBlank(...values) {
	return values.map((value) => value?.trim()).find((value) => value !== void 0 && value.length > 0);
}
function profileFromCwd(cwd, profilesRoot) {
	const normalizedCwd = resolve(cwd);
	const canonical = (path) => {
		try {
			return realpathSync(path);
		} catch {
			return resolve(path);
		}
	};
	if (canonical(dirname(normalizedCwd)) !== canonical(profilesRoot)) return void 0;
	const profile = basename(normalizedCwd);
	try {
		return profile !== "" && statSync(normalizedCwd, { throwIfNoEntry: false })?.isDirectory() === true ? profile : void 0;
	} catch {
		return;
	}
}
function resolveDshWebUiSkinsDir(options = {}) {
	const env = options.env ?? process.env;
	const harnessHome = firstNonBlank(env.DSH_HOME) ?? join(options.home ?? homedir(), ".dsh");
	const profilesRoot = join(harnessHome, "profiles");
	const profile = firstNonBlank(env.DSH_SKIN_PROFILE, env.DSH_PROFILE) ?? profileFromCwd(options.cwd ?? process.cwd(), profilesRoot) ?? "web";
	return join(profilesRoot, profile, "node_modules", "@linxin666", "dsh-skins", "skins");
}
function optionalString(record, key) {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function parseSkin(directory, value) {
	if (typeof value !== "object" || value === null) return null;
	const record = value;
	const id = optionalString(record, "id");
	const name = optionalString(record, "name");
	const description = optionalString(record, "description");
	if (id === void 0 || !SKIN_ID.test(id) || id !== directory) return null;
	if (name === void 0 || description === void 0) return null;
	if (record.package !== `${PACKAGE_PREFIX}${id}`) return null;
	const order = typeof record.order === "number" && Number.isFinite(record.order) ? record.order : void 0;
	return {
		id,
		name,
		nameEn: optionalString(record, "nameEn"),
		description,
		author: optionalString(record, "author"),
		accent: optionalString(record, "accent"),
		order
	};
}
function readSkin(skinsDir, directory) {
	try {
		return parseSkin(directory, JSON.parse(readFileSync(join(skinsDir, directory, "skin.json"), "utf8")));
	} catch {
		return null;
	}
}
function discoverDshWebUiSkins(skinsDir) {
	let directories;
	try {
		directories = readdirSync(skinsDir);
	} catch {
		return [];
	}
	return directories.map((directory) => readSkin(skinsDir, directory)).filter((skin) => skin !== null).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
}
function answerJson(response, status, value) {
	response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	response.end(JSON.stringify(value));
}
function createDshWebUiCollectionRoute(skinsDir = resolveDshWebUiSkinsDir()) {
	return {
		kind: "exact",
		path: DSH_WEB_UI_COLLECTION_ROUTE,
		handler(request, response) {
			if (request.method !== "GET") {
				answerJson(response, 405, {
					ok: false,
					error: "method-not-allowed"
				});
				return;
			}
			answerJson(response, 200, {
				ok: true,
				skins: discoverDshWebUiSkins(skinsDir)
			});
		}
	};
}
//#endregion
//#region src/index.ts
/** Exposes installed collection metadata without coupling the browser to profile paths. */
function apply(ctx) {
	const host = ctx;
	ctx.effect(() => host.webServer.register(createDshWebUiCollectionRoute()), "skin-manager: dsh-web-ui collection route");
}
const inject = ["webServer"];
//#endregion
export { apply, inject };
