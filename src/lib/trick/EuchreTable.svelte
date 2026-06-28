<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Card } from '$lib/engine';
	import { CardView } from '$lib/render';
	import { SUIT_GLYPH } from '$lib/render/display';
	import type { EuchreController } from './controller.svelte';

	let { controller }: { controller: EuchreController } = $props();

	const s = $derived(controller.state);
	onDestroy(() => controller.dispose());

	const SUIT_COLOR: Record<string, boolean> = {
		hearts: true,
		diamonds: true,
		spades: false,
		clubs: false
	};

	const variant = $derived(s.variant);
	const partners = $derived(variant.partners);
	// Seat 2 is your teammate only in the partnership game; elsewhere it's a rival.
	const seatName = $derived(
		partners ? ['You', 'West', 'Partner', 'East'] : ['You', 'West', 'North', 'East']
	);

	// Opponents are every active seat but the human (seat 0), laid out as a row.
	const opponents = $derived(
		Array.from({ length: variant.seats }, (_, i) => i).filter((seat) => seat !== 0)
	);

	const playable = $derived(controller.playableIds);
	const isHumanPlay = $derived(s.phase === 'playing' && s.turn === 0 && !controller.thinking);
	const isHumanDiscard = $derived(s.phase === 'discard' && s.dealer === 0);

	let alone = $state(false);

	function onHandCard(card: Card) {
		if (isHumanDiscard) controller.discard(card.id);
		else if (isHumanPlay && playable.includes(card.id)) controller.play(card.id);
	}

	// Scoreboard labels + values, one entry per team.
	const scoreboard = $derived.by(() => {
		if (partners) {
			return [
				{ label: 'You', value: s.scores[0] },
				{ label: 'Them', value: s.scores[1] }
			];
		}
		return s.scores.map((value, team) => ({
			label: team === 0 ? 'You' : seatName[team],
			value
		}));
	});

	const winnerLabel = $derived(
		s.winner === 0 ? 'You win! 🎉' : partners ? 'Opponents win' : `${seatName[s.winner ?? 0]} wins`
	);

	const trumpGlyph = $derived(s.trump ? SUIT_GLYPH[s.trump] : null);
	const trumpRed = $derived(s.trump ? SUIT_COLOR[s.trump] : false);

	// During the brief pause after a trick fills, `trick` is cleared and the
	// completed trick lives in `lastTrick` — keep showing it so it doesn't blink.
	const shownTrick = $derived(s.trick.length > 0 ? s.trick : (s.lastTrick ?? []));

	// Responsive scale: 1 on a phone (the dialed-in baseline), up to 1.85 on
	// desktop so the table fills the room instead of floating tiny in the centre.
	let feltW = $state(0);
	const scale = $derived(Math.min(1.85, Math.max(1, feltW / 460)));
	const px = (base: number) => Math.round(base * scale);
	const handW = $derived(px(58));
	const handH = $derived(px(82));
	const trickW = $derived(px(46));
	const trickH = $derived(px(65));
	const backW = $derived(px(30));
	const backH = $derived(px(42));
	// The up-card grows less than the rest so it stays clear of the bidding panel
	// that floats just below it on desktop (unchanged at mobile scale = 1).
	const upScale = $derived(Math.min(1.3, scale));
	const upW = $derived(Math.round(52 * upScale));
	const upH = $derived(Math.round(74 * upScale));
	const backOverlap = $derived(`${-Math.round(backW * 0.73)}px`);
	const handOverlap = $derived(`${-0.8 * scale}rem`);
</script>

