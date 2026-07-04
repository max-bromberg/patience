<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Card } from '$lib/engine';
	import { CardView } from '$lib/render';
	import type { AiTableController } from './aicontroller.svelte';

	let { controller }: { controller: AiTableController<unknown> } = $props();

	const v = $derived(controller.view);
	onDestroy(() => controller.dispose());

	const isHumanPlay = $derived(v.prompt.kind === 'play' && !controller.thinking);

	function onHandCard(card: Card) {
		if (isHumanPlay && v.playable.includes(card.id)) controller.play(card.id);
	}

	// Responsive scale: 1 on a phone (the dialed-in baseline), growing toward 1.7
	// on desktop so the table fills the extra real estate instead of floating tiny.
	let feltW = $state(0);
	const scale = $derived(Math.min(1.85, Math.max(1, feltW / 460)));
	const px = (base: number) => Math.round(base * scale);
	const handW = $derived(px(52));
	const handH = $derived(px(73));
	const trickW = $derived(px(46));
	const trickH = $derived(px(65));
	const backW = $derived(px(28));
	const backH = $derived(px(40));

	// Heavier overlap as the hand grows so up to 13 cards fit; scales with the card.
	const handOverlap = $derived(`${(v.hand.length > 8 ? -1.7 : -0.8) * scale}rem`);
	const backOverlap = $derived(`${-Math.round(backW * 0.78)}px`);
</script>

