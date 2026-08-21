/*
 * Chromium Manifest V3 bootstrap.
 *
 * This is a compatibility bridge for the first migration phase. The current
 * background bundle was written for an extension page and still refers to
 * `window` in a few browser-only branches. Mapping it to the worker global
 * keeps the Normandy upload path usable while DOM-dependent SingleFile work is
 * migrated to the MV3/offscreen architecture in later phases.
 */

globalThis.window = globalThis;

importScripts(
	"../../../lib/web-stream.js",
	"../../lib/single-file/browser-polyfill/chrome-browser-polyfill.js",
	"../../../lib/single-file-extension-background.js"
);
