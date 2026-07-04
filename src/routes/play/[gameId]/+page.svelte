<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { dateKey, previousKey } from '$lib/daily';
	import { getGame } from '$lib/games/registry';
	import { resolveMood } from '$lib/audio/resolve';
	import { GameController, Icon, Table } from '$lib/render';
	import { pickWinnableSeed, supportsWinnable } from '$lib/games/winnable';
	import { ambience } from '$lib/render/music';
	import Confetti from '$lib/render/Confetti.svelte';
	import ShareButton from '$lib/render/ShareButton.svelte';
	import { buildShareText, SITE } from '$lib/share';
	import { sfx } from '$lib/render/sound';
	import { haptics } from '$lib/render/haptics';
	import { achievements } from '$lib/storage/achievements.svelte';
	import { daily } from '$lib/storage/daily.svelte';
	import { clearProgress, loadProgress, saveProgress } from '$lib/storage/resume';
	import { settings } from '$lib/storage/settings.svelte';
	import { stats } from '$lib/storage/stats.svelte';
	import {
		AiTableController,
		EuchreController,
		EuchreTable,
		TrickTable,
		getTrickGame
	} from '$lib/trick';

	const gameId = $derived(page.params.gameId);
	const game = $derived(getGame(gameId ?? ''));
	// Trick-taking games (Euchre family) use a separate engine + UI.
	const trick = $derived(getTrickGame(gameId ?? ''));
	const meta = $derived(game?.definition.meta ?? trick?.meta);

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

	// "Winnable deals only": when the setting is on and this game has a solver,
	// search forward from a random seed for one proven winnable, else fall back to
	// it. Solitaire casual/new deals only — never a shared `?seed=` or the daily.
	// Read the setting untracked so flipping it never redeals the current hand.
	function solitaireSeed(): number {
		const requested = freshSeed();
		return untrack(() => {
			if (settings.winnable && game && supportsWinnable(game.definition.meta.id)) {
				return pickWinnableSeed(game, requested).seed;
			}
			return requested;
		});
	}

	// Controller for the current game. A `?seed=` always deals that exact seed;
	// otherwise resume the saved casual game for this id, or deal fresh.
	let controller = $derived.by(() => {
		if (!game || gameId === undefined) return null;
		if (urlSeed !== null) return new GameController(game, urlSeed);
		const saved = loadProgress(gameId);
		if (saved) {
			try {
				return GameController.restore(game, saved);
			} catch {
				clearProgress(gameId);
			}
		}
		return new GameController(game, solitaireSeed());
	});

	// Trick-taking controllers. Recreated only when the game id or url seed
	// changes; a `{#key}` around the table disposes the old timer. Euchre uses its
	// bespoke engine; everything else is a generic 52-card AiCardGame.
	let euchre = $derived.by(() => {
		if (!trick || trick.kind !== 'euchre' || gameId === undefined) return null;
		return new EuchreController(urlSeed ?? freshSeed(), trick.variant);
	});
	let aiGame = $derived.by(() => {
		if (!trick || trick.kind !== 'ai' || !trick.game || gameId === undefined) return null;
		return new AiTableController(trick.game, urlSeed ?? freshSeed());
	});

	// Persist the casual game after every change; clear it once won. Reading
	// moveCount + seed makes this re-run on apply/undo/new-deal.
	$effect(() => {
		if (!controller || urlSeed !== null || gameId === undefined) return;
		const _track = controller.moveCount + controller.seed;
		void _track;
		if (controller.won) clearProgress(gameId);
		else saveProgress(gameId, controller.snapshot());
	});

	const won = $derived(controller?.won ?? false);

	// Ambience: match the mood to this game (honoring the Settings pick), and let
	// it breathe with how the game's going — brighter as you close on a win,
	// quieter when you're stuck.
	$effect(() => {
		ambience.setMood(resolveMood(gameId));
	});
	$effect(() => {
		let intensity = 0.45;
		if (controller) {
			intensity = controller.won ? 1 : controller.stuck ? 0.12 : 0.3 + 0.6 * controller.progress;
		} else if (euchre) {
			intensity = euchre.state.phase === 'gameOver' ? (euchre.state.winner === 0 ? 1 : 0.15) : 0.5;
		} else if (aiGame) {
			const v = aiGame.view;
			intensity = v.phase === 'gameOver' ? (v.winnerLabel?.startsWith('You') ? 1 : 0.15) : 0.5;
		}
		ambience.setIntensity(intensity);
	});

	const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

	// Win-streak celebration toast. Set when a win is recorded; auto-dismisses.
	let streakToast = $state<{ streak: number; milestone: boolean } | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	function celebrate(id: string) {
		const streak = stats.forGame(id).streak;
		if (streak < 2) return;
		const milestone = streak === 3 || streak === 5 || streak % 10 === 0;
		streakToast = { streak, milestone };
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (streakToast = null), 3800);
	}

	// Local stats. Mark the game as last-played when opened, and record one
	// result per concluded deal/game (guard flags reset when a new game starts).
	$effect(() => {
		if (gameId !== undefined) stats.touch(gameId);
	});

	// Per-deal stopwatch (for solitaire fastest-win records); reset each new deal.
	let startedAt = $state(0);
	$effect(() => {
		void controller?.seed;
		void euchre;
		void aiGame;
		void gameId;
		startedAt = now();
		streakToast = null;
	});

	let solRecorded = false;
	let solTimeMs = $state(0); // final elapsed time of the last solitaire win (for sharing)
	$effect(() => {
		if (!controller || gameId === undefined) return;
		if (controller.won) {
			if (!solRecorded) {
				solTimeMs = Math.round(now() - startedAt);
				stats.record(gameId, true, {
					moves: controller.moveCount,
					timeMs: solTimeMs
				});
				achievements.recordResult({
					gameId,
					family: meta?.family ?? '',
					won: true,
					moves: controller.moveCount,
					timeMs: solTimeMs
				});
				solRecorded = true;
				celebrate(gameId);
			}
		} else if (controller.stuck) {
			if (!solRecorded) {
				stats.record(gameId, false);
				achievements.recordResult({ gameId, family: meta?.family ?? '', won: false });
				solRecorded = true;
			}
		} else solRecorded = false;
	});
	let euchreRecorded = false;
	$effect(() => {
		if (!euchre || gameId === undefined) return;
		if (euchre.state.phase === 'gameOver') {
			if (!euchreRecorded) {
				const win = euchre.state.winner === 0;
				stats.record(gameId, win);
				achievements.recordResult({ gameId, family: meta?.family ?? '', won: win });
				euchreRecorded = true;
				if (win) celebrate(gameId);
			}
		} else euchreRecorded = false;
	});
	let aiRecorded = false;
	$effect(() => {
		if (!aiGame || gameId === undefined) return;
		const v = aiGame.view;
		if (v.phase === 'gameOver') {
			if (!aiRecorded) {
				const win = v.winnerLabel?.startsWith('You') ?? false;
				stats.record(gameId, win);
				achievements.recordResult({ gameId, family: meta?.family ?? '', won: win });
				aiRecorded = true;
				if (win) celebrate(gameId);
			}
		} else aiRecorded = false;
	});

	// On win: fanfare once, and record the daily streak if this is the untouched
	// daily deal (controller seed still equals the daily seed — a "new deal" breaks it).
	let celebrated = false;
	$effect(() => {
		if (won && !celebrated) {
			celebrated = true;
			sfx.win();
			haptics.win();
			if (isDaily && controller && controller.seed === urlSeed) {
				const now = new Date();
				daily.complete(dateKey(now), previousKey(now));
				achievements.refresh(); // daily streak may have hit a badge threshold
			}
		} else if (!won) {
			celebrated = false;
		}
	});

	// Auto-finish cascade: step one foundation move at a time for a visible flourish.
	let autoTimer = $state<ReturnType<typeof setInterval> | null>(null);
	function stopAuto() {
		if (autoTimer) clearInterval(autoTimer);
		autoTimer = null;
	}
	function autoFinish() {
		if (autoTimer || !controller) return;
		autoTimer = setInterval(() => {
			if (!controller || !controller.autoStep()) stopAuto();
		}, 110);
	}
	// Stop the cascade when the deal/game changes.
	$effect(() => {
		void gameId;
		void controller?.seed;
		return stopAuto;
	});

	// Wordle-style shareable result blurb, built once a game concludes. Solitaire
	// links carry the seed so a friend can play the exact same deal.
	const solShareText = $derived.by(() => {
		if (!controller || gameId === undefined || !meta) return null;
		if (!controller.won && !controller.stuck) return null;
		const url = `${SITE}/play/${gameId}?seed=${controller.seed}${isDaily ? '&daily=1' : ''}`;
		return buildShareText({
			type: 'solitaire',
			name: meta.name,
			gameId,
			url,
			won: controller.won,
			moves: controller.moveCount,
			timeMs: controller.won ? solTimeMs : undefined,
			daily: isDaily,
			streak: daily.streak
		});
	});

	const trickShareText = $derived.by(() => {
		if (gameId === undefined || !meta) return null;
		if (euchre && euchre.state.phase === 'gameOver') {
			const sc = euchre.state.scores;
			const scores = sc.map((value, i) => ({
				label: i === 0 ? 'You' : sc.length === 2 ? 'Them' : `Team ${i + 1}`,
				value,
				you: i === 0
			}));
			return buildShareText({
				type: 'trick',
				name: meta.name,
				gameId,
				url: `${SITE}/play/${gameId}?seed=${euchre.seed}`,
				won: euchre.state.winner === 0,
				scores
			});
		}
		if (aiGame && aiGame.view.phase === 'gameOver') {
			const v = aiGame.view;
			return buildShareText({
				type: 'trick',
				name: meta.name,
				gameId,
				url: `${SITE}/play/${gameId}?seed=${aiGame.seed}`,
				won: v.winnerLabel?.startsWith('You') ?? false,
				scores: v.scoreboard.map((s) => ({ label: s.label, value: s.value, you: s.you }))
			});
		}
		return null;
	});

	/** Deal a fresh game for whichever controller is active. */
	function newDealActive() {
		if (controller) controller.newDeal(solitaireSeed());
		else if (euchre) euchre.newDeal(freshSeed());
		else if (aiGame) aiGame.newDeal(freshSeed());
	}

	// Keyboard shortcuts: N = new deal (any game), U = undo (solitaire only).
	onMount(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const t = e.target as HTMLElement | null;
			if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
			const k = e.key.toLowerCase();
			if (k === 'n') {
				newDealActive();
				e.preventDefault();
			} else if (k === 'u' && controller?.canUndo) {
				controller.undo();
				e.preventDefault();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('keydown', onKey);
			if (toastTimer) clearTimeout(toastTimer);
		};
	});