<div class="felt" bind:clientWidth={feltW} style:--sc={scale}>
	<!-- Scoreboard + trump -->
	<div class="hud">
		<div class="score">
			{#each v.scoreboard as t, i (t.label)}
				{#if i > 0}<span class="sep">·</span>{/if}
				<span class="team" class:you={t.you}>{t.label} {t.value}</span>
			{/each}
		</div>
		{#if v.trumpLabel}
			<div class="trump">Trump <span class="tlabel">{v.trumpLabel}</span></div>
		{/if}
	</div>

	<!-- Opponents across the top -->
	<div class="opponents">
		{#each v.opponents as opp (opp.seat)}
			<div class="opp" class:active={opp.active}>
				<div class="seat-label">
					{opp.name}
					{#if opp.dealer}<span class="chip">D</span>{/if}
					{#if opp.bid !== undefined && opp.bid !== null}<span class="chip bid">{opp.bid}</span
						>{/if}
				</div>
				<div class="backs" style:--backov={backOverlap}>
					{#each Array.from({ length: opp.count }, (_, i) => i) as i (i)}
						<div class="back-slot">
							<CardView
								card={{ id: `b${i}`, suit: 'spades', rank: 2, faceUp: false }}
								w={backW}
								h={backH}
							/>
						</div>
					{/each}
				</div>
				{#if opp.tricks !== undefined}<span class="taken">{opp.tricks}</span>{/if}
			</div>
		{/each}
	</div>

	<!-- Center: current trick -->
	<div class="center">
		{#if v.trick.length > 0}
			<div class="trick">
				{#each v.trick as play (play.player)}
					<div class="play" class:mine={play.player === 0}>
						<CardView card={play.card} w={trickW} h={trickH} />
						<span class="play-who">{play.name}</span>
					</div>
				{/each}
			</div>
		{:else if v.banner}
			<div class="idle-banner">{v.banner}</div>
		{/if}
	</div>

	<!-- Human hand -->
	<div class="you" class:active={isHumanPlay}>
		<div class="hand" role="group" aria-label="Your hand" style:--ov={handOverlap}>
			{#each v.hand as card (card.id)}
				{@const can = isHumanPlay && v.playable.includes(card.id)}
				<button
					class="hand-card"
					class:can
					class:dim={isHumanPlay && !v.playable.includes(card.id)}
					onclick={() => onHandCard(card)}
					disabled={!can}
					aria-label="{card.rank} of {card.suit}"
				>
					<CardView {card} w={handW} h={handH} />
				</button>
			{/each}
		</div>
		<div class="seat-label">You</div>
	</div>

	<!-- Decision panels -->
	{#if v.prompt.kind === 'bid'}
		<div class="panel">
			<p>{v.prompt.title ?? 'Place your bid:'}</p>
			<div class="bid-row">
				{#each v.prompt.bids ?? [] as n (n)}
					<button class="bid-btn" onclick={() => controller.bid(n)}>{n}</button>
				{/each}
			</div>
		</div>
	{:else if v.prompt.kind === 'continue'}
		<div class="panel">
			<p>{v.prompt.title ?? v.result}</p>
			<button class="btn primary" onclick={() => controller.nextHand()}>Next hand</button>
		</div>
	{:else if v.prompt.kind === 'gameOver'}
		<div class="panel win">
			<h2>{v.winnerLabel}</h2>
			<p>Final: {v.scoreboard.map((t) => `${t.label} ${t.value}`).join(' · ')}</p>
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
		font-size: calc(0.85rem * var(--sc, 1));
		padding: 0 0.3rem;
	}
	.score {
		display: inline-flex;
		align-items: center;
		gap: 0.1rem;
		flex-wrap: wrap;
	}
	.score .team {
		opacity: 0.82;
	}
	.score .team.you {
		opacity: 1;
	}
	.score .sep {
		opacity: 0.5;
		margin: 0 0.2rem;
	}
	.trump {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		background: var(--ui-surface);
		white-space: nowrap;
	}
	.trump .tlabel {
		font-weight: 800;
		color: var(--drop-ring);
	}

	.opponents {
		display: flex;
		justify-content: space-around;
		align-items: flex-start;
		gap: calc(0.4rem * var(--sc, 1));
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
		gap: 0.15rem;
	}
	.seat-label {
		font-size: calc(0.72rem * var(--sc, 1));
		font-weight: 700;
		opacity: 0.85;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.chip {
		font-size: 0.58rem;
		font-weight: 800;
		background: var(--back-1);
		color: #fff;
		border-radius: 999px;
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.2rem;
		display: inline-grid;
		place-items: center;
	}
	.chip.bid {
		background: var(--drop-ring);
		color: #2b2208;
	}
	.opp.active .seat-label {
		opacity: 1;
		color: var(--drop-ring);
	}
	.opp.active {
		filter: drop-shadow(0 0 0.5rem var(--drop-ring));
	}
	.backs {
		display: flex;
	}
	.back-slot {
		margin-left: var(--backov, -1.35rem);
	}
	.backs .back-slot:first-child {
		margin-left: 0;
	}
	.taken {
		font-size: calc(0.65rem * var(--sc, 1));
		opacity: 0.7;
		font-weight: 700;
	}

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
			transform: scale(0.8) translateY(-0.4rem);
		}
	}
	.idle-banner {
		font-size: calc(0.9rem * var(--sc, 1));
		opacity: 0.7;
		font-weight: 600;
		text-align: center;
		max-width: 22rem;
	}

	.you {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}
	.hand {
		display: flex;
		justify-content: center;
		padding-top: 0.4rem;
		max-width: 100%;
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
		opacity: 0.5;
	}

	.panel {
		position: absolute;
		left: 50%;
		/* sit clear of the hand + "You" label stacked at the bottom */
		bottom: calc(7.5rem * var(--sc, 1));
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.8);
		color: var(--ui-text);
		border-radius: 1rem;
		padding: calc(0.85rem * var(--sc, 1)) calc(1.1rem * var(--sc, 1));
		display: grid;
		justify-items: center;
		gap: 0.55rem;
		box-shadow: var(--card-shadow-lift);
		z-index: 10;
		text-align: center;
		min-width: calc(13rem * var(--sc, 1));
		max-width: calc(100vw - 1.5rem);
		animation: rise 0.2s var(--ease-out);
	}
	.panel.win {
		bottom: 42%;
	}
	.panel.win h2 {
		margin: 0;
		font-size: calc(1.4rem * var(--sc, 1));
	}
	.panel p {
		margin: 0;
		font-size: calc(0.92rem * var(--sc, 1));
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translate(-50%, 0.5rem);
		}
	}
	.bid-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		justify-content: center;
	}
	.bid-btn {
		min-width: calc(2.1rem * var(--sc, 1));
		height: calc(2.1rem * var(--sc, 1));
		border-radius: 0.6rem;
		border: none;
		background: var(--card-bg);
		color: #1a1a1a;
		font-weight: 800;
		font-size: calc(0.95rem * var(--sc, 1));
		cursor: pointer;
		transition: transform 0.1s var(--ease-out);
	}
	.bid-btn:hover {
		transform: translateY(-2px);
		background: var(--drop-ring);
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
	.btn.primary {
		background: var(--back-1);
		color: #fff;
		font-weight: 700;
	}
</style>
