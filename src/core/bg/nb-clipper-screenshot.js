/* global browser, OffscreenCanvas, createImageBitmap, fetch, setTimeout */

const MAX_CANVAS_DIMENSION = 16 * 1024;
const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;

export {
	captureFullPagePng
};

async function captureFullPagePng(tabId) {
	const metrics = await browser.tabs.sendMessage(tabId, {
		method: "content.getScreenshotMetrics"
	});
	validateMetrics(metrics);

	const tab = await browser.tabs.get(tabId);
	const [previousActiveTab] = await browser.tabs.query({
		active: true,
		windowId: tab.windowId
	});
	const captureWidth = Math.min(metrics.width, metrics.innerWidth);
	const captureHeight = metrics.height;
	const scale = getScale(captureWidth, captureHeight);
	const canvasWidth = Math.max(1, Math.floor(captureWidth * scale));
	const canvasHeight = Math.max(1, Math.floor(captureHeight * scale));
	const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Could not create the screenshot canvas.");
	}

	let scrollStarted = false;
	try {
		await browser.tabs.sendMessage(tabId, { method: "content.beginScrollTo" });
		scrollStarted = true;
		if (!previousActiveTab || previousActiveTab.id != tabId) {
			await browser.tabs.update(tabId, { active: true });
		}

		let y = 0;
		let canvasY = 0;
		while (y < captureHeight) {
			if (y) {
				await browser.tabs.sendMessage(tabId, { method: "content.scrollTo", y });
				await new Promise(resolve => setTimeout(resolve, 100));
			}

			const imageDataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
				format: "png"
			});
			const imageResponse = await fetch(imageDataUrl);
			const imageBitmap = await createImageBitmap(await imageResponse.blob());
			try {
				const cssHeight = Math.min(metrics.innerHeight, captureHeight - y);
				const sourceWidth = Math.max(1, Math.floor(imageBitmap.width * captureWidth / metrics.innerWidth));
				const sourceHeight = Math.max(1, Math.floor(imageBitmap.height * cssHeight / metrics.innerHeight));
				const targetHeight = Math.min(
					canvasHeight - canvasY,
					Math.max(1, Math.round(cssHeight * scale))
				);
				context.drawImage(
					imageBitmap,
					0,
					0,
					sourceWidth,
					sourceHeight,
					0,
					canvasY,
					canvasWidth,
					targetHeight
				);
				canvasY += targetHeight;
			} finally {
				imageBitmap.close();
			}

			y += metrics.innerHeight;
		}

		return canvas.convertToBlob({ type: "image/png" });
	} finally {
		if (scrollStarted) {
			try {
				await browser.tabs.sendMessage(tabId, { method: "content.endScrollTo" });
			} catch {
				// The page may have navigated or closed while the screenshot was running.
			}
		}
		if (previousActiveTab && previousActiveTab.id != tabId) {
			try {
				await browser.tabs.update(previousActiveTab.id, { active: true });
			} catch {
				// The previously active tab may have closed while the save was running.
			}
		}
	}
}

function validateMetrics(metrics) {
	if (!metrics ||
		!Number.isFinite(metrics.width) || metrics.width <= 0 ||
		!Number.isFinite(metrics.height) || metrics.height <= 0 ||
		!Number.isFinite(metrics.innerWidth) || metrics.innerWidth <= 0 ||
		!Number.isFinite(metrics.innerHeight) || metrics.innerHeight <= 0) {
		throw new Error("Could not determine the page size for the screenshot.");
	}
}

function getScale(width, height) {
	const dimensionScale = Math.min(
		1,
		MAX_CANVAS_DIMENSION / width,
		MAX_CANVAS_DIMENSION / height
	);
	const pixelScale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));
	return Math.min(dimensionScale, pixelScale);
}
