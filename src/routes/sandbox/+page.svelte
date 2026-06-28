<script lang="ts">
	/**
	 * Dev sandbox for the render shell (Phase 2). Not part of the catalog. Uses a
	 * trivial "free move" demo game — any face-up run can be dragged onto any pile
	 * — purely to exercise CardView/Pile/Table + the dnd layer before a real game
	 * (Klondike, Phase 3) exists.
	 */
	import {
		setFaceUp,
		shuffledDeck,
		type Card,
		type Game,
		type GamePresenter,
		type PileView
	} from '$lib/engine';
	import { GameController, Table } from '$lib/render';

	type DemoState = { piles: Record<string, Card[]> };
	type DemoMove = { from: string; to: string; count: number };

	const COLUMNS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];

	const presenter: GamePresenter<DemoState, DemoMove> = {
		layout: () => ({
			columns: 6,
			rows: 4,
			slots: COLUMNS.map((id, i) => ({ pileId: id, x: i, y: 0 }))
		}),
		piles: (s): PileView[] =>
			COLUMNS.map((id) => ({ id, kind: 'tableau', cards: s.piles[id], fan: 'down' })),
		grab: (s, fromPileId, cardId) => {
			const pile = s.piles[fromPileId];
			const idx = pile.findIndex((c) => c.id === cardId);
			if (idx < 0 || !pile[idx].faceUp) return null;
			return pile.slice(idx);
		},
		dropTargets: (s, fromPileId, cardId) => {
			if (!presenter.grab(s, fromPileId, cardId)) return [];
			return COLUMNS.filter((id) => id !== fromPileId);
		},
		resolveDrop: (s, fromPileId, cardId, toPileId) => {
			const pile = s.piles[fromPileId];
			const idx = pile.findIndex((c) => c.id === cardId);
			if (idx < 0 || toPileId === fromPileId) return null;
			return { from: fromPileId, to: toPileId, count: pile.length - idx };
		},
		tap: (s, pileId, cardId) => {
			// tapping the top face-down card flips it
			const pile = s.piles[pileId];
			const top = pile[pile.length - 1];
			if (top && top.id === cardId && !top.faceUp) return { from: pileId, to: pileId, count: 0 };
			return null;
		}
	};

	const demo: Game<DemoState, DemoMove> = {
		definition: {
			meta: { id: 'demo', name: 'Demo', blurb: 'sandbox', difficulty: 'easy', family: 'test' },
			initialState: (seed) => {
				const deck = shuffledDeck(seed);
				const piles: Record<string, Card[]> = Object.fromEntries(COLUMNS.map((id) => [id, []]));
				deck.forEach((card, i) => {
					const col = COLUMNS[i % COLUMNS.length];
					// top card of each column face-up, a couple face-down to show flips
					piles[col].push(setFaceUp(card, true));
				});
				// flip a few to face-down to test tap-to-flip / face-down rendering
				for (const id of COLUMNS) {
					const p = piles[id];
					if (p.length > 2) p[p.length - 2] = setFaceUp(p[p.length - 2], false);
				}
				return { piles };
			},
			legalMoves: (s) => {
				const moves: DemoMove[] = [];
				for (const from of COLUMNS)
					for (const to of COLUMNS)
						if (from !== to && s.piles[from].length) moves.push({ from, to, count: 1 });
				return moves;
			},
			applyMove: (s, m) => {
				const piles: Record<string, Card[]> = {};
				for (const id of COLUMNS) piles[id] = s.piles[id].slice();
				if (m.count === 0) {
					// flip top card in place
					const p = piles[m.from];
					p[p.length - 1] = setFaceUp(p[p.length - 1], true);
				} else {
					const fromPile = piles[m.from];
					const moved = fromPile.splice(fromPile.length - m.count, m.count);
					piles[m.to] = piles[m.to].concat(moved);
				}
				return { piles };
			},
			isWon: () => false
		},
		presenter
	};

	const controller = new GameController(demo, 1);
</script>

<svelte:head>
	<title>Sandbox · Patience</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="wrap">
	<header>
		<strong>Render sandbox</strong>
		<span class="hint">drag runs · tap a face-down card to flip</span>
		<button onclick={() => controller.newDeal()}>New deal</button>
	</header>
	<Table {controller} />
</div>

<style>
	.wrap {
		min-height: 100dvh;
		background: var(--table-bg);
		background-blend-mode: var(--table-blend);
		color: var(--ui-text);
		display: flex;
		flex-direction: column;
	}
	header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.9rem;
		font-family: var(--font-rounded);
	}
	.hint {
		color: var(--ui-muted);
		font-size: 0.85rem;
	}
	button {
		margin-left: auto;
		font-family: var(--font-rounded);
		color: var(--ui-text);
		background: var(--ui-surface);
		border: none;
		border-radius: 999px;
		padding: 0.4rem 0.9rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	button:hover {
		background: var(--ui-surface-hover);
	}
</style>
