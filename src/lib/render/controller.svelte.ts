/**
 * GameController — the reactive bridge between the pure engine and the Svelte
 * shell. It owns a {@link GameSession}, exposes the current state as derived
 * reactive views (piles/layout), and turns shell interactions (drag drops,
 * taps, undo, new-deal) into engine moves.
 *
 * This is the ONLY stateful glue the shell needs; everything else stays pure.
 */

import { GameSession, type Card, type Game, type PileView, type TableLayout } from '$lib/engine';

/**
 * The read/interact surface the render shell needs. {@link GameController}
 * implements it; typing the shell against this (not the class generics) keeps
 * Table.svelte free of `S`/`M` plumbing.
 */
export interface TableSource {
	readonly layout: TableLayout;
	readonly piles: PileView[];
	grab(fromPileId: string, cardId: string): readonly Card[] | null;
	dropTargets(fromPileId: string, cardId: string): string[];
	drop(fromPileId: string, cardId: string, toPileId: string): boolean;
	tap(pileId: string, cardId: string | null): boolean;
	auto(card: Card): boolean;
}

export class GameController<S, M> {
	private readonly session: GameSession<S, M>;
	private readonly presenter: Game<S, M>['presenter'];
	/** Reactive mirror of the current immutable state. */
	private current: S = $state.raw(undefined as unknown as S);

	constructor(game: Game<S, M>, seed: number) {
		this.session = new GameSession(game.definition, seed);
		this.presenter = game.presenter;
		this.current = this.session.state;
	}

	private sync(): void {
		this.current = this.session.state;
	}

	get state(): S {
		return this.current;
	}

	get layout(): TableLayout {
		return this.presenter.layout(this.current);
	}

	get piles(): PileView[] {
		return this.presenter.piles(this.current);
	}

	get won(): boolean {
		return this.session.def.isWon(this.current);
	}

	get lost(): boolean {
		void this.current;
		return this.session.isLost();
	}

	get seed(): number {
		void this.current;
		return this.session.seed;
	}

	get moveCount(): number {
		void this.current;
		return this.session.moveCount;
	}

	get canUndo(): boolean {
		void this.current;
		return this.session.canUndo();
	}

	// --- interaction ---------------------------------------------------------

	/** The run that would be picked up grabbing `cardId` in `fromPileId`, or null. */
	grab(fromPileId: string, cardId: string): readonly Card[] | null {
		return this.presenter.grab(this.current, fromPileId, cardId);
	}

	/** Pile ids the current grab may be dropped onto. */
	dropTargets(fromPileId: string, cardId: string): string[] {
		return this.presenter.dropTargets(this.current, fromPileId, cardId);
	}

	/** Attempt a drop; applies the move and returns true if it was legal. */
	drop(fromPileId: string, cardId: string, toPileId: string): boolean {
		const move = this.presenter.resolveDrop(this.current, fromPileId, cardId, toPileId);
		if (move === null) return false;
		this.session.apply(move);
		this.sync();
		return true;
	}

	/** Tap a pile/card (stock draw, flip, auto-to-foundation); returns true if it did something. */
	tap(pileId: string, cardId: string | null): boolean {
		const move = this.presenter.tap?.(this.current, pileId, cardId) ?? null;
		if (move === null) return false;
		this.session.apply(move);
		this.sync();
		return true;
	}

	/** Double-tap auto-move (e.g. send `card` to a foundation); true if it moved. */
	auto(card: Card): boolean {
		const move = this.session.def.autoMove?.(this.current, card) ?? null;
		if (move === null) return false;
		this.session.apply(move);
		this.sync();
		return true;
	}

	undo(): void {
		this.session.undo();
		this.sync();
	}

	newDeal(seed?: number): void {
		this.session.newDeal(seed);
		this.sync();
	}
}
