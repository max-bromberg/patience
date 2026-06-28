<script lang="ts">
	import type { Card } from '$lib/engine';
	import CardView from './CardView.svelte';
	import Pile from './Pile.svelte';
	import type { TableSource } from './controller.svelte';
	import { exceedsThreshold, pickTarget, pointerPoint, type Point, type TargetRect } from './dnd';
	import { sfx } from './sound';

	interface Props {
		controller: TableSource;
	}
	let { controller }: Props = $props();

	// --- sizing constants -----------------------------------------------------
	const ASPECT = 1.4; // card height / width
	const GAP_X = 0.18; // horizontal gap as a fraction of card width
	const GAP_Y = 0.16; // vertical row gap as a fraction of card height
	const FAN_OPEN = 0.3; // face-up fan step (down) as fraction of card height
	const FAN_TIGHT = 0.15; // face-down fan step (down)
	const FAN_OPEN_X = 0.36; // face-up fan step (right) as fraction of card width
	const FAN_TIGHT_X = 0.2;
	const MIN_W = 30; // wide games (Spider's 10 columns) still fit a phone
	const MAX_W = 120; // cap card size so desktop isn't oversized (mobile never hits this)
	const TAP_THRESHOLD = 8; // px of travel before a press becomes a drag
	const DOUBLE_TAP_MS = 320;

	let containerW = $state(360);
	let boardEl: HTMLDivElement | null = $state(null);

	const layout = $derived(controller.layout);
	const piles = $derived(controller.piles);
	// index slots by pile id once per layout (avoids an O(slots) find per card)
	const slotById = $derived(Object.fromEntries(layout.slots.map((s) => [s.pileId, s])));

	const metrics = $derived.by(() => {
		const cols = Math.max(1, layout.columns);
		const raw = containerW / (cols + (cols - 1) * GAP_X);
		const cardW = Math.max(MIN_W, Math.min(MAX_W, raw));
		const cardH = cardW * ASPECT;
		const gapX = cardW * GAP_X;
		const stepX = cardW + gapX;
		const stepY = cardH * (1 + GAP_Y);
		const boardW = cols * cardW + (cols - 1) * gapX;
		const offsetX = Math.max(0, (containerW - boardW) / 2);
		return { cardW, cardH, gapX, stepX, stepY, offsetX };
	});

	function slotOrigin(pileId: string): Point | null {
		const slot = slotById[pileId];
		if (!slot) return null;
		return { x: metrics.offsetX + slot.x * metrics.stepX, y: slot.y * metrics.stepY };
	}

	interface PositionedCard {
		card: Card;
		x: number;
		y: number;
		z: number;
		pileId: string;
		isTop: boolean;
	}

	const positioned = $derived.by((): PositionedCard[] => {
		const m = metrics;
		const out: PositionedCard[] = [];
		piles.forEach((pile, pi) => {
			const origin = slotOrigin(pile.id);
			if (!origin) return;
			let off = 0;
			pile.cards.forEach((card, ci) => {
				let x = origin.x;
				let y = origin.y;
				if (pile.fan === 'down') {
					y += off;
					off += (card.faceUp ? FAN_OPEN : FAN_TIGHT) * m.cardH;
				} else if (pile.fan === 'right') {
					x += off;
					off += (card.faceUp ? FAN_OPEN_X : FAN_TIGHT_X) * m.cardW;
				}
				out.push({
					card,
					x,
					y,
					z: pi * 100 + ci,
					pileId: pile.id,
					isTop: ci === pile.cards.length - 1
				});
			});
		});
		return out;
	});

	/** Landing position (top-left, board-local) where a drop onto `pileId` would sit. */
	function landingPos(pileId: string): Point | null {
		const origin = slotOrigin(pileId);
		if (!origin) return null;
		const pile = piles.find((p) => p.id === pileId);
		if (!pile || pile.cards.length === 0 || pile.fan === 'none') return origin;
		// place atop the current stack
		let off = 0;
		for (const card of pile.cards) {
			off +=
				(card.faceUp
					? pile.fan === 'down'
						? FAN_OPEN
						: FAN_OPEN_X
					: pile.fan === 'down'
						? FAN_TIGHT
						: FAN_TIGHT_X) * (pile.fan === 'down' ? metrics.cardH : metrics.cardW);
		}
		return pile.fan === 'down'
			? { x: origin.x, y: origin.y + off }
			: { x: origin.x + off, y: origin.y };
	}

	const boardH = $derived.by(() => {
		let max = metrics.cardH;
		for (const c of positioned) max = Math.max(max, c.y + metrics.cardH);
		return max + metrics.cardH * 0.1;
	});

	// --- drag state -----------------------------------------------------------
	interface DragState {
		fromPileId: string;
		cardId: string;
		ids: string[];
		dx: number;
		dy: number;
		start: Point;
		active: boolean;
		pointerId: number;
	}
	let drag = $state<DragState | null>(null);
	let activeTarget = $state<string | null>(null);
	let snapping = $state<string[]>([]);
	// non-reactive: only read inside pointer handlers, never the template
	let targets = new Set<string>();

	let lastTapId = '';
	let lastTapAt = 0;

	function targetRects(): TargetRect[] {
		const rect = boardEl?.getBoundingClientRect();
		if (!rect) return [];
		const out: TargetRect[] = [];
		for (const pileId of targets) {
			const p = landingPos(pileId);
			if (!p) continue;
			const left = rect.left + p.x;
			const top = rect.top + p.y;
			out.push({
				pileId,
				left: left - metrics.cardW * 0.25,
				top: top - metrics.cardH * 0.25,
				right: left + metrics.cardW * 1.25,
				bottom: top + metrics.cardH * 1.25
			});
		}
		return out;
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button != null && e.button !== 0) return;
		const el = (e.target as HTMLElement | null)?.closest('[data-card-id]') as HTMLElement | null;
		const cardId = el?.dataset.cardId;
		if (!cardId) return;
		const pc = positioned.find((p) => p.card.id === cardId);
		if (!pc) return;
		const run = controller.grab(pc.pileId, pc.card.id);
		const ids = run ? run.map((c) => c.id) : [];
		targets = new Set(run ? controller.dropTargets(pc.pileId, pc.card.id) : []);
		activeTarget = null;
		drag = {
			fromPileId: pc.pileId,
			cardId: pc.card.id,
			ids,
			dx: 0,
			dy: 0,
			start: pointerPoint(e),
			active: false,
			pointerId: e.pointerId
		};
		boardEl?.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.pointerId) return;
		const p = pointerPoint(e);
		if (!drag.active && exceedsThreshold(drag.start, p, TAP_THRESHOLD)) drag.active = true;
		if (!drag.active || drag.ids.length === 0) return;
		drag.dx = p.x - drag.start.x;
		drag.dy = p.y - drag.start.y;
		activeTarget = pickTarget(p, targetRects(), metrics.cardW * 1.3);
	}

	function springBack(ids: string[]) {
		snapping = [...ids];
		setTimeout(() => {
			snapping = [];
		}, 240);
	}

	function onPointerUp(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.pointerId) return;
		const d = drag;
		boardEl?.releasePointerCapture?.(e.pointerId);

		if (d.active && d.ids.length > 0) {
			const dropped = activeTarget && controller.drop(d.fromPileId, d.cardId, activeTarget);
			if (!dropped) {
				springBack(d.ids);
				sfx.invalid();
			}
		} else {
			// a tap: stock draw / flip, or double-tap auto-to-foundation
			const now = e.timeStamp;
			const isDouble = lastTapId === d.cardId && now - lastTapAt < DOUBLE_TAP_MS;
			lastTapId = d.cardId;
			lastTapAt = now;
			const did = controller.tap(d.fromPileId, d.cardId);
			if (!did && isDouble) {
				const card = positioned.find((p) => p.card.id === d.cardId)?.card;
				if (card) controller.auto(card);
			}
		}
		drag = null;
		targets = new Set();
		activeTarget = null;
	}

	function onPointerCancel(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.pointerId) return;
		springBack(drag.ids);
		drag = null;
		targets = new Set();
		activeTarget = null;
	}

	function dragOffset(id: string): Point {
		return drag && drag.active && drag.ids.includes(id)
			? { x: drag.dx, y: drag.dy }
			: { x: 0, y: 0 };
	}
