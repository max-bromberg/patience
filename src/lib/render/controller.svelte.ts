/**
 * GameController — the reactive bridge between the pure engine and the Svelte
 * shell. It owns a {@link GameSession}, exposes the current state as derived
 * reactive views (piles/layout), and turns shell interactions (drag drops,
 * taps, undo, new-deal) into engine moves.
 *
 * This is the ONLY stateful glue the shell needs; everything else stays pure.
 */

import {
	GameSession,
	type Card,
	type Game,
	type PileView,
	type SessionSnapshot,
	type TableLayout
} from '$lib/engine';
import { autoFinishWins } from './autofinish';
import { haptics } from './haptics';
import { sfx } from './sound';

/**
 * The read/interact surface the render shell needs. {@link GameController}
 * implements it; typing the shell against this (not the class generics) keeps
 * Table.svelte free of `S`/`M` plumbing.
 */
export interface TableSource {
	readonly layout: TableLayout;
	readonly piles: PileView[];
	readonly highlighted: readonly string[];
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

	/** A serializable snapshot (seed + move log) for persistence/resume. */
	snapshot(): SessionSnapshot<M> {
		return this.session.snapshot();
	}

	/**
	 * Rebuild a controller from a snapshot by replaying its moves. Throws if the
	 * moves no longer apply (e.g. game rules changed) — callers should fall back
	 * to a fresh deal.
	 */
	static restore<S, M>(game: Game<S, M>, snapshot: SessionSnapshot<M>): GameController<S, M> {
		const controller = new GameController(game, snapshot.seed);
		for (const move of snapshot.moves) controller.session.apply(move);
		controller.sync();
		return controller;
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

	/** Card ids to visually emphasize (selection / hints). */
	get highlighted(): readonly string[] {
		return this.presenter.highlight?.(this.current) ?? [];
	}

	get won(): boolean {
		return this.session.def.isWon(this.current);
	}

	/** No legal moves remain and the game isn't won — a universal dead-end check. */
	get stuck(): boolean {
		return !this.won && this.session.def.legalMoves(this.current).length === 0;
	}

	/**
	 * Rough completion fraction (0–1), used to make the music respond to how the
	 * game's going. Foundation-building games count cards home to the foundations;
	 * clearing games (golf/tri-peaks) count cards sent to the waste. Heuristic, not
	 * exact — it just needs to rise as you make progress.
	 */
	get progress(): number {
		const piles = this.piles;
		const total = piles.reduce((n, p) => n + p.cards.length, 0);
		if (total === 0) return this.won ? 1 : 0;
		const hasFoundation = piles.some((p) => p.kind === 'foundation');
		const done = piles.reduce(
			(n, p) =>
				p.kind === 'foundation' || (!hasFoundation && p.kind === 'waste') ? n + p.cards.length : n,
			0
		);
		return Math.min(1, done / total);
	}

	/**
	 * True only when repeatedly sending top cards to foundations would actually
	 * win — a cheap pure dry-run (auto-moves are monotonic, so it terminates).
	 * This keeps the "Auto-finish" affordance to the trivially-solved endgame.
	 */
	get canAutoFinish(): boolean {
		return autoFinishWins(this.session.def, this.presenter, this.current);
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
		if (toPileId.startsWith('foundation')) {
			sfx.foundation();
			haptics.foundation();
		} else {
			sfx.place();
			haptics.place();
		}
		return true;
	}

	/** Tap a pile/card (stock draw, flip, auto-to-foundation); returns true if it did something. */
	tap(pileId: string, cardId: string | null): boolean {
		const move = this.presenter.tap?.(this.current, pileId, cardId) ?? null;
		if (move === null) return false;
		this.session.apply(move);
		this.sync();
		sfx.draw();
		haptics.tap();
		return true;
	}

	/** Double-tap auto-move (e.g. send `card` to a foundation); true if it moved. */
	auto(card: Card): boolean {
		const move = this.session.def.autoMove?.(this.current, card) ?? null;
		if (move === null) return false;
		this.session.apply(move);
		this.sync();
		sfx.foundation(); // auto-moves send a card home to a foundation
		haptics.foundation();
		return true;
	}

	/**
	 * Apply one auto-to-foundation move if any top card can make one. Drives the
	 * auto-finish cascade (stepped by the player for a visible animation).
	 */
	autoStep(): boolean {
		for (const pile of this.presenter.piles(this.current)) {
			const top = pile.cards[pile.cards.length - 1];
			if (top && this.auto(top)) return true;
		}
		return false;
	}

	undo(): void {
		if (!this.session.canUndo()) return;
		this.session.undo();
		this.sync();
		sfx.flip();
		haptics.undo();
	}

	newDeal(seed?: number): void {
		this.session.newDeal(seed);
		this.sync();
		sfx.deal();
	}
}
