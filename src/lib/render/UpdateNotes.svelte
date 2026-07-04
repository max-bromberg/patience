<script lang="ts">
	/**
	 * "What's new" popup — a compact, scrollable patch-notes card shown once when a
	 * returning player launches into a newer version (see $lib/updates). Not
	 * full-screen; the body scrolls when notes get long. Dismiss via the ×, the
	 * "Got it" button, a backdrop tap, or Escape.
	 */
	import { onMount } from 'svelte';
	import type { ChangeKind } from '$lib/updates/changelog';
	import { releaseNotes } from '$lib/updates/notes.svelte';

	const releases = $derived(releaseNotes.releases);
	const show = $derived(releaseNotes.open);

	onMount(() => {
		// Auto-show any releases newer than the player's last-seen version.
		releaseNotes.openPending();
	});

	function dismiss() {
		releaseNotes.close();
	}

	const TAG: Record<ChangeKind, string> = { added: 'New', improved: 'Improved', fixed: 'Fixed' };

	function prettyDate(iso: string): string {
		const d = new Date(iso + 'T00:00:00');
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}
</script>

{#if show}
	<div
		class="overlay"
		role="button"
		tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && dismiss()}
		onkeydown={(e) => e.key === 'Escape' && dismiss()}
	>
		<div class="modal" role="dialog" aria-label="What's new" aria-modal="true">
			<header>
				<h2>What’s new</h2>
				<button class="close" onclick={dismiss} aria-label="Close">×</button>
			</header>

			<div class="body">
				{#each releases as r (r.version)}
					<section class="release">
						<div class="rel-head">
							<span class="ver">v{r.version}</span>
							<span class="rel-title">{r.title}</span>
							<span class="date">{prettyDate(r.date)}</span>
						</div>
						<ul class="changes">
							{#each r.changes as c (c.text)}
								<li>
									<!-- data-kind (not a class) so the kind never collides with a
									     utility class like Tailwind's `.fixed` (position: fixed). -->
									<span class="tag" data-kind={c.kind}>{TAG[c.kind]}</span>
									<span class="ctext">{c.text}</span>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>

			<footer>
				<button class="got-it" onclick={dismiss}>Got it</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		padding-bottom: calc(1rem + env(safe-area-inset-bottom));
		padding-top: calc(1rem + env(safe-area-inset-top));
		background: rgba(0, 0, 0, 0.5);
		z-index: 6000;
		animation: fade 0.2s var(--ease-out);
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	.modal {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 30rem;
		max-height: min(78vh, 40rem);
		background: var(--card-bg);
		color: var(--card-ink-black);
		border-radius: 1rem;
		box-shadow: var(--card-shadow-lift);
		overflow: hidden;
		animation: pop 0.25s var(--ease-out);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(0.75rem) scale(0.97);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.overlay,
		.modal {
			animation: none;
		}
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 1.1rem 1.25rem 0.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}
	header h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	.close {
		flex: 0 0 auto;
		width: 2rem;
		height: 2rem;
		border: none;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.06);
		color: inherit;
		font-size: 1.35rem;
		line-height: 1;
		cursor: pointer;
		display: grid;
		place-items: center;
		-webkit-tap-highlight-color: transparent;
	}
	.close:hover {
		background: rgba(0, 0, 0, 0.12);
	}

	.body {
		overflow-y: auto;
		/* NB: no `-webkit-overflow-scrolling: touch` — on iOS it puts the scroll on
		   its own layer and leaves non-composited children (the tag/version badges)
		   painted in place, so they appear to stay fixed while text scrolls. Modern
		   iOS momentum-scrolls natively without it. */
		overscroll-behavior: contain;
		padding: 0.75rem 1.25rem 1rem;
		display: grid;
		gap: 1.25rem;
	}

	.rel-head {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.6rem;
	}
	.ver {
		font-weight: 800;
		font-size: 0.78rem;
		letter-spacing: 0.02em;
		color: var(--back-1);
	}
	.rel-title {
		font-weight: 700;
		font-size: 1rem;
	}
	.date {
		margin-left: auto;
		font-size: 0.75rem;
		color: #7a7a82;
	}

	.changes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}
	.changes li {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		font-size: 0.92rem;
		line-height: 1.4;
	}
	/* Plain colored text labels (no background pill): a filled/rounded box gets
	   composited onto its own layer and can be left behind — painting over the
	   text — during iOS momentum scroll. Text has no such separate paint. */
	.tag {
		flex: 0 0 auto;
		width: 4.3rem;
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}
	.tag[data-kind='added'] {
		color: #2f7a52;
	}
	.tag[data-kind='improved'] {
		color: #2b6cb0;
	}
	.tag[data-kind='fixed'] {
		color: #a76a17;
	}
	.ctext {
		flex: 1;
		min-width: 0;
	}

	footer {
		padding: 0.75rem 1.25rem;
		padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		display: flex;
		justify-content: flex-end;
	}
	.got-it {
		font-family: inherit;
		font-weight: 700;
		color: #fff;
		background: var(--back-1);
		border: none;
		border-radius: 999px;
		padding: 0.55rem 1.4rem;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.got-it:active {
		transform: scale(0.97);
	}
</style>