</script>

<div
	class="table-surface"
	role="application"
	aria-label="Card game table"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerCancel}
>
	<div class="board" bind:this={boardEl} bind:clientWidth={containerW} style:height="{boardH}px">
		<!-- slot layer -->
		{#each piles as pile (pile.id)}
			{@const o = slotOrigin(pile.id)}
			{#if o}
				<Pile
					{pile}
					x={o.x}
					y={o.y}
					w={metrics.cardW}
					h={metrics.cardH}
					target={activeTarget === pile.id}
				/>
			{/if}
		{/each}

		<!-- card layer: one persistent keyed element per card; transforms transition smoothly -->
		{#each positioned as pc (pc.card.id)}
			{@const off = dragOffset(pc.card.id)}
			{@const dragging = drag?.active && drag.ids.includes(pc.card.id)}
			<div
				class="card-wrap"
				class:dragging
				class:snapping={snapping.includes(pc.card.id)}
				class:highlighted={controller.highlighted.includes(pc.card.id)}
				data-card-id={pc.card.id}
				style:transform="translate3d({pc.x + off.x}px, {pc.y + off.y}px, 0)"
				style:z-index={dragging ? 1000 + pc.z : pc.z}
			>
				<CardView card={pc.card} w={metrics.cardW} h={metrics.cardH} lifted={!!dragging} />
			</div>
		{/each}
	</div>
</div>

<style>
	.table-surface {
		position: relative;
		width: 100%;
		min-height: 100%;
		padding: 0.75rem;
		box-sizing: border-box;
		touch-action: none;
	}

	.board {
		position: relative;
		width: 100%;
	}

	.card-wrap {
		position: absolute;
		top: 0;
		left: 0;
		transition: transform var(--snap-ms) var(--ease-out);
		will-change: transform;
	}
	/* While actively dragging, follow the pointer with no easing. */
	.card-wrap.dragging {
		transition: none;
	}
	/* Spring-back uses a slightly springier curve. */
	.card-wrap.snapping {
		transition: transform 0.24s cubic-bezier(0.34, 1.4, 0.5, 1);
	}
	/* Selection / hint emphasis ring (e.g. Pyramid pairing). */
	.card-wrap.highlighted :global(.card) {
		border-radius: var(--card-radius);
		box-shadow:
			0 0 0 3px var(--drop-ring),
			0 0 12px 2px var(--drop-ring);
		animation: pulse-ring 1s ease-in-out infinite;
	}
	@keyframes pulse-ring {
		50% {
			box-shadow:
				0 0 0 3px var(--drop-ring),
				0 0 18px 5px var(--drop-ring);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card-wrap.highlighted :global(.card) {
			animation: none;
		}
	}
</style>
