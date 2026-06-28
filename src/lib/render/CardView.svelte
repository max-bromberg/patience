<script lang="ts">
	import type { Card } from '$lib/engine';
	import { cardColor } from '$lib/engine';
	import { SUIT_GLYPH, rankLabel } from './display';

	interface Props {
		card: Card;
		/** Card width in px (height follows the standard aspect ratio). */
		w: number;
		h: number;
		/** Visually lift the card (while dragged). */
		lifted?: boolean;
	}

	let { card, w, h, lifted = false }: Props = $props();

	const red = $derived(cardColor(card) === 'red');
	const glyph = $derived(SUIT_GLYPH[card.suit]);
	const label = $derived(rankLabel(card.rank));
</script>

<div
	class="card"
	class:lifted
	style="--cw:{w}px; --ch:{h}px;"
	style:font-size="{w}px"
	aria-label={card.faceUp ? `${label} of ${card.suit}` : 'face-down card'}
>
	<div class="inner" class:down={!card.faceUp}>
		<div class="face" class:red>
			<span class="corner tl"><b>{label}</b><i>{glyph}</i></span>
			<span class="center">{glyph}</span>
			<span class="corner br"><b>{label}</b><i>{glyph}</i></span>
		</div>
		<div class="back"><span class="motif">♣</span></div>
	</div>
</div>

<style>
	.card {
		width: var(--cw);
		height: var(--ch);
		perspective: 600px;
		font-family: var(--font-rounded);
		user-select: none;
		-webkit-user-select: none;
		touch-action: none;
		/* gentle deal-in the first time a card appears (persists across moves
		   via stable id, so this only plays on initial deal / game load) */
		animation: deal-in 300ms var(--ease-out) both;
	}

	@keyframes deal-in {
		from {
			opacity: 0;
			transform: translateY(-7px) scale(0.97);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card {
			animation: none;
		}
	}

	.inner {
		position: relative;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		transition: transform var(--flip-ms) var(--ease-out);
		transform: rotateY(0deg);
	}
	.inner.down {
		transform: rotateY(180deg);
	}

	.face,
	.back {
		position: absolute;
		inset: 0;
		border-radius: 0.42em;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		box-shadow: var(--card-shadow);
		box-sizing: border-box;
	}

	.face {
		background: var(--card-bg);
		border: 0.012em solid var(--card-border);
		color: var(--card-ink-black);
	}
	.face.red {
		color: var(--card-ink-red);
	}

	.lifted .face,
	.lifted .back {
		box-shadow: var(--card-shadow-lift);
	}

	.corner {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 0.9;
		font-weight: 700;
	}
	.corner b {
		font-size: 0.2em;
	}
	.corner i {
		font-size: 0.18em;
		font-style: normal;
	}
	.tl {
		top: 0.07em;
		left: 0.07em;
	}
	.br {
		bottom: 0.07em;
		right: 0.07em;
		transform: rotate(180deg);
	}

	.center {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 0.46em;
		opacity: 0.92;
	}

	.back {
		transform: rotateY(180deg);
		background: repeating-linear-gradient(
			45deg,
			var(--back-1) 0,
			var(--back-1) 0.06em,
			var(--back-2) 0.06em,
			var(--back-2) 0.12em
		);
		border: 0.02em solid rgba(255, 255, 255, 0.25);
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	.back .motif {
		font-size: 0.34em;
		color: var(--back-accent);
	}
</style>
