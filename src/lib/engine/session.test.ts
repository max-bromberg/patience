import { describe, expect, it } from 'vitest';
import { shuffledDeck } from './deck';
import { GameSession } from './session';
import type { Card, GameDefinition } from './types';

/**
 * A minimal fixture game used to exercise the generic session machinery without
 * needing a real game (Klondike arrives in Phase 3). "Sweep": deal a shuffled
 * deck face-down into a stock; the only move is to flip the top card onto a
 * foundation. Win when all 52 cards are on the foundation.
 */
interface SweepState {
	readonly stock: readonly Card[];
	readonly foundation: readonly Card[];
}
type SweepMove = { readonly type: 'flip' };

const sweep: GameDefinition<SweepState, SweepMove> = {
	meta: { id: 'sweep', name: 'Sweep', blurb: 'test fixture', difficulty: 'easy', family: 'test' },
	initialState(seed) {
		return { stock: shuffledDeck(seed), foundation: [] };
	},
	legalMoves(state) {
		return state.stock.length > 0 ? [{ type: 'flip' }] : [];
	},
	applyMove(state) {
		const next = state.stock[state.stock.length - 1];
		return {
			stock: state.stock.slice(0, -1),
			foundation: state.foundation.concat({ ...next, faceUp: true })
		};
	},
	isWon(state) {
		return state.foundation.length === 52;
	},
	isLost() {
		return false; // never dead-ends; present to cover the optional hook
	}
};

function playToWin(session: GameSession<SweepState, SweepMove>): void {
	let guard = 0;
	while (!session.isWon() && guard++ < 1000) {
		const moves = session.legalMoves();
		expect(moves.length).toBeGreaterThan(0);
		session.apply(moves[0]);
	}
}

describe('GameSession — full headless game', () => {
	it('deals, plays every move, and reaches a win', () => {
		const session = new GameSession(sweep, 2024);
		expect(session.state.foundation).toHaveLength(0);
		playToWin(session);
		expect(session.isWon()).toBe(true);
		expect(session.moveCount).toBe(52);
		expect(session.legalMoves()).toHaveLength(0);
	});
});

describe('GameSession — determinism', () => {
	it('same seed → identical deal', () => {
		const a = new GameSession(sweep, 7);
		const b = new GameSession(sweep, 7);
		expect(a.state.stock.map((c) => c.id)).toEqual(b.state.stock.map((c) => c.id));
	});

	it('newDeal advances the seed and resets', () => {
		const session = new GameSession(sweep, 10);
		session.apply({ type: 'flip' });
		session.newDeal();
		expect(session.seed).toBe(11);
		expect(session.moveCount).toBe(0);
		expect(session.state.foundation).toHaveLength(0);
	});
});

describe('GameSession — undo', () => {
	it('undo restores the exact prior state (replay equivalence)', () => {
		const session = new GameSession(sweep, 3);
		const before = session.state;
		session.apply({ type: 'flip' });
		expect(session.state.foundation).toHaveLength(1);
		session.undo();
		expect(session.moveCount).toBe(0);
		// identical card order restored
		expect(session.state.stock.map((c) => c.id)).toEqual(before.stock.map((c) => c.id));
		expect(session.state.foundation).toHaveLength(0);
	});

	it('undo on a fresh session is a safe no-op', () => {
		const session = new GameSession(sweep, 1);
		expect(session.canUndo()).toBe(false);
		session.undo();
		expect(session.moveCount).toBe(0);
	});

	it('apply does not mutate prior states (immutability)', () => {
		const session = new GameSession(sweep, 5);
		const s0 = session.state;
		session.apply({ type: 'flip' });
		expect(s0.foundation).toHaveLength(0);
		expect(s0.stock).toHaveLength(52);
	});
});

describe('GameSession — snapshot/restore', () => {
	it('round-trips through a snapshot by replaying moves', () => {
		const session = new GameSession(sweep, 42);
		for (let i = 0; i < 5; i++) session.apply({ type: 'flip' });
		const snap = session.snapshot();
		expect(snap).toEqual({ gameId: 'sweep', seed: 42, moves: session.moves });

		const restored = GameSession.restore(sweep, snap);
		expect(restored.moveCount).toBe(5);
		expect(restored.state.foundation.map((c) => c.id)).toEqual(
			session.state.foundation.map((c) => c.id)
		);
		expect(restored.state.stock.map((c) => c.id)).toEqual(session.state.stock.map((c) => c.id));
	});
});
