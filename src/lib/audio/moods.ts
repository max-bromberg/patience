/**
 * Ambient "moods" — the palette the music-box engine (render/music.ts) draws
 * from. Each mood is a small set of consonant chord voicings plus timbre and
 * feel parameters; the engine arpeggiates the current chord into soft bell
 * tones. All synthesized, no assets.
 *
 * Moods are chosen to fit each game's vibe (see GAME_MOOD), and the engine also
 * adapts a mood in real time to how you're doing (brighter/livelier as you close
 * in on a win, quieter and more pensive when you're stuck). A handful of bonus
 * moods are unlocked by achievements and can be picked in Settings.
 */

// Equal-temperament note → frequency, so chords read by name. Sharps only.
const SEMITONES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function hz(note: string): number {
	const m = /^([A-G]#?)(\d)$/.exec(note);
	if (!m) return 440;
	const midi = (Number(m[2]) + 1) * 12 + SEMITONES.indexOf(m[1]);
	return 440 * Math.pow(2, (midi - 69) / 12);
}
/** Build a chord (array of frequencies) from note names. */
const ch = (...names: string[]): number[] => names.map(hz);

export interface Mood {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	/** Four-note voicings the arpeggio draws its notes from. */
	readonly chords: number[][];
	readonly stepMs: number; // time between arpeggio notes (tempo/feel)
	readonly stepsPerChord: number; // notes before moving to the next chord
	readonly cutoff: number; // lowpass base (higher = brighter/airier)
	readonly arpGain: number; // peak level of each bell pluck
	readonly padGain: number; // level of the soft octave pad bed (0 = none)
	readonly delayTime: number; // echo spacing (s)
	readonly feedback: number; // echo feedback amount (0–0.5)
	readonly wave: OscillatorType; // pluck fundamental timbre
	readonly partial: number; // octave-partial level (brightness/shimmer)
	/** Melodic contour: indices into the two-octave chord pool; -1 = rest. */
	readonly arp: readonly number[];
	/** Achievement id that unlocks this mood; undefined = always available. */
	readonly unlock?: string;
}

// A few melodic contours give the moods rhythmic identity. Lengths coprime with
// the chord step counts so the figure evolves across the loop.
const FLOW = [0, 2, 4, 7, 5, 3, -1]; // gentle music-box
const RISE = [0, 2, 4, 5, 7, 6, 4, 2]; // busier, climbing
const SPARSE = [0, 4, -1, 7, -1, 2, -1]; // airy, lots of space
const ROCK = [0, 3, 5, 3, 7, 5, -1, 2]; // jauntier, folk

export const MOODS: readonly Mood[] = [
	// ---- always-available game vibes -------------------------------------
	{
		id: 'sunbeam',
		name: 'Sunbeam',
		description: 'Warm and sunny — the classic Klondike feel.',
		chords: [
			ch('C4', 'E4', 'G4', 'C5'),
			ch('G3', 'B3', 'D4', 'G4'),
			ch('A3', 'C4', 'E4', 'A4'),
			ch('F3', 'A3', 'C4', 'F4'),
			ch('C4', 'E4', 'G4', 'C5'),
			ch('G3', 'B3', 'D4', 'G4'),
			ch('F3', 'A3', 'C4', 'F4'),
			ch('G3', 'B3', 'D4', 'G4')
		],
		stepMs: 300,
		stepsPerChord: 12,
		cutoff: 3200,
		arpGain: 0.1,
		padGain: 0.05,
		delayTime: 0.3,
		feedback: 0.26,
		wave: 'sine',
		partial: 0.32,
		arp: FLOW
	},
	{
		id: 'lagoon',
		name: 'Lagoon',
		description: 'Soft and dreamy — calm, unhurried thinking.',
		chords: [
			ch('F3', 'A3', 'C4', 'F4'),
			ch('C4', 'E4', 'G4', 'C5'),
			ch('D3', 'F3', 'A3', 'D4'),
			ch('A#3', 'D4', 'F4', 'A#4'),
			ch('F3', 'A3', 'C4', 'F4'),
			ch('C4', 'E4', 'G4', 'C5'),
			ch('D3', 'F3', 'A3', 'D4'),
			ch('C4', 'E4', 'G4', 'C5')
		],
		stepMs: 360,
		stepsPerChord: 12,
		cutoff: 2700,
		arpGain: 0.1,
		padGain: 0.06,
		delayTime: 0.36,
		feedback: 0.3,
		wave: 'sine',
		partial: 0.28,
		arp: SPARSE
	},
	{
		id: 'carousel',
		name: 'Carousel',
		description: 'Bright and playful — light, quick, and cheerful.',
		chords: [
			ch('D4', 'F#4', 'A4', 'D5'),
			ch('A3', 'C#4', 'E4', 'A4'),
			ch('B3', 'D4', 'F#4', 'B4'),
			ch('G3', 'B3', 'D4', 'G4'),
			ch('D4', 'F#4', 'A4', 'D5'),
			ch('A3', 'C#4', 'E4', 'A4'),
			ch('G3', 'B3', 'D4', 'G4'),
			ch('A3', 'C#4', 'E4', 'A4')
		],
		stepMs: 280,
		stepsPerChord: 16,
		cutoff: 3400,
		arpGain: 0.1,
		padGain: 0.05,
		delayTime: 0.28,
		feedback: 0.24,
		wave: 'triangle',
		partial: 0.34,
		arp: RISE
	},
	{
		id: 'moonlit',
		name: 'Moonlit',
		description: 'Pensive and cool — for the long, tricky games.',
		chords: [
			ch('A3', 'C4', 'E4', 'A4'), // Am
			ch('F3', 'A3', 'C4', 'F4'), // F
			ch('C4', 'E4', 'G4', 'C5'), // C
			ch('G3', 'B3', 'D4', 'G4'), // G
			ch('A3', 'C4', 'E4', 'A4'), // Am
			ch('D3', 'F3', 'A3', 'D4'), // Dm
			ch('E3', 'G#3', 'B3', 'E4'), // E (raised leading tone)
			ch('A3', 'C4', 'E4', 'A4') // Am
		],
		stepMs: 340,
		stepsPerChord: 12,
		cutoff: 2400,
		arpGain: 0.1,
		padGain: 0.07,
		delayTime: 0.34,
		feedback: 0.32,
		wave: 'sine',
		partial: 0.26,
		arp: FLOW
	},
	{
		id: 'meadow',
		name: 'Meadow',
		description: 'Airy and breezy — a light pentatonic lilt.',
		chords: [
			ch('G3', 'B3', 'D4', 'G4'), // G
			ch('E3', 'G3', 'B3', 'E4'), // Em
			ch('C4', 'E4', 'G4', 'C5'), // C
			ch('D4', 'F#4', 'A4', 'D5'), // D
			ch('G3', 'B3', 'D4', 'G4'),
			ch('C4', 'E4', 'G4', 'C5'),
			ch('E3', 'G3', 'B3', 'E4'),
			ch('D4', 'F#4', 'A4', 'D5')
		],
		stepMs: 250,
		stepsPerChord: 12,
		cutoff: 3600,
		arpGain: 0.095,
		padGain: 0.045,
		delayTime: 0.25,
		feedback: 0.22,
		wave: 'triangle',
		partial: 0.3,
		arp: RISE
	},
	{
		id: 'tavern',
		name: 'Tavern',
		description: 'Jaunty and folksy — good company at the card table.',
		chords: [
			ch('D4', 'F#4', 'A4', 'D5'), // D
			ch('C4', 'E4', 'G4', 'C5'), // C (bVII → mixolydian)
			ch('G3', 'B3', 'D4', 'G4'), // G
			ch('D4', 'F#4', 'A4', 'D5'),
			ch('C4', 'E4', 'G4', 'C5'),
			ch('G3', 'B3', 'D4', 'G4'),
			ch('A3', 'C#4', 'E4', 'A4'), // A
			ch('D4', 'F#4', 'A4', 'D5')
		],
		stepMs: 260,
		stepsPerChord: 8,
		cutoff: 3200,
		arpGain: 0.1,
		padGain: 0.05,
		delayTime: 0.26,
		feedback: 0.22,
		wave: 'triangle',
		partial: 0.36,
		arp: ROCK
	},
	{
		id: 'sandstorm',
		name: 'Sandstorm',
		description: 'Ancient and exotic — a harmonic-minor mystery.',
		chords: [
			ch('D3', 'F3', 'A3', 'D4'), // Dm
			ch('G3', 'A#3', 'D4', 'G4'), // Gm
			ch('A3', 'C#4', 'E4', 'A4'), // A (raised 3rd → exotic)
			ch('D3', 'F3', 'A3', 'D4'),
			ch('A#3', 'D4', 'F4', 'A#4'), // A#
			ch('G3', 'A#3', 'D4', 'G4'),
			ch('A3', 'C#4', 'E4', 'A4'),
			ch('D3', 'F3', 'A3', 'D4')
		],
		stepMs: 320,
		stepsPerChord: 10,
		cutoff: 2500,
		arpGain: 0.1,
		padGain: 0.06,
		delayTime: 0.33,
		feedback: 0.3,
		wave: 'sine',
		partial: 0.4,
		arp: FLOW
	},
	// ---- bonus moods, unlocked by achievements ---------------------------
	{
		id: 'nocturne',
		name: 'Nocturne',
		description: 'Hushed and late-night. Unlocked by the Night Owl badge.',
		chords: [
			ch('E3', 'G3', 'B3', 'E4'), // Em
			ch('A3', 'C4', 'E4', 'A4'), // Am
			ch('B3', 'D#4', 'F#4', 'B4'), // B (raised 3rd)
			ch('E3', 'G3', 'B3', 'E4'),
			ch('C4', 'E4', 'G4', 'C5'), // C
			ch('A3', 'C4', 'E4', 'A4'),
			ch('B3', 'D#4', 'F#4', 'B4'),
			ch('E3', 'G3', 'B3', 'E4')
		],
		stepMs: 400,
		stepsPerChord: 12,
		cutoff: 2100,
		arpGain: 0.1,
		padGain: 0.08,
		delayTime: 0.42,
		feedback: 0.36,
		wave: 'sine',
		partial: 0.22,
		arp: SPARSE,
		unlock: 'night-owl'
	},
	{
		id: 'sunrise',
		name: 'Sunrise',
		description: 'Bright and hopeful. Unlocked by the Early Bird badge.',
		chords: [
			ch('D4', 'F#4', 'A4', 'D5'), // D
			ch('E4', 'G#4', 'B4', 'E5'), // E (lydian II)
			ch('A3', 'C#4', 'E4', 'A4'), // A
			ch('D4', 'F#4', 'A4', 'D5'),
			ch('G3', 'B3', 'D4', 'G4'), // G (with G# in melody = lydian)
			ch('E4', 'G#4', 'B4', 'E5'),
			ch('A3', 'C#4', 'E4', 'A4'),
			ch('D4', 'F#4', 'A4', 'D5')
		],
		stepMs: 270,
		stepsPerChord: 12,
		cutoff: 3800,
		arpGain: 0.095,
		padGain: 0.05,
		delayTime: 0.27,
		feedback: 0.24,
		wave: 'triangle',
		partial: 0.34,
		arp: RISE,
		unlock: 'early-bird'
	},
	{
		id: 'triumph',
		name: 'Triumph',
		description: 'Warm and majestic. Unlocked by the Unstoppable badge.',
		chords: [
			ch('C4', 'E4', 'G4', 'C5'), // C
			ch('F3', 'A3', 'C4', 'F4'), // F
			ch('G3', 'B3', 'D4', 'G4'), // G
			ch('C4', 'E4', 'G4', 'C5'),
			ch('A3', 'C#4', 'E4', 'A4'), // A (secondary dominant lift)
			ch('F3', 'A3', 'C4', 'F4'),
			ch('G3', 'B3', 'D4', 'G4'),
			ch('C4', 'E4', 'G4', 'C5')
		],
		stepMs: 260,
		stepsPerChord: 8,
		cutoff: 3600,
		arpGain: 0.11,
		padGain: 0.08,
		delayTime: 0.26,
		feedback: 0.24,
		wave: 'triangle',
		partial: 0.4,
		arp: ROCK,
		unlock: 'streak-5'
	},
	{
		id: 'aurora',
		name: 'Aurora',
		description: 'Lush and shimmering. Unlocked by Jack of All Trades.',
		chords: [
			ch('A3', 'C#4', 'E4', 'A4'), // A
			ch('E4', 'G#4', 'B4', 'E5'), // E
			ch('F#3', 'A3', 'C#4', 'F#4'), // F#m
			ch('D4', 'F#4', 'A4', 'D5'), // D
			ch('A3', 'C#4', 'E4', 'A4'),
			ch('E4', 'G#4', 'B4', 'E5'),
			ch('D4', 'F#4', 'A4', 'D5'),
			ch('E4', 'G#4', 'B4', 'E5')
		],
		stepMs: 330,
		stepsPerChord: 14,
		cutoff: 3900,
		arpGain: 0.09,
		padGain: 0.07,
		delayTime: 0.4,
		feedback: 0.34,
		wave: 'sine',
		partial: 0.44,
		arp: SPARSE,
		unlock: 'all-families'
	},
	{
		id: 'frost',
		name: 'Frost',
		description: 'Cool and glassy. Unlocked by the Card Sharp badge.',
		chords: [
			ch('C#4', 'E4', 'G#4', 'C#5'), // C#m
			ch('A3', 'C#4', 'E4', 'A4'), // A
			ch('E4', 'G#4', 'B4', 'E5'), // E
			ch('B3', 'D#4', 'F#4', 'B4'), // B
			ch('C#4', 'E4', 'G#4', 'C#5'),
			ch('A3', 'C#4', 'E4', 'A4'),
			ch('B3', 'D#4', 'F#4', 'B4'),
			ch('E4', 'G#4', 'B4', 'E5')
		],
		stepMs: 300,
		stepsPerChord: 12,
		cutoff: 4200,
		arpGain: 0.088,
		padGain: 0.05,
		delayTime: 0.31,
		feedback: 0.3,
		wave: 'sine',
		partial: 0.5,
		arp: FLOW,
		unlock: 'fifty-wins'
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
