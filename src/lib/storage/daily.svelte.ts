/**
 * Reactive, persisted daily-challenge progress: current streak, best streak,
 * and the last completed day. Read `daily.streak` etc. in components for live
 * updates.
 */

import { readJSON, writeJSON } from './storage';

interface DailyData {
	lastCompleted: string | null;
	streak: number;
	best: number;
}

const KEY = 'daily';
const DEFAULTS: DailyData = { lastCompleted: null, streak: 0, best: 0 };

class DailyStore {
	#data = $state<DailyData>(DEFAULTS);

	constructor() {
		this.#data = readJSON<DailyData>(KEY, DEFAULTS);
	}

	get streak(): number {
		return this.#data.streak;
	}

	get best(): number {
		return this.#data.best;
	}

	get lastCompleted(): string | null {
		return this.#data.lastCompleted;
	}

	isCompleted(key: string): boolean {
		return this.#data.lastCompleted === key;
	}

	/**
	 * Record a completed daily for `todayKey`. `yesterdayKey` extends the streak
	 * if that was the last completed day; otherwise the streak resets to 1.
	 * Idempotent for the same day.
	 */
	complete(todayKey: string, yesterdayKey: string): void {
		if (this.#data.lastCompleted === todayKey) return;
		const streak = this.#data.lastCompleted === yesterdayKey ? this.#data.streak + 1 : 1;
		this.#data = {
			lastCompleted: todayKey,
			streak,
			best: Math.max(this.#data.best, streak)
		};
		writeJSON(KEY, this.#data);
	}
}

export const daily = new DailyStore();