</script>

<svelte:head>
	<title>{meta ? `${meta.name} · Patience` : 'Play · Patience'}</title>
	{#if meta}
		<meta name="description" content="Play {meta.name} free in your browser — {meta.blurb}" />
		<meta property="og:title" content="{meta.name} · Patience" />
		<meta property="og:description" content={meta.blurb} />
	{/if}
</svelte:head>

<div class="screen">
	<header class="bar">
		<a class="tool" href={resolve('/')} aria-label="Back to catalog" title="Back to catalog">
			<Icon name="back" />
		</a>
		<span class="title">
			{meta?.name ?? 'Game'}
			{#if isDaily}<span class="badge">Daily</span>{/if}
		</span>
		<div class="actions">
			{#if controller}
				{#if controller.canAutoFinish && !won}
					<button
						class="tool primary-tool"
						onclick={autoFinish}
						disabled={autoTimer !== null}
						aria-label="Auto-finish"
						title="Auto-finish"
					>
						<Icon name="auto" />
					</button>
				{/if}
				<button
					class="tool"
					onclick={() => controller.undo()}
					disabled={!controller.canUndo}
					aria-label="Undo"
					title="Undo"
				>
					<Icon name="undo" />
				</button>
				<button
					class="tool"
					onclick={() => controller.newDeal(solitaireSeed())}
					aria-label="New deal"
					title="New deal"
				>
					<Icon name="deal" />
				</button>
			{:else if euchre}
				<button
					class="tool"
					onclick={() => euchre.newDeal(freshSeed())}
					aria-label="New game"
					title="New game"
				>
					<Icon name="deal" />
				</button>
			{:else if aiGame}
				<button
					class="tool"
					onclick={() => aiGame.newDeal(freshSeed())}
					aria-label="New game"
					title="New game"
				>
					<Icon name="deal" />
				</button>
			{/if}
			<button
				class="tool"
				onclick={() => settings.toggleSound()}
				aria-label={settings.sound ? 'Mute sound' : 'Unmute sound'}
				aria-pressed={settings.sound}
				title={settings.sound ? 'Mute sound' : 'Unmute sound'}
			>
				<Icon name={settings.sound ? 'sound-on' : 'sound-off'} />
			</button>
			{#if meta?.howTo}
				<button
					class="tool"
					onclick={() => (showHelp = true)}
					aria-label="How to play"
					title="How to play"
				>
					<Icon name="help" />
				</button>
			{/if}
		</div>
	</header>

	{#if euchre}
		<div class="play">
			{#key euchre}
				<EuchreTable controller={euchre} />
			{/key}
		</div>
	{:else if aiGame}
		<div class="play">
			{#key aiGame}
				<TrickTable controller={aiGame} />
			{/key}
		</div>
	{:else if !game}
		<div class="missing">
			<p>No game called “{gameId}”.</p>
			<a class="btn" href={resolve('/')}>Back to catalog</a>
		</div>
	{:else if controller}
		<div class="play">
			<Table {controller} />
		</div>

		{#if won}
			<Confetti />
			<div class="win" role="status">
				<div class="win-card">
					<h2>You won! 🎉</h2>
					{#if isDaily}
						<p class="streak">Daily streak: 🔥 {daily.streak}</p>
					{/if}
					<div class="win-actions">
						{#if solShareText}
							<ShareButton text={solShareText} variant="light" />
						{/if}
						<button class="btn primary" onclick={() => controller.newDeal(solitaireSeed())}>
							Play again
						</button>
					</div>
				</div>
			</div>
		{:else if controller.stuck}
			<div class="stuck" role="status">
				<span>No moves left.</span>
				{#if solShareText}
					<ShareButton text={solShareText} variant="dark" label="Share" />
				{/if}
				<button class="btn" onclick={() => controller.undo()} disabled={!controller.canUndo}>
					Undo
				</button>
				<button class="btn primary" onclick={() => controller.newDeal(solitaireSeed())}
					>New deal</button
				>
			</div>
		{/if}
	{/if}

	{#if trickShareText}
		<div class="share-dock">
			<ShareButton text={trickShareText} variant="dark" />
		</div>
	{/if}

	{#if streakToast}
		{#if streakToast.milestone}<Confetti />{/if}
		<div class="streak-toast" class:milestone={streakToast.milestone} role="status">
			<span class="flame">🔥</span>
			<span class="streak-text"
				>{streakToast.streak} wins in a row{streakToast.milestone ? ' — on fire!' : '!'}</span
			>
		</div>
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
				<p class="shortcuts">
					Shortcuts: <kbd>N</kbd> new {game ? 'deal' : 'game'}{#if game}
						· <kbd>U</kbd> undo{/if}
				</p>
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
		padding-left: max(0.75rem, env(safe-area-inset-left));
		padding-right: max(0.75rem, env(safe-area-inset-right));
		/* keep controls above the absolutely-positioned card layer */
		position: relative;
		z-index: 6000;
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
		gap: 0.3rem;
	}

	/* Unified circular icon buttons for the top bar. */
	.tool {
		width: 2.3rem;
		height: 2.3rem;
		flex: 0 0 auto;
		display: inline-grid;
		place-items: center;
		border-radius: 999px;
		border: none;
		background: var(--ui-surface);
		color: var(--ui-text);
		cursor: pointer;
		text-decoration: none;
		transition:
			background 0.14s var(--ease-out),
			transform 0.1s var(--ease-out);
		-webkit-tap-highlight-color: transparent;
	}
	.tool:hover {
		background: var(--ui-surface-hover);
	}
	.tool:active {
		transform: scale(0.92);
	}
	.tool:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.tool.primary-tool {
		background: var(--drop-ring);
		color: #2b2208;
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
	.btn.primary {
		background: var(--back-1);
		font-weight: 700;
	}

	.stuck {
		position: fixed;
		left: 50%;
		bottom: calc(1rem + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		max-width: calc(100vw - 1.5rem);
		gap: 0.6rem;
		padding: 0.6rem 0.9rem;
		border-radius: 1.4rem;
		background: rgba(0, 0, 0, 0.72);
		color: var(--ui-text);
		box-shadow: var(--card-shadow-lift);
		z-index: 4000;
		animation: fade 0.3s var(--ease-out);
		font-size: 0.9rem;
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
	.win-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	/* Floating share affordance for concluded trick games (their game-over panel
	   is centered, so this sits clear of it at the bottom). */
	.share-dock {
		position: fixed;
		left: 50%;
		bottom: calc(1rem + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		z-index: 4000;
		animation: fade 0.3s var(--ease-out);
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

	.shortcuts {
		margin: 0 0 1rem;
		font-size: 0.78rem;
		color: #6a6a72;
	}
	.shortcuts kbd {
		font-family: inherit;
		font-size: 0.72rem;
		font-weight: 800;
		background: rgba(0, 0, 0, 0.08);
		border-radius: 0.35rem;
		padding: 0.05rem 0.4rem;
		border: 1px solid rgba(0, 0, 0, 0.12);
	}

	/* Win-streak celebration toast */
	.streak-toast {
		position: fixed;
		top: calc(3.5rem + env(safe-area-inset-top));
		left: 50%;
		transform: translateX(-50%);
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 1rem;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.78);
		color: #fff;
		font-weight: 800;
		font-size: 0.95rem;
		box-shadow: var(--card-shadow-lift);
		z-index: 5500;
		animation: toast-pop 0.35s var(--ease-out);
	}
	.streak-toast.milestone {
		background: linear-gradient(110deg, #c8324a, #e8893f);
		color: #fff;
	}
	.streak-toast .flame {
		font-size: 1.2rem;
		animation: flame-bob 0.7s ease-in-out infinite alternate;
	}
	@keyframes toast-pop {
		from {
			opacity: 0;
			transform: translate(-50%, -0.6rem) scale(0.9);
		}
	}
	@keyframes flame-bob {
		to {
			transform: translateY(-2px) scale(1.1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.streak-toast .flame {
			animation: none;
		}
	}
</style>
