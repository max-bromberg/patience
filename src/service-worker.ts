/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Offline-first service worker. Precaches the whole app on install — hashed
 * build assets, static files (icons, manifest, favicon), and the prerendered
 * pages — so Patience plays fully offline once it's been opened. Because the
 * site is a client-routed SPA (dynamic routes like /play/[gameId] resolve on
 * the client), navigations are served network-first and fall back to the
 * cached app shell, which then boots the router for the requested route.
 *
 * SvelteKit auto-registers this file in production builds.
 *
 * Auto-update model: every deploy changes `version` and the hashed asset list,
 * so the browser sees a byte-different service-worker.js and installs it in the
 * background (precaching the new version). We deliberately DON'T call
 * skipWaiting(): the new worker waits until every tab/app window is closed, then
 * activates on the next launch. For a Home-Screen app that means each relaunch
 * picks up the latest version, while an in-progress session never has its
 * assets swapped mid-flight. First install still claims the open page (below),
 * so offline works from the very first visit.
 */

import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `patience-cache-${version}`;

// Everything needed for offline play, deduped (a path can appear in more than
// one list — e.g. a prerendered route and its index file).
const PRECACHE = [...new Set([...build, ...files, ...prerendered])];
const PRECACHE_SET = new Set(PRECACHE);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			// Cache entries individually so one bad fetch can't abort the whole
			// install (cache.addAll is all-or-nothing).
			await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
			// No skipWaiting() — see the update-model note above.
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

// The page shows an "update ready" prompt when a new worker is waiting; tapping
// it posts this message so the new version takes over immediately (the page then
// reloads on the resulting controllerchange). This is the ONLY path that skips
// waiting — automatic updates still defer to the next launch (see the note above).
sw.addEventListener('message', (event) => {
	if (event.data === 'skip-waiting') void sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return; // let cross-origin pass through untouched

	// Precached, content-hashed assets never change under a URL → cache-first.
	if (PRECACHE_SET.has(url.pathname)) {
		event.respondWith(cacheFirst(request));
		return;
	}

	// Page loads (including hard reloads of client-routed URLs) → network-first
	// so updates land, with the cached shell as the offline fallback.
	if (request.mode === 'navigate') {
		event.respondWith(navigate(request, url));
		return;
	}
});

async function cacheFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response.ok) cache.put(request, response.clone());
	return response;
}

async function navigate(request: Request, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);
	try {
		return await fetch(request);
	} catch {
		// Offline: a prerendered page for this exact path if we have one, else the
		// home shell — loading it re-boots the SPA router at the requested URL.
		const cached =
			(await cache.match(url.pathname)) ||
			(await cache.match('/')) ||
			(await cache.match('/index.html'));
		if (cached) return cached;
		return Response.error();
	}
}
