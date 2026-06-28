/**
 * Reactive, persisted local play stats: per-game games played / won and the
 * current + best win streak, plus the most recently played game. Recorded when
 * a game concludes (a solitaire is won or dead-ends; a trick game reaches game
 * over). Everything stays on-device — no accounts, no network.
 */

import { readJSON, writeJSON } from './storage';

export interface GameStat {
	played: number;
	won: number;
	streak: number; // current consecutive wins
	best: number; // best win streak
}

interface StatsData {
	games: Record<string, GameStat>;
	lastPlayed: string | null;
}

const KEY = 'stats';
const EMPTY: GameStat = { played: 0, won: 0, streak: 0, best: 0 };

class StatsStore {
	#data = $state<StatsData>({ games: {}, lastPlayed: null });

	constructor() {
		const saved = readJSON<StatsData>(KEY, { games: {}, lastPlayed: null });
		this.#data = { games: saved.games ?? {}, lastPlayed: saved.lastPlayed ?? null };
	}

	#persist(): void {
		writeJSON(KEY, this.#data);
	}

	/** Stats for one game id (zeroed if never played). */
	forGame(gameId: string): GameStat {
		return this.#data.games[gameId] ?? EMPTY;
	}

	get lastPlayed(): string | null {
		return this.#data.lastPlayed;
	}

	/** Aggregate totals across every game. */
	get totals(): { played: number; won: number; winRate: number } {
		let played = 0;
		let won = 0;
		for (const g of Object.values(this.#data.games)) {
			played += g.played;
			won += g.won;
		}
		return { played, won, winRate: played > 0 ? Math.round((won / played) * 100) : 0 };
	}

	/** Has any game ever been recorded? */
	get hasPlays(): boolean {
		return this.totals.played > 0;
	}

	/** Record a finished game. `won` extends/breaks the win streak. */
	record(gameId: string, won: boolean): void {
		const prev = this.#data.games[gameId] ?? EMPTY;
		const streak = won ? prev.streak + 1 : 0;
		const next: GameStat = {
			played: prev.played + 1,
			won: prev.won + (won ? 1 : 0),
			streak,
			best: Math.max(prev.best, streak)
		};
		this.#data = {
			games: { ...this.#data.games, [gameId]: next },
			lastPlayed: gameId
		};
		this.#persist();
	}

	/** Note that a game was opened (for "continue where you left off"). */
	touch(gameId: string): void {
		if (this.#data.lastPlayed === gameId) return;
		this.#data = { ...this.#data, lastPlayed: gameId };
		this.#persist();
	}

	reset(): void {
		this.#data = { games: {}, lastPlayed: null };
		this.#persist();
	}
}

export const stats = new StatsStore();
