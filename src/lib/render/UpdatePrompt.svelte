<script lang="ts">
	/**
	 * "Update available — tap to refresh" toast. The service worker installs a new
	 * version in the background but (by design) waits for a relaunch before taking
	 * over. This surfaces that waiting update so the player can apply it on one tap:
	 * we tell the waiting worker to skipWaiting, and reload once it takes control.
	 * Only ever shown for an actual UPDATE (a controller already runs) — never on
	 * first install.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let show = $state(false);
	let waiting: ServiceWorker | null = null;
	let refreshing = false;

	onMount(() => {
		if (!browser || !('serviceWorker' in navigator)) return;

		// When the waiting worker takes control (after our skip-waiting), reload —
		// but only if we initiated it, so a first-install claim doesn't reload.
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (refreshing) window.location.reload();
		});

		let reg: ServiceWorkerRegistration | undefined;
		const offer = (worker: ServiceWorker | null) => {
			if (worker && navigator.serviceWorker.controller) {
				waiting = worker;
				show = true;
			}
		};

		// `ready` (not getRegistration) so we don't race SvelteKit's on-load
		// registration — it resolves once a registration with an active worker exists.
		navigator.serviceWorker.ready.then((r) => {
			reg = r;
			offer(r.waiting); // an update may already be waiting on load
			r.addEventListener('updatefound', () => {
				const nw = r.installing;
				nw?.addEventListener('statechange', () => {
					if (nw.state === 'installed') offer(nw);
				});
			});
		});

		// Re-check for a newer version whenever the app returns to the foreground.
		const onVisible = () => {
			if (document.visibilityState === 'visible') reg?.update().catch(() => {});
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	function refresh() {
		refreshing = true;
		show = false;
		waiting?.postMessage('skip-waiting');
		// Safety net if controllerchange never fires (e.g. odd worker state).
		setTimeout(() => window.location.reload(), 2500);
	}

	function dismiss() {
		show = false;
	}
</script>

{#if show}
	<div class="update-toast" role="status">
		<span class="msg"><span class="spark">✨</span> Update available</span>
		<button class="refresh" onclick={refresh}>Refresh</button>
		<button class="dismiss" onclick={dismiss} aria-label="Dismiss">×</button>
	</div>
{/if}

<style>
	.update-toast {
		position: fixed;
		left: 50%;
		bottom: calc(1rem + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.6rem;
		max-width: calc(100vw - 1.5rem);
		padding: 0.5rem 0.6rem 0.5rem 1rem;
		border-radius: 1.4rem;
		background: rgba(0, 0, 0, 0.82);
		color: #fff;
		box-shadow: var(--card-shadow-lift);
		z-index: 6500;
		animation: rise 0.28s var(--ease-out);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translate(-50%, 0.6rem);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.update-toast {
			animation: none;
		}
	}
	.msg {
		font-size: 0.9rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.spark {
		font-size: 0.85rem;
	}
	.refresh {
		font-family: inherit;
		font-weight: 800;
		font-size: 0.85rem;
		color: #2b2208;
		background: var(--drop-ring);
		border: none;
		border-radius: 999px;
		padding: 0.4rem 1rem;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.refresh:active {
		transform: scale(0.96);
	}
	.dismiss {
		flex: 0 0 auto;
		width: 1.7rem;
		height: 1.7rem;
		border: none;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
		display: grid;
		place-items: center;
		-webkit-tap-highlight-color: transparent;
	}
	.dismiss:hover {
		background: rgba(255, 255, 255, 0.24);
	}
</style>
