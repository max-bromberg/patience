/**
 * EuchreController — the reactive bridge between the pure Euchre engine and the
 * Svelte shell. It owns the immutable {@link EuchreState}, applies the human's
 * moves, and drives the engine's automatic steps ({@link stepAuto}) on a timer
 * so AI bids and plays animate one at a time instead of resolving instantly.
 *
 * All rules live in the pure engine; this class is just timing + sound glue.
 */

import { sfx } from '$lib/render/sound';
import { effectiveSuit, legalPlays } from './cards';
import {
	applyMove,
	callableSuits,
	needsHuman,
	newGame,
	stepAuto,
	suggestMove,
	type EuchreMove,
	type EuchreState
} from './euchre';
import type { Suit } from '$lib/engine';

/** Pacing for the auto-stepper, ms. Trick resolution lingers so it's readable. */
const STEP_MS = 620;
const TRICK_HOLD_MS = 950;

export class EuchreController {
	private cur: EuchreState = $state.raw(newGame(0));
	private timer: ReturnType<typeof setTimeout> | null = null;
	private readonly variantId: string;
	private _seed = 0;
	/** True while the engine is auto-advancing AI turns (UI dims human controls). */
	thinking = $state(false);

	constructor(seed: number, variantId = 'euchre') {
		this.variantId = variantId;
		this._seed = seed;
		this.cur = newGame(seed, variantId);
		this.pump();
	}

	get state(): EuchreState {
		return this.cur;
	}

	/** Seed of the current deal (for shareable reproducible links). */
	get seed(): number {
		return this._seed;
	}

	/** Whose turn it is, 0=human South. */
	get turn(): number {
		return this.cur.turn;
	}

	/** True when the engine is waiting on the human (bid/discard/play/continue). */
	get awaitingHuman(): boolean {
		return needsHuman(this.cur);
	}

	/** The legal trump suits for a round-2 call (anything but the up-card suit). */
	get callable(): Suit[] {
		return callableSuits(this.cur);
	}

	/** The card ids the human may legally play right now (empty if not their turn). */
	get playableIds(): readonly string[] {
		const s = this.cur;
		if (s.phase !== 'playing' || s.turn !== 0) return [];
		const led = s.trick.length > 0 ? effectiveSuit(s.trick[0].card, s.trump!) : null;
		return legalPlays(s.hands[0], led, s.trump!).map((c) => c.id);
	}

	/** The AI's recommended human move (drives an optional hint / auto-play). */
	get hint(): EuchreMove | null {
		return suggestMove(this.cur);
	}

	// --- human actions --------------------------------------------------------
	orderUp(alone: boolean): void {
		this.act({ type: 'order', alone });
		sfx.place();
	}
	pass(): void {
		this.act({ type: 'pass' });
		sfx.flip();
	}
	call(suit: Suit, alone: boolean): void {
		this.act({ type: 'call', suit, alone });
		sfx.place();
	}
	discard(cardId: string): void {
		this.act({ type: 'discard', cardId });
		sfx.place();
	}
	play(cardId: string): void {
		if (!this.playableIds.includes(cardId)) return;
		this.act({ type: 'play', cardId });
		sfx.place();
	}
	nextHand(): void {
		this.act({ type: 'continue' });
		sfx.deal();
	}

	/** Let the AI take the human's turn (a "play for me" convenience). */
	autoPlay(): void {
		const move = suggestMove(this.cur);
		if (move) this.act(move);
	}

	newDeal(seed: number): void {
		this.stop();
		this._seed = seed;
		this.cur = newGame(seed, this.variantId);
		sfx.deal();
		this.pump();
	}

	/** Clear the timer (call from the component's onDestroy). */
	dispose(): void {
		this.stop();
	}

	// --- internals ------------------------------------------------------------
	private act(move: EuchreMove): void {
		const before = this.cur;
		this.cur = applyMove(this.cur, move);
		if (this.cur !== before) this.pump();
	}

	private stop(): void {
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
		this.thinking = false;
	}

	/** Schedule auto-steps until the human must act (or the hand/game pauses). */
	private pump(): void {
		this.stop();
		if (needsHuman(this.cur)) return;
		this.thinking = true;
		const tick = () => {
			const next = stepAuto(this.cur);
			if (next === null) {
				this.stop();
				return;
			}
			// A trick that just filled (about to resolve) holds a beat longer.
			const resolving = next.lastTrick !== this.cur.lastTrick;
			this.cardSound(this.cur, next);
			this.cur = next;
			if (needsHuman(this.cur)) {
				this.thinking = false;
				this.timer = null;
				return;
			}
			this.timer = setTimeout(tick, resolving ? TRICK_HOLD_MS : STEP_MS);
		};
		this.timer = setTimeout(tick, STEP_MS);
	}

	private cardSound(prev: EuchreState, next: EuchreState): void {
		if (next.trick.length > prev.trick.length) sfx.place();
		else if (next.lastTrick !== prev.lastTrick) sfx.draw();
	}
}
