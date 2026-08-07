/* global browser, document, fetch */

import { NORMANDY_BACKEND_URL } from "virtual:normandy-env";

const status = document.getElementById("status");
const locations = document.getElementById("locations");
const backendUrlOutput = document.getElementById("backendUrl");

const backendUrl = NORMANDY_BACKEND_URL;
backendUrlOutput.textContent = backendUrl;
await loadLocations();

async function loadLocations() {
	const { normandyAuth, normandySaveLocation } = await browser.storage.local.get(["normandyAuth", "normandySaveLocation"]);
	if (!normandyAuth || !normandyAuth.token) {
		setStatus("Sign in to the Normandy backend before choosing a save location.", "error");
		return;
	}
	try {
		const response = await fetch(`${backendUrl}/single-file/save-locations`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${normandyAuth.token}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				email: normandyAuth.email
			})
		});
		const responseBody = await response.json();
		if (!response.ok) {
			throw new Error(responseBody.message || `Could not load save locations (HTTP ${response.status}).`);
		}
		renderLocations(responseBody.items || [], normandySaveLocation);
	} catch (error) {
		setStatus(error.message || "Could not load save locations.", "error");
	}
}

function renderLocations(items, selectedLocation) {
	locations.replaceChildren();
	if (!items.length) {
		setStatus("No save locations are available.");
		return;
	}
	setStatus("Choose where future pages should be saved.");
	for (const item of items) {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = item.displayName;
		if (selectedLocation && selectedLocation.msLink == item.msLink) {
			button.disabled = true;
			button.textContent += " (selected)";
		}
		button.addEventListener("click", async () => {
			await browser.storage.local.set({
				normandySaveLocation: {
					displayName: item.displayName,
					msLink: item.msLink
				}
			});
			renderLocations(items, item);
			setStatus(`Selected “${item.displayName}”.`, "success");
		});
		locations.append(button);
	}
}

function setStatus(message, state) {
	status.textContent = message;
	status.className = state || "";
}
