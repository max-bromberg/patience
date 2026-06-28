<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Card } from '$lib/engine';
	import { CardView } from '$lib/render';
	import { SUIT_GLYPH } from '$lib/render/display';
	import type { EuchreController } from './controller.svelte';

	let { controller }: { controller: EuchreController } = $props();

	const s = $derived(controller.state);
	onDestroy(() => controller.dispose());

	// Seat geometry: 0 South (human, bottom), 1 West (left), 2 North (top), 3 East (right).
	const seatName = ['You', 'West', 'Partner', 'East'];
	const SUIT_COLOR: Record<string, boolean> = {
		hearts: true,
		diamonds: true,
		spades: false,
		clubs: false
	};

	const playable = $derived(controller.playableIds);
	const isHumanPlay = $derived(s.phase === 'playing' && s.turn === 0 && !controller.thinking);
	const isHumanDiscard = $derived(s.phase === 'discard' && s.dealer === 0);

	let alone = $state(false);

	// The trick card played by a given seat, if any.
	function trickCard(seat: number): Card | null {
		return s.trick.find((p) => p.player === seat)?.card ?? null;
	}

	function onHandCard(card: Card) {
		if (isHumanDiscard) controller.discard(card.id);
		else if (isHumanPlay && playable.includes(card.id)) controller.play(card.id);
	}

	function teamScore(team: 0 | 1): number {
		return s.scores[team];
	}

	const trumpGlyph = $derived(s.trump ? SUIT_GLYPH[s.trump] : null);
	const trumpRed = $derived(s.trump ? SUIT_COLOR[s.trump] : false);
</script>

<div class="felt">
	<!-- Scoreboard + trump -->
	<div class="hud">
		<div class="score">
			<span class="us">You {teamScore(0)}</span>
			<span class="sep">–</span>
			<span class="them">{teamScore(1)} Them</span>
		</div>
		{#if s.trump}
			<div class="trump" class:red={trumpRed}>
				Trump <span class="glyph">{trumpGlyph}</span>
				{#if s.alone}<span class="alone">alone</span>{/if}
			</div>
		{/if}
	</div>

	<!-- Opponent seats -->
	{#each [2, 1, 3] as seat (seat)}
		<div class="seat seat-{seat}" class:active={s.turn === seat && controller.thinking}>
			<div class="seat-label">
				{seatName[seat]}
				{#if seat === s.dealer}<span class="deal-chip">D</span>{/if}
			</div>
			<div class="backs">
				{#each s.hands[seat] as card (card.id)}
					<div class="back-slot"><CardView card={{ ...card, faceUp: false }} w={34} h={48} /></div>
				{/each}
			</div>
		</div>
	{/each}

	<!-- Center: the current trick + up-card during bidding -->
	<div class="center">
		{#if s.upCard && (s.phase === 'bidding1' || s.phase === 'bidding2')}
			<div class="upcard" class:dim={s.phase === 'bidding2'}>
				<CardView card={s.upCard} w={52} h={74} />
				<span class="upcard-tag">{s.phase === 'bidding2' ? 'turned down' : 'up-card'}</span>
			</div>
		{:else}
			<div class="trick">
				{#each [0, 1, 2, 3] as seat (seat)}
					{@const tc = trickCard(seat)}
					<div class="play-slot slot-{seat}">
						{#if tc}<CardView card={tc} w={48} h={68} />{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Human hand -->
	<div class="seat seat-0" class:active={s.turn === 0 && !controller.thinking}>
		<div class="hand" role="group" aria-label="Your hand">
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
					<CardView {card} w={58} h={82} />
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
			<label class="alone-toggle">
				<input type="checkbox" bind:checked={alone} /> Go alone
			</label>
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
			<label class="alone-toggle">
				<input type="checkbox" bind:checked={alone} /> Go alone
			</label>
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
			<h2>{s.winner === 0 ? 'You win! 🎉' : 'Opponents win'}</h2>
			<p>Final: You {teamScore(0)} – {teamScore(1)} Them</p>
		</div>
	{/if}
</div>

<style>
	.felt {
		position: relative;
		flex: 1;
		display: grid;
		grid-template-rows: auto 1fr auto;
		min-height: 0;
		padding: 0.5rem;
		gap: 0.25rem;
	}

	.hud {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-weight: 700;
		font-size: 0.9rem;
		padding: 0 0.4rem;
	}
	.score .them {
		opacity: 0.85;
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
		font-size: 1.15rem;
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

	/* Seats. Opponents float at the edges of the middle band. */
	.seat-label {
		font-size: 0.75rem;
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

	.seat.active .seat-label {
		opacity: 1;
		color: var(--drop-ring);
	}

	.seat-2,
	.seat-1,
	.seat-3 {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		z-index: 2;
	}
	.seat-2 {
		top: 2.6rem;
		left: 50%;
		transform: translateX(-50%);
	}
	.seat-1 {
		left: 0.3rem;
		top: 50%;
		transform: translateY(-50%);
	}
	.seat-3 {
		right: 0.3rem;
		top: 50%;
		transform: translateY(-50%);
	}
	.backs {
		display: flex;
	}
	.seat-1 .backs,
	.seat-3 .backs {
		flex-direction: column;
	}
	.back-slot {
		margin-left: -1.1rem;
	}
	.backs .back-slot:first-child {
		margin-left: 0;
	}
	.seat-1 .back-slot,
	.seat-3 .back-slot {
		margin-left: 0;
		margin-top: -2rem;
	}
	.seat-1 .back-slot:first-child,
	.seat-3 .back-slot:first-child {
		margin-top: 0;
	}

	/* Center play area */
	.center {
		grid-row: 2;
		display: grid;
		place-items: center;
		min-height: 0;
	}
	.trick {
		position: relative;
		width: 9rem;
		height: 9rem;
	}
	.play-slot {
		position: absolute;
		width: 48px;
		height: 68px;
	}
	.slot-0 {
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
	}
	.slot-2 {
		top: 0;
		left: 50%;
		transform: translateX(-50%);
	}
	.slot-1 {
		left: 0;
		top: 50%;
		transform: translateY(-50%);
	}
	.slot-3 {
		right: 0;
		top: 50%;
		transform: translateY(-50%);
	}
	.play-slot :global(.card) {
		animation: drop-in 0.22s var(--ease-out);
	}
	@keyframes drop-in {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
	}

	.upcard {
		display: grid;
		justify-items: center;
		gap: 0.35rem;
	}
	.upcard.dim {
		opacity: 0.5;
	}
	.upcard-tag {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.8;
	}

	/* Human hand */
	.seat-0 {
		grid-row: 3;
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
		margin-left: -0.8rem;
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
		bottom: 7.5rem;
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
		bottom: 8.5rem;
	}
	.panel.win {
		bottom: 40%;
	}
	.panel.win h2 {
		margin: 0;
		font-size: 1.4rem;
	}
	.panel p {
		margin: 0;
		font-size: 0.95rem;
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
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 0.7rem;
		border: none;
		background: var(--card-bg);
		color: #1a1a1a;
		font-size: 1.5rem;
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

	@media (min-width: 720px) {
		.back-slot :global(.card) {
			--cw: 44px;
			--ch: 62px;
		}
	}
</style>
