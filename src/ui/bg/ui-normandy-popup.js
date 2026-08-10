/* global browser, document, fetch, window */

const DEVELOPMENT_API_URL = "http://localhost:4000/api";
const PRODUCTION_API_URL = "https://normandy-backend.azurewebsites.net/api";
const OTHER_ITEM_VALUE = "__other__";

const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginButton = document.getElementById("loginButton");
const saveForm = document.getElementById("saveForm");
const clientSelect = document.getElementById("clientSelect");
const itemSelect = document.getElementById("itemSelect");
const customItemFields = document.getElementById("customItemFields");
const customItemInput = document.getElementById("customItemInput");
const saveButton = document.getElementById("saveButton");
const status = document.getElementById("status");

let auth;
let apiUrl;
let savedSelection;

loginForm.addEventListener("submit", login);
saveForm.addEventListener("submit", savePage);
clientSelect.addEventListener("change", clientChanged);
itemSelect.addEventListener("change", itemChanged);
customItemInput.addEventListener("input", refreshSaveButton);

initialize();

async function initialize() {
	apiUrl = await getApiUrl();
	const stored = await browser.storage.local.get(["normandyAuth", "normandyPopupSelection"]);
	auth = stored.normandyAuth;
	savedSelection = stored.normandyPopupSelection;
	if (auth && isCurrentJwt(auth.token)) {
		await showSaveForm();
	} else {
		if (auth) {
			await browser.storage.local.remove("normandyAuth");
		}
		showLoginForm();
	}
}

function showLoginForm(message) {
	auth = null;
	saveForm.hidden = true;
	loginForm.hidden = false;
	setStatus(message || "Log in with your Normandy account.");
	usernameInput.focus();
}

async function showSaveForm() {
	loginForm.hidden = true;
	saveForm.hidden = false;
	setStatus("Loading clients...");
	setSelectMessage(clientSelect, "Loading clients...");
	setSelectMessage(itemSelect, "Select a client first");
	try {
		const clients = await fetchRoute("save-locations",
			["name"],
			["name"],
			"folders");
		fillSelect(clientSelect, clients, "Select a client",
			savedSelection && (savedSelection.folderName || savedSelection.client));
		setStatus("");
		if (clientSelect.value) {
			await loadItems(clientSelect.value, savedSelection &&
				(savedSelection.subFolderName || savedSelection.item));
		}
	} catch (error) {
		await handleRequestError(error, "Could not load clients.");
	}
}

