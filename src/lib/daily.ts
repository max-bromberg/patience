/**
 * Daily challenge: a deterministic game + seed derived from the calendar date,
 * so everyone playing on the same local day gets the same deal. Pure and
 * date-injected for testability.
 */

export interface DailyInfo {
	/** 'YYYY-MM-DD' for the given date (local). */
	readonly key: string;
	/** Seed for the day's deal — shared by all players that day. */
	readonly seed: number;
	/** Which game is featured that day (rotates through the catalog). */
	readonly gameId: string;
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

export function dateKey(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A stable integer for the local calendar day, used as the daily seed. */
export function dayNumber(d: Date): number {
	return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** The key for the day before `d` (used for streak continuity). */
export function previousKey(d: Date): string {
	const p = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
	return dateKey(p);
}

export function dailyFor(d: Date, gameIds: readonly string[]): DailyInfo {
	const n = dayNumber(d);
	const gameId = gameIds.length > 0 ? gameIds[n % gameIds.length] : '';
	return { key: dateKey(d), seed: n, gameId };
}