<div class="felt" bind:clientWidth={feltW} style:--sc={scale}>
	<!-- Scoreboard + trump -->
	<div class="hud">
		<div class="score">
			{#each scoreboard as t, i (t.label)}
				{#if i > 0}<span class="sep">·</span>{/if}
				<span class="team" class:you={i === 0}>{t.label} {t.value}</span>
			{/each}
		</div>
		{#if s.trump}
			<div class="trump" class:red={trumpRed}>
				Trump <span class="glyph">{trumpGlyph}</span>
				{#if s.alone}<span class="alone">alone</span>{/if}
			</div>
		{/if}
	</div>

	<!-- Opponents: a row across the top so the layout never overflows on mobile. -->
	<div class="opponents">
		{#each opponents as seat (seat)}
			<div
				class="opp"
				class:active={s.turn === seat && controller.thinking}
				class:sitting={s.sitOut === seat}
			>
				<div class="seat-label">
					{seatName[seat]}
					{#if seat === s.dealer}<span class="deal-chip">D</span>{/if}
				</div>
				<div class="backs" style:--backov={backOverlap}>
					{#each s.hands[seat] as card (card.id)}
						<div class="back-slot">
							<CardView card={{ ...card, faceUp: false }} w={backW} h={backH} />
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<!-- Center: the current trick + up-card during bidding -->
	<div class="center">
		{#if s.upCard && (s.phase === 'bidding1' || s.phase === 'bidding2')}
			<div class="upcard" class:dim={s.phase === 'bidding2'}>
				<CardView card={s.upCard} w={upW} h={upH} />
				<span class="upcard-tag">{s.phase === 'bidding2' ? 'turned down' : 'up-card'}</span>
			</div>
		{:else if shownTrick.length > 0}
			<div class="trick">
				{#each shownTrick as play (play.player)}
					<div class="play" class:mine={play.player === 0}>
						<CardView card={play.card} w={trickW} h={trickH} />
						<span class="play-who">{play.player === 0 ? 'You' : seatName[play.player]}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Human hand -->
	<div class="you" class:active={s.turn === 0 && !controller.thinking}>
		<div class="hand" role="group" aria-label="Your hand" style:--ov={handOverlap}>
			{#each s.hands[0] as card (card.id)}
				{@const can = isHumanDiscard || (isHumanPlay && playable.includes(card.id))}
				<button
					class="hand-card"
					class:can
					class:dim={isHumanPlay && !playable.includes(card.id)}
					onclick={() => onHandCard(card)}
					disabled={!can}
					aria-label="{card.rank} of {card.suit}"
				>
					<CardView {card} w={handW} h={handH} />
				</button>
			{/each}
		</div>
		<div class="seat-label bottom">
			You
			{#if s.dealer === 0}<span class="deal-chip">D</span>{/if}
		</div>
	</div>

	<!-- Action log (last line) -->
	{#if s.log.length > 0}
		<div class="log" aria-live="polite">{s.log[s.log.length - 1]}</div>
	{/if}

	<!-- Decision panels -->
	{#if s.turn === 0 && s.phase === 'bidding1'}
		<div class="panel">
			<p>
				Order up <b class:red={SUIT_COLOR[s.upCard!.suit]}>{SUIT_GLYPH[s.upCard!.suit]}</b> as trump?
			</p>
			{#if variant.allowAlone}
				<label class="alone-toggle">
					<input type="checkbox" bind:checked={alone} /> Go alone
				</label>
			{/if}
			<div class="row">
				<button class="btn" onclick={() => controller.pass()}>Pass</button>
				<button class="btn primary" onclick={() => controller.orderUp(alone)}>Order up</button>
			</div>
		</div>
	{:else if s.turn === 0 && s.phase === 'bidding2'}
		<div class="panel">
			<p>Name trump{s.dealer === 0 ? ' — you must call' : ''}:</p>
			<div class="suit-row">
				{#each controller.callable as suit (suit)}
					<button
						class="suit-btn"
						class:red={SUIT_COLOR[suit]}
						onclick={() => controller.call(suit, alone)}
					>
						{SUIT_GLYPH[suit]}
					</button>
				{/each}
			</div>
			{#if variant.allowAlone}
				<label class="alone-toggle">
					<input type="checkbox" bind:checked={alone} /> Go alone
				</label>
			{/if}
			{#if s.dealer !== 0}
				<div class="row">
					<button class="btn" onclick={() => controller.pass()}>Pass</button>
				</div>
			{/if}
		</div>
	{:else if isHumanDiscard}
		<div class="panel slim">
			<p>You took the up-card — tap a card to discard.</p>
		</div>
	{:else if s.phase === 'handComplete'}
		<div class="panel">
			<p>{s.handResult}</p>
			<button class="btn primary" onclick={() => controller.nextHand()}>Next hand</button>
		</div>
	{:else if s.phase === 'gameOver'}
		<div class="panel win">
			<h2>{winnerLabel}</h2>
			<p>Final: {scoreboard.map((t) => `${t.label} ${t.value}`).join(' · ')}</p>
		</div>
	{/if}
</div>

<style>
	.felt {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
		padding: 0.5rem;
		gap: 0.25rem;
	}

	.hud {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-weight: 700;
		font-size: calc(0.9rem * var(--sc, 1));
		padding: 0 0.4rem;
	}
	.score {
		display: inline-flex;
		align-items: center;
		gap: 0.1rem;
	}
	.score .team {
		opacity: 0.85;
	}
	.score .team.you {
		opacity: 1;
	}
	.score .sep {
		opacity: 0.5;
		margin: 0 0.25rem;
	}
	.trump {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		background: var(--ui-surface);
	}
	.trump .glyph {
		font-size: calc(1.15rem * var(--sc, 1));
		line-height: 1;
	}
	.trump.red .glyph {
		color: #d23b4e;
	}
	.trump .alone {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.8;
	}

	/* Opponents row across the top. */
	.opponents {
		display: flex;
		justify-content: space-around;
		align-items: flex-start;
		gap: calc(0.5rem * var(--sc, 1));
		padding: calc(0.4rem * var(--sc, 1)) 0.2rem 0;
		flex-wrap: wrap;
		max-width: 1100px;
		margin: 0 auto;
		width: 100%;
	}
	.opp {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}
	.seat-label {
		font-size: calc(0.75rem * var(--sc, 1));
		font-weight: 700;
		opacity: 0.85;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		text-align: center;
	}
	.deal-chip {
		font-size: 0.6rem;
		font-weight: 800;
		background: var(--back-1);
		color: #fff;
		border-radius: 999px;
		width: 1rem;
		height: 1rem;
		display: inline-grid;
		place-items: center;
	}
	.opp.active .seat-label {
		opacity: 1;
		color: var(--drop-ring);
	}
	.opp.active {
		filter: drop-shadow(0 0 0.5rem var(--drop-ring));
	}
	.opp.sitting {
		opacity: 0.4;
	}
	.backs {
		display: flex;
	}
	.back-slot {
		margin-left: var(--backov, -1.3rem);
	}
	.backs .back-slot:first-child {
		margin-left: 0;
	}

	/* Center play area: the current trick laid out as a centered row. */
	.center {
		flex: 1;
		display: grid;
		place-items: center;
		min-height: 0;
	}
	.trick {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: calc(0.55rem * var(--sc, 1));
		flex-wrap: wrap;
		max-width: 100%;
	}
	.play {
		display: grid;
		justify-items: center;
		gap: calc(0.2rem * var(--sc, 1));
	}
	.play.mine :global(.card) {
		outline: 2px solid var(--drop-ring);
		border-radius: var(--card-radius);
	}
	.play-who {
		font-size: calc(0.62rem * var(--sc, 1));
		opacity: 0.7;
		font-weight: 600;
	}
	.play :global(.card) {
		animation: drop-in 0.22s var(--ease-out);
	}
	@keyframes drop-in {
		from {
			opacity: 0;
			transform: scale(0.8) translateY(-0.5rem);
		}
	}

	.upcard {
		display: grid;
		justify-items: center;
		gap: calc(0.35rem * var(--sc, 1));
		/* sit near the top of the play area so the bidding panel has room below */
		align-self: start;
		margin-top: 0.25rem;
	}
	.upcard.dim {
		opacity: 0.5;
	}
	.upcard-tag {
		font-size: calc(0.65rem * var(--sc, 1));
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.8;
	}

	/* Human hand */
	.you {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}
	.hand {
		display: flex;
		justify-content: center;
		padding-top: 0.5rem;
	}
	.hand-card {
		background: none;
		border: none;
		padding: 0;
		margin-left: var(--ov, -0.8rem);
		cursor: default;
		transition: transform 0.14s var(--ease-out);
		-webkit-tap-highlight-color: transparent;
	}
	.hand-card:first-child {
		margin-left: 0;
	}
	.hand-card.can {
		cursor: pointer;
	}
	.hand-card.can:hover {
		transform: translateY(-0.7rem);
	}
	.hand-card.dim {
		opacity: 0.45;
	}

	.log {
		position: absolute;
		bottom: 0.3rem;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.7rem;
		opacity: 0.7;
		pointer-events: none;
		white-space: nowrap;
	}

	/* Decision panels float above the table near the human. */
	.panel {
		position: absolute;
		left: 50%;
		bottom: calc(7rem * var(--sc, 1));
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.78);
		color: var(--ui-text);
		border-radius: 1rem;
		padding: 0.85rem 1.1rem;
		display: grid;
		justify-items: center;
		gap: 0.55rem;
		box-shadow: var(--card-shadow-lift);
		z-index: 10;
		text-align: center;
		min-width: 13rem;
		animation: rise 0.2s var(--ease-out);
	}
	.panel.slim {
		bottom: calc(8rem * var(--sc, 1));
	}
	.panel.win {
		bottom: 40%;
	}
	.panel.win h2 {
		margin: 0;
		font-size: calc(1.4rem * var(--sc, 1));
	}
	.panel p {
		margin: 0;
		font-size: calc(0.95rem * var(--sc, 1));
	}
	.panel b.red {
		color: #ff6b7d;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translate(-50%, 0.5rem);
		}
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
	.alone-toggle {
		font-size: 0.8rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		opacity: 0.9;
	}
	.suit-row {
		display: flex;
		gap: 0.4rem;
	}
	.suit-btn {
		width: calc(2.6rem * var(--sc, 1));
		height: calc(2.6rem * var(--sc, 1));
		border-radius: 0.7rem;
		border: none;
		background: var(--card-bg);
		color: #1a1a1a;
		font-size: calc(1.5rem * var(--sc, 1));
		cursor: pointer;
		transition: transform 0.1s var(--ease-out);
	}
	.suit-btn.red {
		color: #d23b4e;
	}
	.suit-btn:hover {
		transform: translateY(-2px);
	}

	.btn {
		font-family: inherit;
		color: var(--ui-text);
		background: var(--ui-surface);
		border: none;
		border-radius: 999px;
		padding: 0.45rem 1rem;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}
	.btn:hover {
		background: var(--ui-surface-hover);
	}
	.btn.primary {
		background: var(--back-1);
		color: #fff;
		font-weight: 700;
	}
</style>
