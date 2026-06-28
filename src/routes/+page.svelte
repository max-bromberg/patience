<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { dailyFor, type DailyInfo } from '$lib/daily';
	import type { GameMeta } from '$lib/engine';
	import { makeCard } from '$lib/engine';
	import { catalog, getGame } from '$lib/games/registry';
	import { pickQuote, type Quote } from '$lib/quotes';
	import CardView from '$lib/render/CardView.svelte';
	import GameIcon from '$lib/render/GameIcon.svelte';
	import StatsSheet from '$lib/render/StatsSheet.svelte';
	import { ambience } from '$lib/render/music';
	import { FACES } from '$lib/theme/faces';
	import { THEMES } from '$lib/theme/themes';
	import { VIBES } from '$lib/theme/vibes';
	import { daily } from '$lib/storage/daily.svelte';
	import { settings } from '$lib/storage/settings.svelte';
	import { stats } from '$lib/storage/stats.svelte';

	const sampleCard = makeCard('hearts', 1, { faceUp: true });

	let showStats = $state(false);

	// Jump straight into a random game from the whole catalog.
	function randomGame() {
		const pick = catalog[Math.floor(Math.random() * catalog.length)];
		goto(resolve(`/play/${pick.id}`));
	}

	// "Continue" the most recently opened game, if any (catalog covers every kind).
	const lastGame = $derived(
		stats.lastPlayed ? catalog.find((m) => m.id === stats.lastPlayed) : undefined
	);

	// Toggle music from a user gesture so the AudioContext is allowed to start.
	function toggleMusic() {
		settings.toggleMusic();
		if (settings.music) ambience.start();
		else ambience.stop();
	}

	// Group the catalog by family (e.g. 'builder') for sectioned browsing.
	// The catalog is a build-time constant, so this is computed once.
	function groupByFamily(metas: readonly GameMeta[]): [string, GameMeta[]][] {
		const groups: [string, GameMeta[]][] = [];
		for (const meta of metas) {
			const found = groups.find(([family]) => family === meta.family);
			if (found) found[1].push(meta);
			else groups.push([meta.family, [meta]]);
		}
		return groups;
	}
	const groups = groupByFamily(catalog);

	const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

	let showSettings = $state(false);

	// Daily challenge is date-dependent, so compute it on the client (after mount)
	// to use the player's local date and avoid a prerender/hydration mismatch:
	// `mounted` stays false through SSR and the first client render, then flips.
	let mounted = $state(false);
	// A fresh card-wisdom quote each visit. Chosen after mount so SSR and the
	// first client render agree (Math.random would otherwise mismatch).
	let quote = $state<Quote | null>(null);
	onMount(() => {
		mounted = true;
		quote = pickQuote();
	});
	const dailyInfo: DailyInfo | null = $derived(
		mounted
			? dailyFor(
					new Date(),
					catalog.map((m) => m.id)
				)
			: null
	);
	const dailyMeta = $derived(dailyInfo ? getGame(dailyInfo.gameId)?.definition.meta : undefined);
	const dailyDone = $derived(dailyInfo ? daily.isCompleted(dailyInfo.key) : false);
	const dailyHref = $derived(
		dailyInfo ? `${resolve(`/play/${dailyInfo.gameId}`)}?seed=${dailyInfo.seed}&daily=1` : '#'
	);
</script>

<svelte:head>
	<title>Patience · cozy card games</title>
	<meta name="description" content="A cozy collection of single-player card games." />
</svelte:head>

