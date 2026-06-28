/**
 * Presentation model — the bridge between a game's private state `S` and the
 * generic render shell. STILL PURE: these are plain data transforms with no
 * Svelte/DOM imports, so games stay headlessly testable.
 *
 * The shell never reads `S` directly. Instead each game provides a
 * {@link GamePresenter} that projects `S` into normalized piles + a layout, and
 * answers interaction questions ("what can this card move onto?"). All
 * game-specific rules live here and in the {@link GameDefinition}; the shell
 * stays rules-free.
 */

import type { Card, GameDefinition } from './types';

/** How a pile fans its cards out from its slot origin. */
export type FanDirection = 'none' | 'down' | 'right';

/** A normalized pile the shell can draw without knowing the game. */
export interface PileView {
	readonly id: string;
	/** Semantic kind, e.g. 'tableau' | 'foundation' | 'stock' | 'waste' | 'free'. */
	readonly kind: string;
	/** Cards bottom→top. */
	readonly cards: readonly Card[];
	readonly fan: FanDirection;
	/** Optional glyph/label shown when the pile is empty (e.g. 'A', 'K', '♠'). */
	readonly placeholder?: string;
}

/**
 * A pile's position on the table, in card-grid units: `x` counts card-width
 * steps from the left, `y` counts card-height steps from the top. Fractions are
 * allowed. The shell converts these to pixels using the measured card size.
 */
export interface Slot {
	readonly pileId: string;
	readonly x: number;
	readonly y: number;
}

/**
 * The table grid. `columns`/`rows` define the logical board size used to size
 * cards to the viewport; `slots` place each pile.
 */
export interface TableLayout {
	readonly columns: number;
	readonly rows: number;
	readonly slots: readonly Slot[];
}

/**
 * Projects a game state into something the shell can render and interact with.
 * Pure — no DOM. Generic over the same `S`/`M` as the game's
 * {@link GameDefinition}.
 */
export interface GamePresenter<S, M> {
	/** Board layout. May depend on state (e.g. variable column count). */
	layout(state: S): TableLayout;

	/** Normalized piles to draw, in stable order. */
	piles(state: S): PileView[];

	/**
	 * The run a drag would pick up if it grabs `cardId` in `fromPileId`: that
	 * card plus everything resting on top of it, or `null` if it can't be moved
	 * (e.g. face-down, or not a valid movable sequence).
	 */
	grab(state: S, fromPileId: string, cardId: string): readonly Card[] | null;

	/** Pile ids the currently-grabbed run may legally be dropped onto. */
	dropTargets(state: S, fromPileId: string, cardId: string): string[];

	/**
	 * Resolve a completed drag into a concrete move, or `null` if illegal.
	 * (Equivalent to: is `toPileId` in {@link dropTargets}?)
	 */
	resolveDrop(state: S, fromPileId: string, cardId: string, toPileId: string): M | null;

	/**
	 * A tap/click on a pile or card. Drives stock draws, face-up flips, and
	 * double-tap-to-foundation. `cardId` is null when the empty slot is tapped.
	 * Returns the move to apply, or null.
	 */
	tap?(state: S, pileId: string, cardId: string | null): M | null;

	/**
	 * Card ids the shell should visually emphasize (e.g. a tap-selected card in
	 * pairing games). Optional; defaults to none.
	 */
	highlight?(state: S): readonly string[];
}

/** A game module bundles its rules and its presentation together. */
export interface Game<S, M> {
	readonly definition: GameDefinition<S, M>;
	readonly presenter: GamePresenter<S, M>;
}

/** Convenience for code that handles games without caring about S/M. */
export type AnyGame = Game<unknown, unknown>;
