<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games/registry';
	import { GameController, Table } from '$lib/render';
	import { sfx } from '$lib/render/sound';
	import { settings } from '$lib/storage/settings.svelte';

	const gameId = $derived(page.params.gameId);
	const game = $derived(getGame(gameId ?? ''));
	const meta = $derived(game?.definition.meta);

	let showHelp = $state(false);

	// Fresh controller whenever the game id changes. Seed picks the deal; the
	// shuffle itself stays deterministic from that seed.
	function freshSeed(): number {
		return Math.floor(Math.random() * 0x7fffffff);
	}

	let controller = $derived.by(() => (game ? new GameController(game, freshSeed()) : null));

	const won = $derived(controller?.won ?? false);

	// Play the victory fanfare once when a game is won.
	let celebrated = false;
	$effect(() => {
		if (won && !celebrated) {
			celebrated = true;
			sfx.win();
		} else if (!won) {
			celebrated = false;
		}
	});
</script>

<svelte:head>
	<title>{game ? game.definition.meta.name : 'Play'} · Patience</title>
</svelte:head>

<div class="screen">
	<header class="bar">
		<a class="btn ghost" href={resolve('/')} aria-label="Back to catalog">‹ Catalog</a>
		<span class="title">{game?.definition.meta.name ?? 'Game'}</span>
		<div class="actions">
			{#if meta?.howTo}
				<button class="btn icon" onclick={() => (showHelp = true)} aria-label="How to play">
					?
				</button>
			{/if}
			<button
				class="btn icon"
				onclick={() => settings.toggleSound()}
				aria-label={settings.sound ? 'Mute sound' : 'Unmute sound'}
				aria-pressed={settings.sound}
			>
				{settings.sound ? '🔊' : '🔇'}
			</button>
			{#if controller}
				<button class="btn" onclick={() => controller.undo()} disabled={!controller.canUndo}>
					Undo
				</button>
				<button class="btn" onclick={() => controller.newDeal(freshSeed())}>New deal</button>
			{/if}
		</div>
	</header>

	{#if !game}
		<div class="missing">
			<p>No game called “{gameId}”.</p>
			<a class="btn" href={resolve('/')}>Back to catalog</a>
		</div>
	{:else if controller}
		<div class="play">
			<Table {controller} />
		</div>

		{#if won}
			<div class="win" role="status">
				<div class="win-card">
					<h2>You won! 🎉</h2>
					<button class="btn primary" onclick={() => controller.newDeal(freshSeed())}>
						Play again
					</button>
				</div>
			</div>
		{/if}
	{/if}

	{#if showHelp && meta?.howTo}
		<div
			class="overlay"
			role="button"
			tabindex="-1"
			onclick={(e) => e.target === e.currentTarget && (showHelp = false)}
			onkeydown={(e) => e.key === 'Escape' && (showHelp = false)}
		>
			<div class="sheet" role="dialog" aria-label="How to play {meta.name}">
				<h2>How to play {meta.name}</h2>
				<ul>
					{#each meta.howTo as step (step)}
						<li>{step}</li>
					{/each}
				</ul>
				<div class="sheet-actions">
					{#if meta.learnMore}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external URL -->
						<a class="btn ghost" href={meta.learnMore} target="_blank" rel="noopener noreferrer">
							Learn more ↗
						</a>
					{/if}
					<button class="btn primary" onclick={() => (showHelp = false)}>Got it</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.screen {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		background: var(--table-bg);
		background-blend-mode: var(--table-blend);
		color: var(--ui-text);
		font-family: var(--font-rounded);
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem calc(0.5rem);
		padding-top: calc(0.5rem + env(safe-area-inset-top));
	}
	.title {
		font-weight: 700;
		font-size: 1.05rem;
	}
	.actions {
		margin-left: auto;
		display: flex;
		gap: 0.4rem;
	}

	.btn {
		font-family: inherit;
		color: var(--ui-text);
		background: var(--ui-surface);
		border: none;
		border-radius: 999px;
		padding: 0.4rem 0.85rem;
		font-size: 0.85rem;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}
	.btn:hover {
		background: var(--ui-surface-hover);
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.btn.ghost {
		background: transparent;
	}
	.btn.icon {
		padding: 0.4rem 0.55rem;
		font-size: 0.95rem;
		line-height: 1;
	}
	.btn.primary {
		background: var(--back-1);
		font-weight: 700;
	}

	.play {
		flex: 1;
		display: flex;
	}
	.play :global(.table-surface) {
		flex: 1;
	}

	.missing {
		flex: 1;
		display: grid;
		place-content: center;
		gap: 1rem;
		text-align: center;
	}

	.win {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.45);
		animation: fade 0.3s var(--ease-out);
	}
	.win-card {
		background: var(--card-bg);
		color: var(--card-ink-black);
		border-radius: 1rem;
		padding: 1.75rem 2rem;
		text-align: center;
		display: grid;
		gap: 1rem;
		box-shadow: var(--card-shadow-lift);
	}
	.win-card h2 {
		margin: 0;
		font-size: 1.5rem;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	.overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.45);
		animation: fade 0.2s var(--ease-out);
		z-index: 10;
	}
	.sheet {
		background: var(--card-bg);
		color: var(--card-ink-black);
		border-radius: 1rem;
		padding: 1.5rem 1.6rem;
		max-width: 30rem;
		width: 100%;
		box-shadow: var(--card-shadow-lift);
	}
	.sheet h2 {
		margin: 0 0 0.75rem;
		font-size: 1.2rem;
	}
	.sheet ul {
		margin: 0 0 1.25rem;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.4rem;
	}
	.sheet li {
		font-size: 0.95rem;
		line-height: 1.35;
	}
	.sheet-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		align-items: center;
	}
	.sheet-actions .btn.ghost {
		color: var(--card-ink-black);
		background: rgba(0, 0, 0, 0.06);
	}
</style>
