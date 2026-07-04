import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '$lib/achievements/catalog';
import { catalog } from '$lib/games/registry';
import { GAME_MOOD, LOBBY_MOOD, MOODS, getMood, isMoodUnlocked, moodForGame } from './moods';

const MOOD_IDS = new Set(MOODS.map((m) => m.id));
const ACH_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));

describe('mood registry', () => {
	it('has unique mood ids', () => {
		expect(MOOD_IDS.size).toBe(MOODS.length);
	});

	it('every mood has four notes per chord', () => {
		for (const m of MOODS) for (const chord of m.chords) expect(chord.length).toBe(4);
	});

	it('the lobby mood exists', () => {
		expect(MOOD_IDS.has(LOBBY_MOOD)).toBe(true);
	});

	it('every game maps to a real mood', () => {
		for (const [game, mood] of Object.entries(GAME_MOOD)) {
			expect(MOOD_IDS.has(mood), `${game} → ${mood}`).toBe(true);
		}
	});

	it('every game in the catalog has a mood', () => {
		for (const meta of catalog) {
			expect(GAME_MOOD[meta.id], `no mood for ${meta.id}`).toBeDefined();
		}
	});

	it('unlockable moods reference real achievements', () => {
		for (const m of MOODS) {
			if (m.unlock) expect(ACH_IDS.has(m.unlock), `${m.id} → ${m.unlock}`).toBe(true);
		}
	});

	it('moodForGame falls back to the lobby mood for unknown ids', () => {
		expect(moodForGame(undefined).id).toBe(LOBBY_MOOD);
		expect(moodForGame('does-not-exist').id).toBe(LOBBY_MOOD);
		expect(moodForGame('klondike').id).toBe(GAME_MOOD['klondike']);
	});

	it('isMoodUnlocked gates on the achievement', () => {
		const locked = MOODS.find((m) => m.unlock)!;
		expect(isMoodUnlocked(locked, () => false)).toBe(false);
		expect(isMoodUnlocked(locked, (id) => id === locked.unlock)).toBe(true);
		const free = MOODS.find((m) => !m.unlock)!;
		expect(isMoodUnlocked(free, () => false)).toBe(true);
	});

	it('getMood resolves ids', () => {
		expect(getMood(LOBBY_MOOD)?.id).toBe(LOBBY_MOOD);
		expect(getMood('nope')).toBeUndefined();
	});
});
