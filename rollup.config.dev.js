import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import { readFileSync } from "node:fs";

const ENV = Object.fromEntries(readFileSync(new URL(".env", import.meta.url), "utf8")
	.split(/\r?\n/)
	.map(line => line.trim())
	.filter(line => line && !line.startsWith("#"))
	.map(line => {
		const separatorIndex = line.indexOf("=");
		return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
	}));
if (!ENV.NORMANDY_BACKEND_URL) {
	throw new Error("NORMANDY_BACKEND_URL is not set in .env");
}

const normandyEnvPlugin = {
	name: "normandy-env",
	resolveId(id) {
		return id == "virtual:normandy-env" ? `\0${id}` : null;
	},
	load(id) {
		return id == "\0virtual:normandy-env"
			? `export const NORMANDY_BACKEND_URL = ${JSON.stringify(ENV.NORMANDY_BACKEND_URL.replace(/\/$/, ""))};`
			: null;
	}
};

const PLUGINS = [normandyEnvPlugin, resolve({ moduleDirectories: ["node_modules"] })];
const EXTERNAL = ["single-file-core"];

export default [{
	input: ["single-file-core/single-file.js"],
	output: [{
		file: "lib/single-file.js",
		format: "umd",
		name: "singlefile",
		plugins: []
	}],
	plugins: PLUGINS,
	external: EXTERNAL
}, {
	input: ["single-file-core/single-file-frames.js"],
	output: [{
		file: "lib/single-file-frames.js",
		format: "umd",
		name: "singlefile",
		plugins: []
	}],
	plugins: PLUGINS,
	external: EXTERNAL
}, {
	input: ["single-file-core/single-file-bootstrap.js"],
	output: [{
		file: "lib/single-file-bootstrap.js",
		format: "umd",
		name: "singlefileBootstrap",
		plugins: []
	}],
	plugins: PLUGINS,
	external: EXTERNAL
}, {
	input: ["single-file-core/single-file-hooks-frames.js"],
	output: [{
		file: "lib/single-file-hooks-frames.js",
		format: "iife",
		plugins: []
	}],
	plugins: PLUGINS,
	external: EXTERNAL
}, {
	input: ["single-file-core/single-file-infobar.js"],
	output: [{
		file: "lib/single-file-infobar.js",
		format: "iife",
		plugins: [terser()]
	}],
	plugins: PLUGINS,
	external: EXTERNAL
}, {
	input: ["single-file-core/vendor/zip/z-worker.js"],
	output: [{
		file: "lib/single-file-z-worker.js",
		format: "es",
		plugins: []
	}],
	plugins: PLUGINS,
	external: EXTERNAL
}, {
	input: ["single-file-core/vendor/zip/zip.js"],
	output: [{
		file: "lib/single-file-zip.js",
		format: "es",
		plugins: []
	}],
	context: "this",
	plugins: PLUGINS,
	external: EXTERNAL
}, {
	input: ["single-file-core/vendor/zip/zip.min.js"],
	output: [{
		file: "lib/single-file-zip.min.js",
		format: "es",
		plugins: []
	}],
	context: "this",
	plugins: PLUGINS,
	external: EXTERNAL
}, {
	input: ["src/core/content/content-bootstrap.js"],
	output: [{
		file: "lib/single-file-extension-bootstrap.js",
		format: "iife",
		plugins: []
	}]
}, {
	input: ["src/core/content/content-frames.js"],
	output: [{
		file: "lib/single-file-extension-frames.js",
		format: "iife",
		plugins: []
	}]
}, {
	input: ["src/index.js"],
	output: [{
		file: "lib/single-file-extension-core.js",
		format: "umd",
		name: "extension",
		plugins: []
	}]
}, {
	input: ["src/core/content/content.js"],
	output: [{
		file: "lib/single-file-extension.js",
		format: "iife",
		plugins: []
	}]
}, {
	input: ["src/ui/content/content-ui-editor-web.js"],
	output: [{
		file: "lib/single-file-extension-editor.js",
		format: "iife",
		plugins: []
	}],
	plugins: PLUGINS,
	external: EXTERNAL
}, {
	input: ["single-file-core/single-file-editor-helper.js"],
	output: [{
		file: "lib/single-file-extension-editor-helper.js",
		format: "umd",
		name: "singlefile",
		plugins: []
	}],
	plugins: PLUGINS,
	external: EXTERNAL
}, {
	input: ["src/lib/single-file/browser-polyfill/chrome-browser-polyfill.js"],
	output: [{
		file: "lib/chrome-browser-polyfill.js",
		format: "iife",
		plugins: []
	}]
}, {
	input: ["src/core/bg/index.js"],
	output: [{
		file: "lib/single-file-extension-background.js",
		format: "iife",
		plugins: []
	}],
	plugins: PLUGINS
}, {
	input: ["src/ui/bg/ui-nb-clipper-popup.js"],
	output: [{
		file: "lib/ui-nb-clipper-popup.js",
		format: "iife",
		plugins: []
	}],
	plugins: PLUGINS
}, {
	input: ["src/ui/bg/ui-nb-clipper-sign-in.js"],
	output: [{
		file: "lib/ui-nb-clipper-sign-in.js",
		format: "es",
		plugins: []
	}],
	plugins: PLUGINS
}, {
	input: ["src/ui/bg/ui-nb-clipper-save-location.js"],
	output: [{
		file: "lib/ui-nb-clipper-save-location.js",
		format: "es",
		plugins: []
	}],
	plugins: PLUGINS
}, {
	input: ["src/lib/single-file/background.js"],
	output: [{
		file: "lib/single-file-background.js",
		format: "iife",
		plugins: []
	}]
}, {
	input: ["src/lib/web-stream/index.js"],
	output: [{
		file: "lib/web-stream.js",
		format: "iife",
		plugins: []
	}]
}];
