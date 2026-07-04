/**
 * Ambient tracks — the material the sequencer (render/music.ts) plays. Unlike a
 * single arpeggiator, each track is its own little arrangement: a chord
 * progression in some key/scale, plus a handful of voices (bass, pad, a real
 * melodic lead, arps, sparkles, soft percussion) each with their own rhythm and
 * timbre. That's what makes them read as distinct tunes rather than the same
 * pattern re-keyed. All synthesized, no assets.
 *
 * Tracks are chosen to fit each game's vibe (GAME_MOOD), the engine adapts them
 * in real time to how you're doing, and a few are unlocked by achievements.
 */

// Note name → frequency (equal temperament). Sharps only.
const SEMI = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function hz(note: string): number {
	const m = /^([A-G]#?)(-?\d)$/.exec(note);
	if (!m) return 440;
	const midi = (Number(m[2]) + 1) * 12 + SEMI.indexOf(m[1]);
	return 440 * Math.pow(2, (midi - 69) / 12);
}

// Scales as semitone offsets from the tonic.
export const SCALES = {
	major: [0, 2, 4, 5, 7, 9, 11],
	minor: [0, 2, 3, 5, 7, 8, 10],
	harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
	dorian: [0, 2, 3, 5, 7, 9, 10],
	mixolydian: [0, 2, 4, 5, 7, 9, 10],
	lydian: [0, 2, 4, 6, 7, 9, 11],
	phrygianDom: [0, 1, 4, 5, 7, 8, 10],
	pentatonic: [0, 2, 4, 7, 9]
} as const;

/** One step in a part's pattern: a note index, a chord of them, or a rest. */
export type Cell = number | number[] | null;

export interface Voice {
	wave: OscillatorType;
	gain: number;
	attack: number; // seconds
	release: number; // seconds (pluck tail, or fade after the note ends)
	/** Hold the note until the part's next hit (pads/leads) instead of plucking. */
	sustain?: boolean;
	/** Octave shift applied to every note. */
	octave?: number;
	/** A detuned second oscillator (cents) for width/chorus. */
	detune?: number;
	/** Added octave-up partial level for shimmer. */
	partial?: number;
}

/** How a part's cell numbers are read. */
export type NoteMode = 'chord' | 'scale' | 'perc';

export interface Part {
	role: string;
	mode: NoteMode;
	voice: Voice;
	/** Steps, indexed by globalStep % pattern.length (so it can span bars). */
	pattern: Cell[];
}

export interface Mood {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly root: string; // tonic pitch for scale-degree 0 (e.g. 'C4')
	readonly scale: readonly number[];
	readonly progression: readonly number[]; // chord-root scale degrees, one per bar
	readonly stepMs: number;
	readonly stepsPerBar: number;
	readonly parts: readonly Part[];
	readonly cutoff: number; // master lowpass base (brightness)
	readonly delayTime: number; // echo spacing (s)
	readonly feedback: number; // echo feedback 0–0.5
	readonly unlock?: string; // achievement id, if locked
}

/** Build a step pattern from a sparse {step: cell} map. */
function seq(len: number, hits: Record<number, Cell>): Cell[] {
	const a: Cell[] = new Array(len).fill(null);
	for (const k in hits) a[+k] = hits[k];
	return a;
}

// Reusable voice presets (tweaked per track).
const musicBox = (o: Partial<Voice> = {}): Voice => ({
	wave: 'sine',
	gain: 0.09,
	attack: 0.005,
	release: 1.3,
	partial: 0.35,
	...o
});
const bass = (o: Partial<Voice> = {}): Voice => ({
	wave: 'triangle',
	gain: 0.11,
	attack: 0.008,
	release: 0.5,
	octave: -2,
	...o
});
const pad = (o: Partial<Voice> = {}): Voice => ({
	wave: 'triangle',
	gain: 0.05,
	attack: 0.5,
	release: 1.1,
	sustain: true,
	detune: 6,
	...o
});
const lead = (o: Partial<Voice> = {}): Voice => ({
	wave: 'sine',
	gain: 0.085,
	attack: 0.03,
	release: 0.5,
	sustain: true,
	...o
});
const pluck = (o: Partial<Voice> = {}): Voice => ({
	wave: 'triangle',
	gain: 0.07,
	attack: 0.003,
	release: 0.32,
	...o
});
const glass = (o: Partial<Voice> = {}): Voice => ({
	wave: 'sine',
	gain: 0.055,
	attack: 0.003,
	release: 1.7,
	partial: 0.5,
	...o
});
const perc = (o: Partial<Voice> = {}): Voice => ({
	wave: 'sine', // ignored for perc mode; a noise hit is used
	gain: 0.05,
	attack: 0.001,
	release: 0.09,
	...o
});

export const MOODS: readonly Mood[] = [
	// ── Sunbeam · Klondike — a bright music-box waltz (3/4) ───────────────
	{
		id: 'sunbeam',
		name: 'Sunbeam',
		description: 'A bright little music-box waltz. Warm and sunny.',
		root: 'C4',
		scale: SCALES.major,
		progression: [0, 3, 4, 0, 5, 3, 4, 4], // I IV V I vi IV V V
		stepMs: 200,
		stepsPerBar: 12, // 3 beats × 4
		cutoff: 3200,
		delayTime: 0.3,
		feedback: 0.24,
		parts: [
			{ role: 'bass', mode: 'chord', voice: bass(), pattern: seq(12, { 0: 0, 4: 2, 8: 1 }) },
			{
				role: 'pad',
				mode: 'chord',
				voice: pad({ gain: 0.04 }),
				pattern: seq(12, { 0: [0, 1, 2] })
			},
			{
				role: 'lead',
				mode: 'scale',
				voice: musicBox(),
				pattern: seq(24, { 0: 4, 4: 2, 8: 0, 12: 2, 16: 4, 20: 7, 22: 4 })
			}
		]
	},
	// ── Lagoon · FreeCell — ambient, near-beatless pad wash ───────────────
	{
		id: 'lagoon',
		name: 'Lagoon',
		description: 'A slow, dreamy wash of pads and far-off bells.',
		root: 'F3',
		scale: SCALES.major,
		progression: [0, 4, 1, 3], // I V ii IV
		stepMs: 300,
		stepsPerBar: 16,
		cutoff: 2500,
		delayTime: 0.4,
		feedback: 0.34,
		parts: [
			{
				role: 'pad',
				mode: 'chord',
				voice: pad({ gain: 0.055, attack: 1.0, release: 2.0 }),
				pattern: seq(16, { 0: [0, 1, 2, 4] })
			},
			{
				role: 'sub',
				mode: 'chord',
				voice: bass({ gain: 0.06, attack: 0.4 }),
				pattern: seq(16, { 0: 0 })
			},
			{
				role: 'bell',
				mode: 'scale',
				voice: glass({ octave: 1, gain: 0.045 }),
				pattern: seq(32, { 6: 4, 14: 6, 22: 7, 26: 4 })
			}
		]
	},
	// ── Carousel · TriPeaks — bouncy, playful, quick ──────────────────────
	{
		id: 'carousel',
		name: 'Carousel',
		description: 'Bouncy and playful — quick plucks and a skipping tune.',
		root: 'D4',
		scale: SCALES.major,
		progression: [0, 4, 5, 3], // I V vi IV
		stepMs: 150,
		stepsPerBar: 16,
		cutoff: 3500,
		delayTime: 0.28,
		feedback: 0.22,
		parts: [
			{
				role: 'bass',
				mode: 'chord',
				voice: bass({ release: 0.28 }),
				pattern: seq(16, { 0: 0, 4: 2, 8: 0, 12: 2 })
			},
			{
				role: 'arp',
				mode: 'chord',
				voice: pluck(),
				pattern: seq(16, { 0: 0, 2: 1, 4: 2, 6: 3, 8: 2, 10: 1, 12: 2, 14: 3 })
			},
			{
				role: 'lead',
				mode: 'scale',
				voice: musicBox({ partial: 0.3, release: 0.7 }),
				pattern: seq(32, { 2: 7, 6: 6, 10: 4, 14: 5, 18: 7, 22: 9, 26: 7, 28: 4 })
			}
		]
	},
	// ── Moonlit · Spider — a slow, brooding minor nocturne ────────────────
	{
		id: 'moonlit',
		name: 'Moonlit',
		description: 'A slow, brooding nocturne for the long, tricky games.',
		root: 'A3',
		scale: SCALES.minor,
		progression: [0, 5, 2, 4], // i VI III v
		stepMs: 280,
		stepsPerBar: 16,
		cutoff: 2200,
		delayTime: 0.38,
		feedback: 0.34,
		parts: [
			{
				role: 'bass',
				mode: 'chord',
				voice: bass({ gain: 0.1, release: 1.2 }),
				pattern: seq(16, { 0: 0, 10: 2 })
			},
			{
				role: 'pad',
				mode: 'chord',
				voice: pad({ gain: 0.05, attack: 0.8 }),
				pattern: seq(16, { 0: [0, 1, 2] })
			},
			{
				role: 'lead',
				mode: 'scale',
				voice: lead({ wave: 'triangle', gain: 0.07, release: 0.9 }),
				pattern: seq(32, { 0: 7, 6: 6, 12: 4, 16: 2, 20: 4, 24: 3, 30: 2 })
			}
		]
	},
	// ── Meadow · Golf — a breezy pentatonic folk lilt ─────────────────────
	{
		id: 'meadow',
		name: 'Meadow',
		description: 'Breezy and open — a light pentatonic lilt.',
		root: 'G3',
		scale: SCALES.pentatonic,
		progression: [0, 3, 1, 4],
		stepMs: 170,
		stepsPerBar: 16,
		cutoff: 3600,
		delayTime: 0.26,
		feedback: 0.22,
		parts: [
			{
				role: 'bass',
				mode: 'chord',
				voice: bass({ release: 0.5 }),
				pattern: seq(16, { 0: 0, 8: 2 })
			},
			{
				role: 'pluck',
				mode: 'chord',
				voice: pluck({ gain: 0.055 }),
				pattern: seq(16, { 2: 1, 6: 2, 10: 1, 14: 3 })
			},
			{
				role: 'lead',
				mode: 'scale',
				voice: lead({ wave: 'sine', gain: 0.08, attack: 0.02, release: 0.6 }),
				pattern: seq(32, { 0: 2, 4: 4, 8: 5, 12: 4, 16: 7, 20: 5, 24: 4, 28: 2 })
			}
		]
	},
	// ── Tavern · Euchre — a jaunty jig (6/8 compound) ─────────────────────
	{
		id: 'tavern',
		name: 'Tavern',
		description: 'A jaunty folk jig — good company at the card table.',
		root: 'D4',
		scale: SCALES.mixolydian,
		progression: [0, 6, 3, 4], // I bVII IV V (mixolydian colour)
		stepMs: 145,
		stepsPerBar: 12, // 2 dotted beats × 6
		cutoff: 3300,
		delayTime: 0.24,
		feedback: 0.2,
		parts: [
			{
				role: 'bass',
				mode: 'chord',
				voice: bass({ release: 0.3 }),
				pattern: seq(12, { 0: 0, 6: 2 })
			},
			{
				role: 'chords',
				mode: 'chord',
				voice: pluck({ gain: 0.05, release: 0.2 }),
				pattern: seq(12, { 3: [0, 1, 2], 9: [0, 1, 2] })
			},
			{
				role: 'lead',
				mode: 'scale',
				voice: lead({ wave: 'triangle', gain: 0.08, attack: 0.01, release: 0.35, sustain: false }),
				pattern: seq(24, { 0: 4, 2: 5, 4: 6, 6: 7, 9: 6, 12: 4, 14: 2, 16: 4, 18: 6, 21: 4 })
			}
		]
	},
	// ── Sandstorm · Pyramid — exotic, hypnotic, with a shaker ─────────────
	{
		id: 'sandstorm',
		name: 'Sandstorm',
		description: 'Ancient and hypnotic — a snaking harmonic-minor spell.',
		root: 'D4',
		scale: SCALES.phrygianDom,
		progression: [0, 0, 3, 0], // droning around the tonic
		stepMs: 210,
		stepsPerBar: 16,
		cutoff: 2600,
		delayTime: 0.33,
		feedback: 0.3,
		parts: [
			{
				role: 'drone',
				mode: 'chord',
				voice: bass({ gain: 0.1, attack: 0.3, release: 2.0 }),
				pattern: seq(16, { 0: 0 })
			},
			{
				role: 'shaker',
				mode: 'perc',
				voice: perc({ gain: 0.03 }),
				pattern: seq(8, { 0: 1, 2: 0.5, 3: 1, 5: 0.6, 6: 1 })
			},
			{
				role: 'lead',
				mode: 'scale',
				voice: lead({ wave: 'sine', gain: 0.075, attack: 0.015, release: 0.45, sustain: false }),
				pattern: seq(32, {
					0: 0,
					3: 1,
					6: 2,
					8: 1,
					11: 2,
					14: 3,
					16: 2,
					19: 1,
					22: 0,
					26: 1,
					29: 0
				})
			}
		]
	},
	// ── Nocturne · unlock: Night Owl — soft late-night jazz ───────────────
	{
		id: 'nocturne',
		name: 'Nocturne',
		description: 'Hushed, late-night jazz. Unlocked by the Night Owl badge.',
		root: 'E3',
		scale: SCALES.dorian,
		progression: [0, 3, 1, 4], // i IV ii v-ish (dorian)
		stepMs: 250,
		stepsPerBar: 16,
		cutoff: 2400,
		delayTime: 0.4,
		feedback: 0.32,
		unlock: 'night-owl',
		parts: [
			{
				role: 'bass',
				mode: 'chord',
				voice: bass({ gain: 0.1, release: 0.9 }),
				pattern: seq(16, { 0: 0, 6: 1, 10: 2 })
			},
			{
				role: 'keys',
				mode: 'chord',
				voice: pad({ gain: 0.045, attack: 0.3, release: 0.9 }),
				pattern: seq(16, { 2: [0, 1, 2, 3], 10: [0, 1, 2, 3] }) // 7th chords
			},
			{
				role: 'lead',
				mode: 'scale',
				voice: lead({ wave: 'sine', gain: 0.07, attack: 0.04, release: 0.8 }),
				pattern: seq(32, { 0: 4, 5: 5, 8: 4, 12: 2, 18: 3, 22: 4, 27: 2 })
			}
		]
	},
	// ── Sunrise · unlock: Early Bird — uplifting lydian build ─────────────
	{
		id: 'sunrise',
		name: 'Sunrise',
		description: 'Bright and rising, with a lydian glow. Unlocked by Early Bird.',
		root: 'D4',
		scale: SCALES.lydian,
		progression: [0, 1, 4, 0], // I II V I (lydian II)
		stepMs: 165,
		stepsPerBar: 16,
		cutoff: 3800,
		delayTime: 0.27,
		feedback: 0.26,
		unlock: 'early-bird',
		parts: [
			{
				role: 'bass',
				mode: 'chord',
				voice: bass({ release: 0.4 }),
				pattern: seq(16, { 0: 0, 8: 0 })
			},
			{
				role: 'arp',
				mode: 'chord',
				voice: pluck({ gain: 0.055, release: 0.4 }),
				pattern: seq(16, { 0: 0, 2: 1, 4: 2, 6: 3, 8: 4, 10: 3, 12: 2, 14: 1 })
			},
			{
				role: 'lead',
				mode: 'scale',
				voice: lead({ wave: 'triangle', gain: 0.08, release: 0.6 }),
				pattern: seq(32, { 0: 2, 6: 4, 12: 6, 16: 7, 22: 9, 28: 7 })
			}
		]
	},
	// ── Triumph · unlock: Unstoppable — majestic and bold ─────────────────
	{
		id: 'triumph',
		name: 'Triumph',
		description: 'Warm and majestic, with bold chords. Unlocked by Unstoppable.',
		root: 'C4',
		scale: SCALES.major,
		progression: [0, 5, 3, 4], // I vi IV V
		stepMs: 190,
		stepsPerBar: 16,
		cutoff: 3400,
		delayTime: 0.26,
		feedback: 0.24,
		unlock: 'streak-5',
		parts: [
			{
				role: 'bass',
				mode: 'chord',
				voice: bass({ gain: 0.12, release: 0.45 }),
				pattern: seq(16, { 0: 0, 4: 0, 8: 2, 12: 2 })
			},
			{
				role: 'stabs',
				mode: 'chord',
				voice: pluck({ wave: 'sawtooth', gain: 0.05, release: 0.35 }),
				pattern: seq(16, { 0: [0, 1, 2], 6: [0, 1, 2], 8: [0, 1, 2], 12: [0, 1, 2] })
			},
			{
				role: 'lead',
				mode: 'scale',
				voice: lead({ wave: 'triangle', gain: 0.09, attack: 0.02, release: 0.7 }),
				pattern: seq(32, { 0: 4, 4: 7, 8: 4, 12: 9, 16: 7, 20: 4, 24: 5, 28: 7 })
			}
		]
	},
	// ── Aurora · unlock: Jack of All Trades — glacial shimmer ─────────────
	{
		id: 'aurora',
		name: 'Aurora',
		description: 'Wide, glacial shimmer. Unlocked by Jack of All Trades.',
		root: 'A3',
		scale: SCALES.major,
		progression: [0, 4, 5, 3],
		stepMs: 320,
		stepsPerBar: 16,
		cutoff: 3900,
		delayTime: 0.45,
		feedback: 0.36,
		unlock: 'all-families',
		parts: [
			{
				role: 'pad',
				mode: 'chord',
				voice: pad({ gain: 0.05, attack: 1.2, release: 2.2, detune: 9 }),
				pattern: seq(16, { 0: [0, 1, 2, 4] })
			},
			{
				role: 'shimmer',
				mode: 'chord',
				voice: glass({ octave: 1, gain: 0.04, release: 2.0 }),
				pattern: seq(16, { 0: 4, 4: 5, 8: 6, 12: 5 })
			},
			{
				role: 'bell',
				mode: 'scale',
				voice: glass({ octave: 1, gain: 0.04 }),
				pattern: seq(32, { 3: 7, 11: 9, 19: 11, 27: 9 })
			}
		]
	},
	// ── Frost · unlock: Card Sharp — crystalline and icy ──────────────────
	{
		id: 'frost',
		name: 'Frost',
		description: 'Crystalline and cool. Unlocked by the Card Sharp badge.',
		root: 'C#4',
		scale: SCALES.minor,
		progression: [0, 5, 2, 4],
		stepMs: 175,
		stepsPerBar: 16,
		cutoff: 4200,
		delayTime: 0.3,
		feedback: 0.3,
		unlock: 'fifty-wins',
		parts: [
			{
				role: 'bass',
				mode: 'chord',
				voice: bass({ gain: 0.07, release: 0.6 }),
				pattern: seq(16, { 0: 0, 8: 0 })
			},
			{
				role: 'glass',
				mode: 'chord',
				voice: glass({ gain: 0.05, release: 0.9, partial: 0.6 }),
				pattern: seq(16, { 0: 0, 3: 2, 6: 1, 9: 3, 12: 2, 15: 1 })
			},
			{
				role: 'lead',
				mode: 'scale',
				voice: glass({ octave: 1, gain: 0.045, release: 0.8 }),
				pattern: seq(32, { 0: 4, 8: 6, 16: 7, 20: 6, 24: 4, 30: 2 })
			}
		]
	}
];

const BY_ID: Record<string, Mood> = Object.fromEntries(MOODS.map((m) => [m.id, m]));

/** The mood the home screen / lobby plays. */
export const LOBBY_MOOD = 'sunbeam';

/** Per-game mood — captures each game's vibe. Falls back to the lobby mood. */
export const GAME_MOOD: Record<string, string> = {
	klondike: 'sunbeam',
	'klondike-draw1': 'sunbeam',
	freecell: 'lagoon',
	yukon: 'sunbeam',
	fortythieves: 'moonlit',
	scorpion: 'moonlit',
	'spider-1suit': 'moonlit',
	'spider-2suit': 'moonlit',
	spider: 'moonlit',
	golf: 'meadow',
	tripeaks: 'carousel',
	pyramid: 'sandstorm',
	acesup: 'meadow',
	euchre: 'tavern',
	euchre2: 'tavern',
	euchre3: 'tavern',
	hearts: 'moonlit',
	spades: 'tavern',
	whist: 'tavern',
	ohhell: 'carousel'
};

export function getMood(id: string): Mood | undefined {
	return BY_ID[id];
}

/** The mood a game should use by default. */
export function moodForGame(gameId: string | undefined): Mood {
	return (gameId && BY_ID[GAME_MOOD[gameId]]) || BY_ID[LOBBY_MOOD];
}

/** Whether a mood is available given an achievement-unlock predicate. */
export function isMoodUnlocked(mood: Mood, has: (achId: string) => boolean): boolean {
	return mood.unlock === undefined || has(mood.unlock);
}