<main class="home">
	<div class="top-actions">
		<button class="round" onclick={() => (showStats = true)} aria-label="Stats" title="Your stats">
			📊
		</button>
		<button
			class="round"
			onclick={() => (showSettings = true)}
			aria-label="Settings"
			title="Settings"
		>
			⚙
		</button>
	</div>
	<div class="shell">
		<header class="hero">
			<div class="logo" aria-hidden="true">
				<span class="pip a">🂡</span><span class="pip b">🂾</span><span class="pip c">🃞</span>
			</div>
			<h1>Patience</h1>
			<p class="tagline">A cozy collection of single-player card games.</p>
			<figure class="quote" class:show={quote !== null}>
				{#if quote}
					<blockquote>“{quote.text}”</blockquote>
					<figcaption>— {quote.author}</figcaption>
				{/if}
			</figure>
		</header>

		{#if dailyInfo && dailyMeta}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- dailyHref is built with resolve() -->
			<a class="daily" href={dailyHref}>
				<div class="daily-main">
					<span class="kicker">Daily Challenge</span>
					<span class="daily-game">{dailyMeta.name}</span>
					<span class="daily-sub">
						{dailyDone ? 'Done today — play again' : "Today's deal, same for everyone"}
					</span>
				</div>
				<div class="daily-side">
					{#if daily.streak > 0}
						<span class="flame">🔥 {daily.streak}</span>
						<span class="flame-label">day streak</span>
					{/if}
					<span class="daily-cta">{dailyDone ? '✓' : 'Play ›'}</span>
				</div>
			</a>
		{/if}

		<div class="quick">
			<button class="qbtn" onclick={randomGame}>🎲 Random game</button>
			{#if lastGame}
				<a class="qbtn" href={resolve(`/play/${lastGame.id}`)}>↩ Continue {lastGame.name}</a>
			{/if}
		</div>

		{#each groups as [family, metas] (family)}
			<section class="family">
				<h2>{titleCase(family)}</h2>
				<ul class="grid">
					{#each metas as meta, i (meta.id)}
						<li style="--d:{i}">
							<a class="tile" href={resolve(`/play/${meta.id}`)}>
								<span class="art"><GameIcon id={meta.id} /></span>
								<span class="text">
									<span class="name">{meta.name}</span>
									<span class="blurb">{meta.blurb}</span>
								</span>
								<span class="pill {meta.difficulty}">{meta.difficulty}</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}

		<footer class="foot">More games dealing soon.</footer>
	</div>

	{#if showSettings}
		<div
			class="overlay"
			role="button"
			tabindex="-1"
			onclick={(e) => e.target === e.currentTarget && (showSettings = false)}
			onkeydown={(e) => e.key === 'Escape' && (showSettings = false)}
		>
			<div class="sheet" role="dialog" aria-label="Settings">
				<h2>Settings</h2>

				<div class="sheet-body">
					<section>
						<h3>Table theme</h3>
						<div class="swatches">
							{#each THEMES as t (t.id)}
								<button
									class="swatch"
									class:selected={settings.theme === t.id}
									style:background={t.swatch}
									onclick={() => (settings.theme = t.id)}
									aria-label={t.name}
									aria-pressed={settings.theme === t.id}
								>
									{#if settings.theme === t.id}<span class="check">✓</span>{/if}
								</button>
							{/each}
							<button
								class="swatch custom"
								class:selected={settings.theme === 'custom'}
								onclick={() => (settings.theme = 'custom')}
								aria-label="Custom colors"
								aria-pressed={settings.theme === 'custom'}
							>
								{#if settings.theme === 'custom'}<span class="check">✓</span>{:else}<span
										class="plus">🎨</span
									>{/if}
							</button>
						</div>

						{#if settings.theme === 'custom'}
							<div class="custom-colors">
								<label>
									<span>Felt</span>
									<input
										type="color"
										value={settings.custom.felt}
										oninput={(e) => settings.setCustom({ felt: e.currentTarget.value })}
									/>
								</label>
								<label>
									<span>Card back</span>
									<input
										type="color"
										value={settings.custom.back}
										oninput={(e) => settings.setCustom({ back: e.currentTarget.value })}
									/>
								</label>
								<label>
									<span>Accent</span>
									<input
										type="color"
										value={settings.custom.accent}
										oninput={(e) => settings.setCustom({ accent: e.currentTarget.value })}
									/>
								</label>
							</div>
						{/if}
					</section>

					<section>
						<h3>Card face</h3>
						<div class="faces">
							{#each FACES as f (f.id)}
								<button
									class="face-opt"
									class:selected={settings.face === f.id}
									onclick={() => (settings.face = f.id)}
									aria-label={f.name}
									aria-pressed={settings.face === f.id}
								>
									<span class="face-prev" data-face={f.id}>
										<CardView card={sampleCard} w={40} h={56} />
									</span>
									<span class="face-name">{f.name}</span>
								</button>
							{/each}
						</div>
					</section>

					<section>
						<h3>Vibes</h3>
						<div class="vibes-list">
							{#each VIBES as v (v.id)}
								<button
									class="vibe-chip"
									class:on={settings.vibe(v.id)}
									onclick={() => settings.toggleVibe(v.id)}
									aria-pressed={settings.vibe(v.id)}
									title={v.description}
								>
									<span class="vibe-emoji">{v.emoji}</span>{v.name}
								</button>
							{/each}
						</div>
					</section>

					<section class="row">
						<h3>Sound</h3>
						<button
							class="toggle"
							class:on={settings.sound}
							onclick={() => settings.toggleSound()}
							role="switch"
							aria-checked={settings.sound}
							aria-label="Sound effects"
						>
							<span class="knob"></span>
						</button>
					</section>

					<section>
						<div class="row">
							<h3>Background music</h3>
							<button
								class="toggle"
								class:on={settings.music}
								onclick={toggleMusic}
								role="switch"
								aria-checked={settings.music}
								aria-label="Background music"
							>
								<span class="knob"></span>
							</button>
						</div>
						{#if settings.music}
							<label class="volume">
								<span>Volume</span>
								<input
									type="range"
									min="0"
									max="1"
									step="0.05"
									value={settings.musicVolume}
									oninput={(e) => {
										settings.musicVolume = Number(e.currentTarget.value);
										ambience.setVolume(settings.musicVolume);
									}}
								/>
							</label>
						{/if}
					</section>
				</div>

				<div class="sheet-actions">
					<button class="done" onclick={() => (showSettings = false)}>Done</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showStats}
		<StatsSheet onClose={() => (showStats = false)} />
	{/if}
</main>

<style>
	.home {
		min-height: 100dvh;
		background: var(--table-bg);
		background-blend-mode: var(--table-blend);
		color: var(--ui-text);
		font-family: var(--font-rounded);
		padding: calc(1.5rem + env(safe-area-inset-top)) clamp(1.1rem, 4vw, 3rem)
			calc(2rem + env(safe-area-inset-bottom));
		box-sizing: border-box;
	}

	.shell {
		max-width: 1180px;
		margin: 0 auto;
	}

	.hero {
		text-align: center;
		margin-bottom: 1.75rem;
	}
	.logo {
		font-size: clamp(2.75rem, 14vw, 4rem);
		line-height: 1;
		filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.35));
	}
	.logo .pip {
		display: inline-block;
		color: #fffdf8;
	}
	.logo .a {
		transform: rotate(-12deg) translateY(4px);
	}
	.logo .b {
		transform: translateY(-6px);
		margin: 0 -0.35em;
	}
	.logo .c {
		transform: rotate(12deg) translateY(4px);
	}
	h1 {
		margin: 0.4rem 0 0;
		font-size: clamp(2.25rem, 11vw, 3.25rem);
		font-weight: 800;
		letter-spacing: -0.02em;
		text-shadow: 0 2px 0 rgba(0, 0, 0, 0.18);
	}
	.tagline {
		margin: 0.2rem 0 0;
		color: var(--ui-muted);
		font-size: clamp(0.95rem, 4vw, 1.1rem);
	}

	.quote {
		margin: 0.9rem auto 0;
		max-width: 32rem;
		min-height: 2.6rem;
		opacity: 0;
		transition: opacity 0.5s var(--ease-out);
	}
	.quote.show {
		opacity: 1;
	}
	.quote blockquote {
		margin: 0;
		font-size: clamp(0.9rem, 3.6vw, 1.02rem);
		font-style: italic;
		line-height: 1.4;
		color: var(--ui-text);
	}
	.quote figcaption {
		margin-top: 0.25rem;
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--drop-ring);
	}

	.daily {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
		padding: 1rem 1.25rem;
		border-radius: 1rem;
		text-decoration: none;
		color: inherit;
		background: linear-gradient(120deg, rgba(201, 154, 58, 0.28), rgba(0, 0, 0, 0.25));
		border: 1px solid rgba(255, 227, 154, 0.3);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
		transition: transform 0.16s var(--ease-out);
	}
	.daily:hover {
		transform: translateY(-2px);
	}
	.daily-main {
		display: grid;
		gap: 0.15rem;
	}
	.kicker {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--drop-ring);
		font-weight: 800;
	}
	.daily-game {
		font-size: 1.3rem;
		font-weight: 800;
	}
	.daily-sub {
		font-size: 0.85rem;
		color: var(--ui-muted);
	}
	.daily-side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
	}
	.flame {
		font-size: 1.15rem;
		font-weight: 800;
	}
	.flame-label {
		font-size: 0.7rem;
		color: var(--ui-muted);
	}
	.daily-cta {
		margin-top: 0.3rem;
		font-weight: 700;
		color: var(--drop-ring);
	}

	.family h2 {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--ui-muted);
		margin: 1.25rem 0 0.6rem;
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.6rem;
	}

	.tile {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto auto;
		align-items: center;
		column-gap: 0.6rem;
		row-gap: 0.3rem;
		height: 100%;
		padding: 0.7rem 0.75rem;
		border-radius: 0.9rem;
		background: var(--tile-bg);
		border: 1px solid var(--tile-border);
		color: inherit;
		text-decoration: none;
		box-shadow: 0 3px 10px rgba(0, 0, 0, 0.16);
		transition:
			transform 0.16s var(--ease-out),
			background 0.16s var(--ease-out);
		animation: tile-in 0.4s var(--ease-out) backwards;
		animation-delay: calc(var(--d, 0) * 40ms);
	}
	@keyframes tile-in {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.98);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.tile {
			animation: none;
		}
	}
	.tile:hover {
		transform: translateY(-3px);
		background: var(--tile-bg-hover);
	}
	.tile:active {
		transform: translateY(-1px);
	}

	.art {
		grid-row: 1 / span 2;
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
	}
	.text {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.name {
		font-weight: 700;
		font-size: 0.98rem;
		line-height: 1.15;
	}
	.blurb {
		font-size: 0.74rem;
		color: var(--ui-muted);
		line-height: 1.25;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.pill {
		grid-column: 2;
		justify-self: start;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.12rem 0.45rem;
		border-radius: 999px;
		font-weight: 700;
	}
	.pill.easy {
		background: #2f7d57;
		color: #eafff1;
	}
	.pill.medium {
		background: #c79a3a;
		color: #2b2208;
	}
	.pill.hard {
		background: #c8324a;
		color: #fff0f2;
	}

	.foot {
		text-align: center;
		color: var(--ui-muted);
		font-size: 0.85rem;
		margin-top: 2rem;
		font-style: italic;
	}

	.top-actions {
		position: fixed;
		top: calc(0.75rem + env(safe-area-inset-top));
		right: 0.9rem;
		z-index: 5;
		display: flex;
		gap: 0.4rem;
	}
	.round {
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 999px;
		border: none;
		background: var(--ui-surface);
		color: var(--ui-text);
		font-size: 1.05rem;
		cursor: pointer;
		line-height: 1;
		display: grid;
		place-items: center;
	}
	.round:hover {
		background: var(--ui-surface-hover);
	}

	.quick {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.qbtn {
		font-family: inherit;
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--ui-text);
		background: var(--ui-surface);
		border: 1px solid var(--tile-border);
		border-radius: 999px;
		padding: 0.5rem 1rem;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s var(--ease-out);
	}
	.qbtn:hover {
		background: var(--ui-surface-hover);
	}

	.volume {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.7rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: #6a6a72;
	}
	.volume input[type='range'] {
		flex: 1;
		accent-color: var(--felt-1);
	}

	.overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.5);
		z-index: 50;
	}
	.sheet {
		background: var(--card-bg);
		color: var(--card-ink-black);
		border-radius: 1rem;
		padding: 1.25rem 1.4rem;
		width: 100%;
		max-width: 26rem;
		max-height: calc(100dvh - 1.5rem);
		box-shadow: var(--card-shadow-lift);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		overflow: hidden;
	}
	.sheet-body {
		display: grid;
		gap: 1.1rem;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		/* room for the scrollbar / fade so content doesn't hug the edge */
		padding-right: 0.3rem;
		margin-right: -0.3rem;
	}
	.sheet h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	.sheet h3 {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6a6a72;
	}
	.swatches {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.swatch {
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 0.7rem;
		border: 2px solid rgba(0, 0, 0, 0.12);
		cursor: pointer;
		display: grid;
		place-items: center;
		color: #fff;
		font-weight: 800;
		box-shadow: inset 0 -6px 10px rgba(0, 0, 0, 0.18);
	}
	.swatch.selected {
		border-color: var(--card-ink-black);
		outline: 2px solid var(--card-ink-black);
		outline-offset: 1px;
	}
	.swatch.custom {
		background: conic-gradient(from 0deg, #ff4d6d, #ffd166, #06d6a0, #4cc9f0, #b388ff, #ff4d6d);
	}
	.swatch .plus {
		font-size: 1.1rem;
	}

	.custom-colors {
		display: flex;
		gap: 1.25rem;
		margin-top: 0.9rem;
	}
	.custom-colors label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.custom-colors input[type='color'] {
		width: 2.4rem;
		height: 2rem;
		border: 1px solid rgba(0, 0, 0, 0.15);
		border-radius: 0.5rem;
		background: none;
		cursor: pointer;
		padding: 0;
	}

	.faces {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(54px, 1fr));
		gap: 0.6rem;
	}
	.face-opt {
		display: grid;
		justify-items: center;
		gap: 0.25rem;
		padding: 0.4rem 0.2rem;
		border-radius: 0.6rem;
		border: 2px solid transparent;
		background: none;
		cursor: pointer;
	}
	.face-opt.selected {
		border-color: var(--felt-1);
		background: rgba(0, 0, 0, 0.04);
	}
	.face-prev {
		display: block;
		line-height: 0;
	}
	.face-name {
		font-size: 0.68rem;
		color: #6a6a72;
		font-weight: 600;
	}

	.vibes-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.vibe-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.4rem 0.7rem;
		border-radius: 999px;
		border: 1.5px solid rgba(0, 0, 0, 0.14);
		background: #f3f1ea;
		color: #6a6a72;
		cursor: pointer;
		transition:
			background 0.15s var(--ease-out),
			color 0.15s var(--ease-out),
			border-color 0.15s var(--ease-out);
	}
	.vibe-chip.on {
		background: var(--felt-1);
		border-color: var(--felt-1);
		color: #fff;
	}
	.vibe-emoji {
		font-size: 0.95rem;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.row h3 {
		margin: 0;
	}
	.toggle {
		width: 3.2rem;
		height: 1.8rem;
		border-radius: 999px;
		border: none;
		background: #cfcfd6;
		position: relative;
		cursor: pointer;
		transition: background 0.16s var(--ease-out);
	}
	.toggle.on {
		background: var(--felt-1);
	}
	.toggle .knob {
		position: absolute;
		top: 0.2rem;
		left: 0.2rem;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 999px;
		background: #fff;
		transition: transform 0.16s var(--ease-out);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}
	.toggle.on .knob {
		transform: translateX(1.4rem);
	}
	.sheet-actions {
		display: flex;
		justify-content: flex-end;
		flex: none;
		padding-top: 0.8rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
	}
	.done {
		font-family: inherit;
		background: var(--back-1);
		color: #fff;
		font-weight: 700;
		border: none;
		border-radius: 999px;
		padding: 0.5rem 1.2rem;
		cursor: pointer;
	}
</style>
