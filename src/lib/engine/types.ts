/**
 * Core engine types. PURE — no Svelte/DOM imports anywhere in `src/lib/engine`.
 *
 * The engine is generic over a game-specific state `S` and move `M`. Each game
 * implements {@link GameDefinition}; the render shell and {@link GameSession}
 * are written once against this interface and never contain game-specific rules.
 */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

/** A=1 … J=11, Q=12, K=13. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type Color = 'red' | 'black';

/**
 * A playing card. Fully immutable: flipping or otherwise changing a card
 * produces a NEW object that keeps the same {@link Card.id}. Stable ids are
 * load-bearing — `animate:flip` keys on them to move a card smoothly between
 * piles, and immutability is what makes undo (replay) and snapshots free.
 */
export interface Card {
	/** Stable identity, unique within a deal (includes a copy index for multi-deck games). */
	readonly id: string;
	readonly suit: Suit;
	readonly rank: Rank;
	readonly faceUp: boolean;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Catalog-facing metadata for a game. */
export interface GameMeta {
	/** Stable id used in routes and the registry, e.g. 'klondike'. */
	readonly id: string;
	readonly name: string;
	/** One-line description for the catalog. */
	readonly blurb: string;
	readonly difficulty: Difficulty;
	/** Grouping for the catalog, e.g. 'builder'. */
	readonly family: string;
}

/**
 * The contract every game implements. Generic over its own state `S` and
 * move `M`. All methods are PURE: {@link GameDefinition.applyMove} returns a
 * new state rather than mutating its input.
 */
export interface GameDefinition<S, M> {
	readonly meta: GameMeta;

	/** Deterministic given `seed`: same seed → identical deal. */
	initialState(seed: number): S;

	/** All currently legal moves from `state`. */
	legalMoves(state: S): M[];

	/** PURE — returns the next state; never mutates `state`. */
	applyMove(state: S, move: M): S;

	isWon(state: S): boolean;

	/** Optional; many solitaires can dead-end with no legal moves left. */
	isLost?(state: S): boolean;

	/** Optional: the move a double-tap on `card` should make (e.g. send to foundation). */
	autoMove?(state: S, card: Card): M | null;

	/** Optional: a suggested move for a hint button. */
	hint?(state: S): M | null;
}