async function login(event) {
	event.preventDefault();
	setLoginPending(true);
	setStatus("Logging in...");
	const username = usernameInput.value.trim();
	try {
		const response = await fetch(`${apiUrl}/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username,
				// Older Normandy deployments use the email property for the same field.
				email: username,
				password: passwordInput.value
			})
		});
		const body = await readResponse(response, "Login failed.");
		if (!body.token) {
			throw new Error("The backend did not return a login token.");
		}
		if (!isCurrentJwt(body.token)) {
			throw new Error("The backend returned an invalid or expired login token.");
		}
		auth = {
			token: body.token,
			username: body.username || username,
			email: body.email || username
		};
		const stored = await browser.storage.local.get("normandyAuth");
		if (stored.normandyAuth &&
			(stored.normandyAuth.username || stored.normandyAuth.email) != (auth.username || auth.email)) {
			await browser.storage.local.remove(["normandySaveLocation", "normandyPopupSelection"]);
			savedSelection = null;
		}
		await browser.storage.local.set({ normandyAuth: auth });
		passwordInput.value = "";
		await showSaveForm();
	} catch (error) {
		setStatus(error.message || "Could not log in.", true);
	} finally {
		setLoginPending(false);
	}
}

async function clientChanged() {
	const client = clientSelect.value;
	saveButton.disabled = true;
	hideCustomItemInput();
	if (!client) {
		setSelectMessage(itemSelect, "Select a client first");
		return;
	}
	await loadItems(client);
}

async function loadItems(client, selectedItem) {
	setSelectMessage(itemSelect, "Loading items...");
	setStatus("Loading items...");
	try {
		const items = await fetchRoute("subfolders",
			["subFolderName", "displayName", "name"],
			["subFolderName", "_id"],
			"items");
		fillSelect(itemSelect, items, "Select an item", selectedItem);
		itemSelect.add(new Option("Other", OTHER_ITEM_VALUE));
		itemSelect.disabled = false;
		if (selectedItem && !items.some(item => item.value == selectedItem)) {
			itemSelect.value = OTHER_ITEM_VALUE;
			customItemInput.value = selectedItem;
		}
		itemChanged();
		setStatus("");
	} catch (error) {
		await handleRequestError(error, "Could not load items.");
	}
}

async function fetchRoute(route, labelKeys, valueKeys, collectionKey) {
	const response = await fetch(`${apiUrl}/single-file/${route}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${auth.token}`
		}
	});
	const responseBody = await readResponse(response, `Request to ${route} failed.`);
	return normalizeOptions(responseBody[collectionKey] || [], labelKeys, valueKeys);
}

async function readResponse(response, fallbackMessage) {
	const text = await response.text();
	let body;
	try {
		body = text ? JSON.parse(text) : {};
	} catch {
		body = {};
	}
	if (!response.ok) {
		const error = new Error(body.message || `${fallbackMessage} (HTTP ${response.status})`);
		error.status = response.status;
		throw error;
	}
	return body;
}

function normalizeOptions(values, labelKeys, valueKeys) {
	if (!Array.isArray(values)) {
		return [];
	}
	return values.map(value => {
		if (typeof value == "string") {
			return { label: value, value };
		}
		const labelKey = labelKeys.find(key => value && value[key]);
		const valueKey = valueKeys.find(key => value && value[key]);
		return labelKey && valueKey ? {
			label: String(value[labelKey]),
			value: String(value[valueKey])
		} : null;
	}).filter(Boolean);
}

function fillSelect(select, options, placeholder, selectedValue) {
	select.replaceChildren(new Option(placeholder, ""));
	for (const option of options) {
		select.add(new Option(option.label, option.value));
	}
	select.disabled = !options.length;
	if (options.some(option => option.value == selectedValue)) {
		select.value = selectedValue;
	}
}

function setSelectMessage(select, message) {
	select.replaceChildren(new Option(message, ""));
	select.disabled = true;
}

function itemChanged() {
	const customItemSelected = itemSelect.value == OTHER_ITEM_VALUE;
	customItemFields.hidden = !customItemSelected;
	customItemInput.required = customItemSelected;
	if (customItemSelected) {
		customItemInput.focus();
	} else {
		customItemInput.value = "";
	}
	refreshSaveButton();
}

function hideCustomItemInput() {
	customItemFields.hidden = true;
	customItemInput.required = false;
	customItemInput.value = "";
}

function refreshSaveButton() {
	const itemName = itemSelect.value == OTHER_ITEM_VALUE ?
		customItemInput.value.trim() : itemSelect.value;
	saveButton.disabled = !clientSelect.value || !itemName;
}

async function savePage(event) {
	event.preventDefault();
	setSavePending(true);
	setStatus("Starting save...");
	try {
		const itemName = itemSelect.value == OTHER_ITEM_VALUE ?
			customItemInput.value.trim() : itemSelect.value;
		const selection = {
			folderName: clientSelect.value,
			subFolderName: itemName
		};
		await browser.storage.local.set({ normandyPopupSelection: selection });
		const response = await browser.runtime.sendMessage({
			method: "ui.normandyPopup.save",
			selection
		});
		if (!response || !response.started) {
			throw new Error(response && response.error || "Could not start the save.");
		}
		window.close();
	} catch (error) {
		setStatus(error.message || "Could not start the save.", true);
		setSavePending(false);
	}
}

async function handleRequestError(error, fallbackMessage) {
	if (error.status == 401 || error.status == 403) {
		await browser.storage.local.remove("normandyAuth");
		showLoginForm("Your session expired. Please log in again.");
		return;
	}
	setStatus(error.message || fallbackMessage, true);
}

function setLoginPending(pending) {
	usernameInput.disabled = pending;
	passwordInput.disabled = pending;
	loginButton.disabled = pending;
}

function setSavePending(pending) {
	clientSelect.disabled = pending;
	itemSelect.disabled = pending;
	customItemInput.disabled = pending;
	saveButton.disabled = pending;
	if (!pending) {
		refreshSaveButton();
	}
}

async function getApiUrl() {
	try {
		const extensionInfo = await browser.management.getSelf();
		if (extensionInfo.installType == "development") {
			return DEVELOPMENT_API_URL;
		}
	} catch {
		// Use production when install metadata is unavailable.
	}
	return PRODUCTION_API_URL;
}

function setStatus(message, error) {
	status.textContent = message;
	status.className = error ? "error" : "";
}

function isCurrentJwt(token) {
	if (typeof token != "string") {
		return false;
	}
	const parts = token.split(".");
	if (parts.length != 3) {
		return false;
	}
	try {
		const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		const payload = JSON.parse(window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
		return typeof payload.exp == "number" && payload.exp > Math.floor(Date.now() / 1000);
	} catch {
		return false;
	}
}
