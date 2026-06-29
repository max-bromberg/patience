<script lang="ts">
	import Icon from './Icon.svelte';

	/**
	 * Copy a pre-built share blurb to the clipboard with a quick "Copied!"
	 * confirmation. Uses the async Clipboard API with a hidden-textarea fallback
	 * for older / non-secure contexts. `variant` tweaks the styling for the
	 * light win-card vs the dark floating contexts.
	 */
	let {
		text,
		label = 'Share result',
		variant = 'light'
	}: { text: string; label?: string; variant?: 'light' | 'dark' } = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	async function copy() {
		let ok = false;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				ok = true;
			}
		} catch {
			ok = false;
		}
		if (!ok) ok = legacyCopy(text);
		if (ok) {
			copied = true;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 1900);
		}
	}

	/** Fallback for browsers without async clipboard (or non-HTTPS contexts). */
	function legacyCopy(value: string): boolean {
		if (typeof document === 'undefined') return false;
		try {
			const ta = document.createElement('textarea');
			ta.value = value;
			ta.setAttribute('readonly', '');
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			const ok = document.execCommand('copy');
			document.body.removeChild(ta);
			return ok;
		} catch {
			return false;
		}
	}
</script>

<button
	class="share {variant}"
	class:copied
	onclick={copy}
	aria-label={copied ? 'Copied to clipboard' : 'Copy shareable result'}
>
	<Icon name={copied ? 'check' : 'share'} size={17} />
	<span>{copied ? 'Copied!' : label}</span>
</button>

<style>
	.share {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		border: none;
		border-radius: 999px;
		padding: 0.4rem 0.9rem;
		cursor: pointer;
		transition:
			background 0.15s var(--ease-out),
			transform 0.1s var(--ease-out);
		-webkit-tap-highlight-color: transparent;
	}
	.share:active {
		transform: scale(0.96);
	}
	.share.light {
		background: rgba(0, 0, 0, 0.06);
		color: var(--card-ink-black);
	}
	.share.light:hover {
		background: rgba(0, 0, 0, 0.11);
	}
	.share.dark {
		background: var(--ui-surface);
		color: var(--ui-text);
	}
	.share.dark:hover {
		background: var(--ui-surface-hover);
	}
	.share.copied {
		background: var(--drop-ring);
		color: #2b2208;
	}
</style>
