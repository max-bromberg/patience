/**
 * A normalized view + move interface so a single table UI ({@link TrickTable})
 * and controller can drive any 52-card AI game (Hearts, Spades, Oh Hell…).
 * Each game implements {@link AiCardGame} over its own private state `S`.
 */

import type { Card, GameMeta, Suit } from '$lib/engine';

export interface SeatView {
	readonly seat: number;
	readonly name: string;
	readonly count: number; // cards remaining in hand
	readonly active: boolean; // it's this seat's turn (AI thinking)
	readonly dealer: boolean;
	readonly bid?: number | null; // shown for bidding games
	readonly tricks?: number; // tricks won this hand
}

export interface PlayView {
	readonly player: number;
	readonly name: string;
	readonly card: Card;
}

export interface ScoreEntry {
	readonly label: string;
	readonly value: number;
	readonly you: boolean;
}

export type PromptKind = 'bid' | 'play' | 'continue' | 'gameOver' | 'none';

export interface Prompt {
	readonly kind: PromptKind;
	readonly title?: string;
	/** Selectable bid numbers (for kind === 'bid'). */
	readonly bids?: readonly number[];
}

export interface TableView {
	readonly seats: number;
	/** The human's hand (seat 0), already sorted for display. */
	readonly hand: readonly Card[];
	/** Card ids the human may legally play right now. */
	readonly playable: readonly string[];
	readonly opponents: readonly SeatView[];
	readonly trick: readonly PlayView[];
	readonly trump: Suit | null;
	readonly trumpLabel: string | null; // e.g. 'Spades' or '—' (no trump)
	readonly scoreboard: readonly ScoreEntry[];
	readonly banner: string | null; // latest log line
	readonly phase: 'bidding' | 'playing' | 'handComplete' | 'gameOver';
	readonly result: string | null; // hand/game result text
	readonly winnerLabel: string | null;
	readonly prompt: Prompt;
}

export type TrickMove =
	{ type: 'bid'; n: number } | { type: 'play'; cardId: string } | { type: 'continue' };

export interface AiCardGame<S> {
	readonly meta: GameMeta;
	newGame(seed: number): S;
	view(state: S): TableView;
	apply(state: S, move: TrickMove): S;
	/** One AI/auto step, or null when it's the human's turn / paused. */
	stepAuto(state: S): S | null;
	/** The move the AI would make for the human (hint / play-for-me). */
	suggest(state: S): TrickMove | null;
}
