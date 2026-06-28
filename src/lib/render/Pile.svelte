<script lang="ts">
	import type { PileView } from '$lib/engine';

	interface Props {
		pile: PileView;
		x: number;
		y: number;
		w: number;
		h: number;
		/** Highlight as a legal drop target for the current drag. */
		target?: boolean;
	}

	let { pile, x, y, w, h, target = false }: Props = $props();
</script>

<div
	class="slot"
	class:target
	style="left:{x}px; top:{y}px; width:{w}px; height:{h}px;"
	data-pile-id={pile.id}
>
	{#if pile.cards.length === 0 && pile.placeholder}
		<span class="glyph" style:font-size="{w * 0.4}px">{pile.placeholder}</span>
	{/if}
</div>

<style>
	.slot {
		position: absolute;
		box-sizing: border-box;
		border-radius: 8%;
		border: 2px dashed var(--slot-outline);
		background: var(--slot-fill);
		display: grid;
		place-items: center;
		transition:
			box-shadow var(--snap-ms) var(--ease-out),
			border-color var(--snap-ms) var(--ease-out);
	}
	.slot.target {
		border-color: var(--drop-ring);
		box-shadow: var(--drop-ring-glow);
	}
	.glyph {
		color: var(--slot-glyph);
		font-family: var(--font-rounded);
		line-height: 1;
	}
</style>
