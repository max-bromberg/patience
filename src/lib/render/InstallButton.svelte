<script lang="ts">
	/**
	 * "Install app" affordance. On Chromium it triggers the native install
	 * dialog; on iOS (no such API) it opens a short Add-to-Home-Screen how-to.
	 * Renders nothing when the app is already installed or can't be installed.
	 */
	import Icon from './Icon.svelte';
	import { install } from '$lib/pwa/install.svelte';

	let showHow = $state(false);

	async function onClick() {
		if (install.canPrompt) {
			await install.prompt();
		} else {
			// iOS: guide the manual Share → Add to Home Screen flow.
			showHow = true;
		}
	}
</script>

{#if install.available}
	<button class="install" onclick={onClick} aria-label="Install Patience app">
		<Icon name="install" size={17} />
		Install app
	</button>
{/if}

{#if showHow}
	<div
		class="overlay"
		role="button"
		tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && (showHow = false)}
		onkeydown={(e) => e.key === 'Escape' && (showHow = false)}
	>
		<div class="sheet" role="dialog" aria-label="Install Patience">
			<h2>Add Patience to your Home Screen</h2>
			{#if install.iosSafari}
				<ol class="steps">
					<li>
						Tap the <strong>Share</strong> button
						<span class="glyph"><Icon name="ios-share" size={18} /></span>
						in Safari's toolbar.
					</li>
					<li>Scroll down and choose <strong>Add to Home Screen</strong>.</li>
					<li>Tap <strong>Add</strong> — Patience opens full-screen and plays offline.</li>
				</ol>
			{:else}
				<p class="note">
					Open <strong>patience.maxbromberg.me</strong> in <strong>Safari</strong> to install — other
					iOS browsers can't add apps to the Home Screen.
				</p>
			{/if}
			<div class="actions">
				<button class="done" onclick={() => (showHow = false)}>Got it</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.install {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-family: inherit;
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--ui-text);
		background: var(--ui-surface);
		border: 1px solid var(--drop-ring);
		border-radius: 999px;
		padding: 0.5rem 1rem;
		cursor: pointer;
		box-shadow: 0 0 0 0 var(--drop-ring);
		transition:
			background 0.15s var(--ease-out),
			box-shadow 0.15s var(--ease-out);
		-webkit-tap-highlight-color: transparent;
	}
	.install:hover {
		background: var(--ui-surface-hover);
	}
	.install:active {
		transform: scale(0.97);
	}

	.overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		padding-bottom: calc(1rem + env(safe-area-inset-bottom));
		background: rgba(0, 0, 0, 0.45);
		z-index: 5000;
		animation: fade 0.2s var(--ease-out);
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	.sheet {
		background: var(--card-bg);
		color: var(--card-ink-black);
		border-radius: 1rem;
		padding: 1.5rem 1.6rem;
		max-width: 24rem;
		width: 100%;
		box-shadow: var(--card-shadow-lift);
	}
	.sheet h2 {
		margin: 0 0 1rem;
		font-size: 1.15rem;
	}
	.steps {
		margin: 0 0 1.25rem;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.7rem;
	}
	.steps li {
		font-size: 0.95rem;
		line-height: 1.4;
	}
	.glyph {
		display: inline-grid;
		place-items: center;
		vertical-align: -0.25em;
		width: 1.5rem;
		height: 1.5rem;
		margin: 0 0.15rem;
		border-radius: 0.4rem;
		background: #0a84ff; /* iOS system blue, so the share glyph reads as the real one */
		color: #fff;
	}
	.note {
		margin: 0 0 1.25rem;
		font-size: 0.95rem;
		line-height: 1.45;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	.done {
		font-family: inherit;
		font-weight: 700;
		color: #fff;
		background: var(--back-1);
		border: none;
		border-radius: 999px;
		padding: 0.5rem 1.1rem;
		cursor: pointer;
	}
</style>
