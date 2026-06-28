<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { dateKey, previousKey } from '$lib/daily';
	import { getGame } from '$lib/games/registry';
	import { GameController, Table } from '$lib/render';
	import { sfx } from '$lib/render/sound';
	import { daily } from '$lib/storage/daily.svelte';
	import { settings } from '$lib/storage/settings.svelte';

	const gameId = $derived(page.params.gameId);
	const game = $derived(getGame(gameId ?? ''));
	const meta = $derived(game?.definition.meta);

	let showHelp = $state(false);

	// A `?seed=` makes a deal shareable/reproducible; `?daily=1` marks it as the
	// day's challenge (so winning the untouched daily deal counts toward a streak).
	const urlSeed = $derived.by(() => {
		const raw = page.url.searchParams.get('seed');
		if (raw === null) return null;
		const n = Number(raw);
		return Number.isFinite(n) ? n >>> 0 : null;
	});
	const isDaily = $derived(page.url.searchParams.get('daily') === '1');

	function freshSeed(): number {
		return Math.floor(Math.random() * 0x7fffffff);
	}

	// Fresh controller when the game id or the requested seed changes.
	let controller = $derived.by(() =>
		game ? new GameController(game, urlSeed ?? freshSeed()) : null
	);

	const won = $derived(controller?.won ?? false);

	// On win: fanfare once, and record the daily streak if this is the untouched
	// daily deal (controller seed still equals the daily seed — a "new deal" breaks it).
	let celebrated = false;
	$effect(() => {
		if (won && !celebrated) {
			celebrated = true;
			sfx.win();
			if (isDaily && controller && controller.seed === urlSeed) {
				const now = new Date();
				daily.complete(dateKey(now), previousKey(now));
			}
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
		<span class="title">
			{game?.definition.meta.name ?? 'Game'}
			{#if isDaily}<span class="badge">Daily</span>{/if}
		</span>
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
					{#if isDaily}
						<p class="streak">Daily streak: 🔥 {daily.streak}</p>
					{/if}
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
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.badge {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 800;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: var(--back-1);
		color: #fff;
	}
	.streak {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
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
		/* above the card layer, whose z-indexes climb into the thousands */
		z-index: 5000;
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
		z-index: 5000;
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
