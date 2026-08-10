/* global browser, document, fetch */

const DEVELOPMENT_BACKEND_URL = "http://localhost:4000/api";
const PRODUCTION_BACKEND_URL = "https://normandy-backend.azurewebsites.net/api";

const form = document.getElementById("signInForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const signInButton = document.getElementById("signInButton");
const signOutButton = document.getElementById("signOutButton");
const status = document.getElementById("status");
const backendUrlOutput = document.getElementById("backendUrl");

const backendUrl = await getBackendUrl();
backendUrlOutput.textContent = backendUrl;
await refresh();

form.addEventListener("submit", async event => {
	event.preventDefault();
	setPending(true);
	setStatus("Signing in…");
	try {
		const response = await fetch(`${backendUrl}/auth/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				email: emailInput.value.trim(),
				password: passwordInput.value
			})
		});
		const responseBody = await response.json();
		if (!response.ok || !responseBody.token) {
			throw new Error(responseBody.message || `Sign-in failed (HTTP ${response.status}).`);
		}
		const { nbClipperAuth } = await browser.storage.local.get("nbClipperAuth");
		const email = responseBody.email || emailInput.value.trim();
		if (nbClipperAuth && nbClipperAuth.email != email) {
			await browser.storage.local.remove("nbClipperSaveLocation");
		}
		await browser.storage.local.set({
			nbClipperAuth: {
				token: responseBody.token,
				email
			}
		});
		passwordInput.value = "";
		await refresh();
	} catch (error) {
		setStatus(error.message || "Could not sign in.", "error");
	} finally {
		setPending(false);
	}
});

signOutButton.addEventListener("click", async () => {
	await browser.storage.local.remove(["nbClipperAuth", "nbClipperSaveLocation"]);
	emailInput.value = "";
	passwordInput.value = "";
	await refresh();
});

async function refresh() {
	const { nbClipperAuth } = await browser.storage.local.get("nbClipperAuth");
	const signedIn = Boolean(nbClipperAuth && nbClipperAuth.token);
	form.hidden = signedIn;
	signOutButton.hidden = !signedIn;
	if (signedIn) {
		setStatus(`Signed in as ${nbClipperAuth.email}.`, "success");
	} else {
		setStatus("Sign in with your Normandy account.");
	}
}

async function getBackendUrl() {
	try {
		const extensionInfo = await browser.management.getSelf();
		if (extensionInfo.installType == "development") {
			return DEVELOPMENT_BACKEND_URL;
		}
	} catch {
		// Use production when install metadata is unavailable.
	}
	return PRODUCTION_BACKEND_URL;
}

function setPending(pending) {
	emailInput.disabled = pending;
	passwordInput.disabled = pending;
	signInButton.disabled = pending;
}

function setStatus(message, state) {
	status.textContent = message;
	status.className = state || "";
}
