/**
 * A play session wraps a {@link GameDefinition} with a move log, giving undo
 * (replay), reproducible deals (seed), win/loss tracking, and trivial
 * serialization — all from the engine's immutability guarantee.
 *
 * The session container itself is mutable (it holds a history stack), but every
 * game STATE it stores is immutable, produced by the pure `applyMove`.
 */

import type { Card, GameDefinition } from './types';

/** Minimal data needed to reconstruct a session: seed + the moves played. */
export interface SessionSnapshot<M> {
	readonly gameId: string;
	readonly seed: number;
	readonly moves: readonly M[];
}

export class GameSession<S, M> {
	readonly def: GameDefinition<S, M>;
	private _seed: number;
	private readonly _moves: M[] = [];
	/** History stack; `_states[i]` is the state after `i` moves. */
	private readonly _states: S[];

	constructor(def: GameDefinition<S, M>, seed: number) {
		this.def = def;
		this._seed = seed;
		this._states = [def.initialState(seed)];
	}

	get seed(): number {
		return this._seed;
	}

	/** The current game state (immutable). */
	get state(): S {
		return this._states[this._states.length - 1];
	}

	/** The ordered move log. */
	get moves(): readonly M[] {
		return this._moves;
	}

	/** Number of moves played so far. */
	get moveCount(): number {
		return this._moves.length;
	}

	legalMoves(): M[] {
		return this.def.legalMoves(this.state);
	}

	/** Apply a move, advancing the state and appending to the log. */
	apply(move: M): S {
		const next = this.def.applyMove(this.state, move);
		this._states.push(next);
		this._moves.push(move);
		return next;
	}

	canUndo(): boolean {
		return this._moves.length > 0;
	}

	/** Undo the last move by popping the history (equivalent to replay). */
	undo(): void {
		if (!this.canUndo()) return;
		this._states.pop();
		this._moves.pop();
	}

	isWon(): boolean {
		return this.def.isWon(this.state);
	}

	isLost(): boolean {
		return this.def.isLost?.(this.state) ?? false;
	}

	/** The move a double-tap on `card` should make, if the game defines one. */
	autoMove(card: Card): M | null {
		return this.def.autoMove?.(this.state, card) ?? null;
	}

	hint(): M | null {
		return this.def.hint?.(this.state) ?? null;
	}

	/** Reset to a fresh deal. Defaults to a new seed derived from the current one. */
	newDeal(seed: number = this._seed + 1): void {
		this._seed = seed;
		this._moves.length = 0;
		this._states.length = 0;
		this._states.push(this.def.initialState(seed));
	}

	snapshot(): SessionSnapshot<M> {
		return { gameId: this.def.meta.id, seed: this._seed, moves: this._moves.slice() };
	}

	/** Rebuild a session from a {@link GameDefinition} and a snapshot (replays moves). */
	static restore<S, M>(def: GameDefinition<S, M>, snapshot: SessionSnapshot<M>): GameSession<S, M> {
		const session = new GameSession(def, snapshot.seed);
		for (const move of snapshot.moves) session.apply(move);
		return session;
	}
}
