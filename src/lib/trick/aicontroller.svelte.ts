/**
 * Reactive bridge for any {@link AiCardGame}. Owns the immutable game state,
 * applies the human's moves, and drives the AI/auto steps on a timer so turns
 * animate. All rules live in the pure game module; this is timing + sound glue.
 */

import { sfx } from '$lib/render/sound';
import type { AiCardGame, TableView, TrickMove } from './aigame';

const STEP_MS = 600;
const TRICK_HOLD_MS = 950;

export class AiTableController<S> {
	private readonly game: AiCardGame<S>;
	private cur: S = $state.raw(undefined as unknown as S);
	private timer: ReturnType<typeof setTimeout> | null = null;
	private _seed: number;
	thinking = $state(false);

	constructor(game: AiCardGame<S>, seed: number) {
		this.game = game;
		this._seed = seed;
		this.cur = game.newGame(seed);
		this.pump();
	}

	get view(): TableView {
		return this.game.view(this.cur);
	}

	/** Seed of the current deal (for shareable reproducible links). */
	get seed(): number {
		return this._seed;
	}

	bid(n: number): void {
		this.act({ type: 'bid', n });
	}
	play(cardId: string): void {
		if (!this.view.playable.includes(cardId)) return;
		this.act({ type: 'play', cardId });
	}
	nextHand(): void {
		this.act({ type: 'continue' });
	}
	autoPlay(): void {
		const move = this.game.suggest(this.cur);
		if (move) this.act(move);
	}

	newDeal(seed: number): void {
		this.stop();
		this._seed = seed;
		this.cur = this.game.newGame(seed);
		sfx.deal();
		this.pump();
	}

	dispose(): void {
		this.stop();
	}

	private act(move: TrickMove): void {
		const before = this.cur;
		this.cur = this.game.apply(this.cur, move);
		if (this.cur === before) return;
		if (move.type === 'play') sfx.place();
		else if (move.type === 'bid') sfx.flip();
		else if (move.type === 'continue') sfx.deal();
		this.pump();
	}

	private stop(): void {
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
		this.thinking = false;
	}

	private pump(): void {
		this.stop();
		if (this.game.stepAuto(this.cur) === null) {
			this.maybeWin();
			return;
		}
		this.thinking = true;
		const tick = () => {
			const next = this.game.stepAuto(this.cur);
			if (next === null) {
				this.stop();
				this.maybeWin();
				return;
			}
			const resolving =
				this.game.view(next).trick.length === 0 && this.game.view(this.cur).trick.length > 0;
			this.transitionSound(this.cur, next);
			this.cur = next;
			if (this.game.stepAuto(this.cur) === null) {
				this.thinking = false;
				this.timer = null;
				this.maybeWin();
				return;
			}
			this.timer = setTimeout(tick, resolving ? TRICK_HOLD_MS : STEP_MS);
		};
		this.timer = setTimeout(tick, STEP_MS);
	}

	private transitionSound(prev: S, next: S): void {
		const a = this.game.view(prev);
		const b = this.game.view(next);
		if (b.trick.length > a.trick.length) sfx.place();
		else if (b.trick.length === 0 && a.trick.length > 0) sfx.draw();
	}

	private winCelebrated = false;
	private maybeWin(): void {
		const v = this.view;
		if (v.phase === 'gameOver' && v.winnerLabel?.startsWith('You') && !this.winCelebrated) {
			this.winCelebrated = true;
			sfx.win();
		}
		if (v.phase !== 'gameOver') this.winCelebrated = false;
	}
}
