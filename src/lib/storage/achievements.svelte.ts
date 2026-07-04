/**
 * Reactive, persisted achievement progress. Stores an id → unlock-timestamp map,
 * plus a small in-memory queue of just-unlocked badges for the celebration
 * popup. All local; no accounts, no network.
 *
 * Evaluation entry points:
 *  - reconcile()      — grant already-earned badges silently. Called once at
 *                       launch so a returning player isn't buried in popups for
 *                       progress they made before achievements existed.
 *  - recordResult(..) — after a game finishes; grants + queues popups.
 *  - refresh()        — after an aggregate change (e.g. daily streak); grants +
 *                       queues popups, without a just-finished game.
 */

import {
	ACHIEVEMENTS,
	achievementById,
	type Achievement,
	type AchievementContext
} from '$lib/achievements/catalog';
import { readJSON, writeJSON } from './storage';
import { daily } from './daily.svelte';
import { stats } from './stats.svelte';

const KEY = 'achievements';

interface AchievementData {
	/** id → ISO timestamp unlocked. */
	unlocked: Record<string, string>;
}

export interface FinishedGame {
	gameId: string;
	family: string;
	won: boolean;
	timeMs?: number;
	moves?: number;
}

class AchievementsStore {
	#data = $state<AchievementData>({ unlocked: {} });
	/** Just-unlocked badges awaiting their celebration popup (front = current). */
	#queue = $state<Achievement[]>([]);

	constructor() {
		const saved = readJSON<AchievementData>(KEY, { unlocked: {} });
		this.#data = { unlocked: saved.unlocked ?? {} };
	}

	#persist(): void {
		writeJSON(KEY, this.#data);
	}

	#buildContext(finish?: FinishedGame): AchievementContext {
		const totals = stats.totals;
		return {
			totalPlayed: totals.played,
			totalWon: totals.won,
			bestStreakAnyGame: stats.bestStreak,
			wonGameIds: stats.wonGameIds,
			playedGameIds: stats.playedGameIds,
			dailyStreak: daily.streak,
			finishedAt: new Date(),
			justFinishedGame: finish !== undefined,
			win:
				finish?.won === true
					? {
							gameId: finish.gameId,
							family: finish.family,
							timeMs: finish.timeMs,
							moves: finish.moves
						}
					: undefined
		};
	}

	#grant(id: string, silent: boolean): void {
		if (this.#data.unlocked[id]) return;
		this.#data = { unlocked: { ...this.#data.unlocked, [id]: new Date().toISOString() } };
		this.#persist();
		if (!silent) {
			const def = achievementById(id);
			if (def) this.#queue = [...this.#queue, def];
		}
	}

	#evaluate(finish: FinishedGame | undefined, silent: boolean): void {
		const ctx = this.#buildContext(finish);
		for (const a of ACHIEVEMENTS) if (!this.has(a.id) && a.test(ctx)) this.#grant(a.id, silent);
	}

	/** Silently grant everything already earned (existing progress). Once, at launch. */
	reconcile(): void {
		this.#evaluate(undefined, true);
	}

	/** Evaluate after a finished game; queues popups for anything newly unlocked. */
	recordResult(finish: FinishedGame): void {
		this.#evaluate(finish, false);
	}

	/** Evaluate aggregate-only badges (e.g. after a daily streak ticks up). */
	refresh(): void {
		this.#evaluate(undefined, false);
	}

	has(id: string): boolean {
		return this.#data.unlocked[id] !== undefined;
	}

	unlockedAt(id: string): string | undefined {
		return this.#data.unlocked[id];
	}

	get earnedCount(): number {
		return Object.keys(this.#data.unlocked).length;
	}

	/** The badge currently being celebrated, if any. */
	get current(): Achievement | null {
		return this.#queue[0] ?? null;
	}

	/** Dismiss the current celebration; the next queued badge (if any) shows next. */
	dismissCurrent(): void {
		this.#queue = this.#queue.slice(1);
	}

	reset(): void {
		this.#data = { unlocked: {} };
		this.#queue = [];
		this.#persist();
	}
}

export const achievements = new AchievementsStore();
