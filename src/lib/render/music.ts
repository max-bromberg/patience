/**
 * Background ambience — a soft, generative pad with a gentle bell melody on
 * top. Several bright, major-key "moods" rotate one per session so it stays
 * fresh; each wanders an eight-chord progression (long enough not to feel
 * loopy) with a soft volume swell and a touch of filter movement so it
 * breathes. A sparse, warm "twinkle" line picks notes out of the current
 * chord so the music feels playful and tuneful, not like a drone. No audio
 * assets; all synthesized via Web Audio, SSR-safe, started from a user gesture.
 *
 * iOS Safari needs extra care to make a synth-only graph audible:
 *  - a 1-sample silent buffer must be played *inside* the unlocking gesture,
 *  - a silent looping <audio> element flips the audio session to the media
 *    channel so the hardware mute/ringer switch doesn't silence Web Audio,
 *  - the context must be resumed again after interruptions (tab hide, calls).
 */

import { readJSON, writeJSON } from '$lib/storage/storage';

type Ctor = typeof AudioContext;

// Equal-temperament note → frequency, so chords can be written by name. Sharps
// only (no flats) keeps the parser tiny; e.g. 'A#3' rather than 'Bb3'.
const SEMITONES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function hz(note: string): number {
	const m = /^([A-G]#?)(\d)$/.exec(note);
	if (!m) return 440;
	const midi = (Number(m[2]) + 1) * 12 + SEMITONES.indexOf(m[1]);
	return 440 * Math.pow(2, (midi - 69) / 12);
}
const ch = (...names: string[]): number[] => names.map(hz);

interface Mood {
	readonly name: string;
	readonly wave: OscillatorType;
	/** Open, consonant four-note voicings the pad wanders through. */
	readonly chords: number[][];
	readonly chordMs: number;
	readonly glideMs: number; // portamento between chords (ms)
	readonly cutoff: number; // lowpass base (higher = more open/airy)
	readonly detune: number; // cents of chorus spread (small = less wavering)
	readonly swellRate: number; // Hz of the volume LFO
	readonly swellDepth: number; // fraction of base gain
	readonly sweepDepth: number; // Hz of slow filter movement (0 = still)
	readonly twinkleMs: number; // cadence of the bell melody (0 = none)
	readonly twinkleGain: number; // peak bell level at the filter input
}

// Bright, major-key, openly voiced moods — warm and cheerful, never eerie.
const MOODS: Mood[] = [
	{
		// C major, classic happy pop motion (I–V–vi–IV …)
		name: 'Sunbeam',
		wave: 'triangle',
		chords: [
			ch('C4', 'E4', 'G4', 'D5'), // Cadd9
			ch('G3', 'B3', 'D4', 'G4'), // G
			ch('A3', 'E4', 'G4', 'C5'), // Am7
			ch('F3', 'A3', 'C4', 'E4'), // Fmaj7
			ch('C4', 'E4', 'G4', 'C5'), // C
			ch('G3', 'B3', 'D4', 'D5'), // G
			ch('F3', 'A3', 'C4', 'F4'), // F
			ch('G3', 'B3', 'D4', 'F4') // G7
		],
		chordMs: 11000,
		glideMs: 2600,
		cutoff: 2600,
		detune: 1.5,
		swellRate: 0.05,
		swellDepth: 0.12,
		sweepDepth: 160,
		twinkleMs: 2400,
		twinkleGain: 0.15
	},
	{
		// F major, soft and dreamy with maj7 colour
		name: 'Lagoon',
		wave: 'sine',
		chords: [
			ch('F3', 'A3', 'C4', 'E4'), // Fmaj7
			ch('G3', 'C4', 'E4', 'G4'), // C
			ch('D3', 'A3', 'C4', 'F4'), // Dm7
			ch('A#3', 'D4', 'F4', 'A4'), // A#(Bb)maj7
			ch('F3', 'A3', 'C4', 'F4'), // F
			ch('G3', 'C4', 'E4', 'G4'), // C
			ch('G3', 'A#3', 'D4', 'F4'), // Gm7
			ch('G3', 'C4', 'E4', 'A4') // C add
		],
		chordMs: 12500,
		glideMs: 3200,
		cutoff: 2200,
		detune: 1,
		swellRate: 0.04,
		swellDepth: 0.11,
		sweepDepth: 110,
		twinkleMs: 3000,
		twinkleGain: 0.13
	},
	{
		// D major, brighter and a touch playful
		name: 'Carousel',
		wave: 'triangle',
		chords: [
			ch('D4', 'F#4', 'A4', 'D5'), // D
			ch('A3', 'C#4', 'E4', 'A4'), // A
			ch('B3', 'D4', 'F#4', 'A4'), // Bm7
			ch('G3', 'B3', 'D4', 'G4'), // G
			ch('D4', 'F#4', 'A4', 'D5'), // D
			ch('A3', 'C#4', 'E4', 'A4'), // A
			ch('G3', 'B3', 'D4', 'G4'), // G
			ch('A3', 'C#4', 'E4', 'G4') // A7
		],
		chordMs: 10000,
		glideMs: 2200,
		cutoff: 2800,
		detune: 2,
		swellRate: 0.06,
		swellDepth: 0.13,
		sweepDepth: 150,
		twinkleMs: 2000,
		twinkleGain: 0.16
	}
];

// Gentle melodic contour: indices into the (four-note) current chord. Steps up
// and back down so the bell line arcs rather than wandering randomly.
const TWINKLE_CONTOUR = [0, 1, 2, 3, 2, 1, 2, 0, 1, 3, 2, 1];

/** Build a short silent WAV as an object URL (lazily, browser only). */
function silentWavUrl(): string {
	const rate = 8000;
	const samples = rate; // 1 second of silence
	const buf = new ArrayBuffer(44 + samples);
	const v = new DataView(buf);
	const str = (off: number, s: string) => {
		for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
	};
	str(0, 'RIFF');
	v.setUint32(4, 36 + samples, true);
	str(8, 'WAVE');
	str(12, 'fmt ');
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true); // PCM
	v.setUint16(22, 1, true); // mono
	v.setUint32(24, rate, true);
	v.setUint32(28, rate, true);
	v.setUint16(32, 1, true);
	v.setUint16(34, 8, true); // 8-bit
	str(36, 'data');
	v.setUint32(40, samples, true);
	for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128); // 8-bit silence
	return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

class Ambience {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private filter: BiquadFilterNode | null = null;
	private voices: OscillatorNode[] = [];
	private lfos: OscillatorNode[] = [];
	private timer: ReturnType<typeof setInterval> | null = null;
	private twinkleTimer: ReturnType<typeof setInterval> | null = null;
	private twinkleStep = 0;
	private chordIdx = 0;
	private volume = 0.5;
	private running = false;
	private boundRecovery = false;
	private silentEl: HTMLAudioElement | null = null;
	private mood: Mood | null = null; // chosen once per session

	/** Pick a mood for this session, rotating through the set across visits. */
	private chooseMood(): Mood {
		if (this.mood) return this.mood;
		const idx = readJSON<number>('music-mood', 0);
		const safe = ((idx % MOODS.length) + MOODS.length) % MOODS.length;
		this.mood = MOODS[safe];
		writeJSON('music-mood', safe + 1); // next session gets the next mood
		return this.mood;
	}

	private make(): boolean {
		if (typeof window === 'undefined') return false;
		if (!this.ctx) {
			const AC: Ctor | undefined =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
			if (!AC) return false;
			try {
				this.ctx = new AC();
			} catch {
				return false;
			}
		}
		return true;
	}

	private baseGain(): number {
		return this.volume * 0.16; // kept under the foreground sfx
	}

	/** Play a 1-sample silent buffer to unlock audio on iOS (must be in-gesture). */
	private unlock(ac: AudioContext): void {
		try {
			const b = ac.createBuffer(1, 1, 22050);
			const s = ac.createBufferSource();
			s.buffer = b;
			s.connect(ac.destination);
			s.start(0);
		} catch {
			/* best effort */
		}
	}

	/** A silent looping media element flips iOS to the media (non-muted) channel. */
	private playSilentLoop(): void {
		if (typeof document === 'undefined') return;
		try {
			if (!this.silentEl) {
				const el = document.createElement('audio');
				el.src = silentWavUrl();
				el.loop = true;
				el.setAttribute('playsinline', '');
				el.preload = 'auto';
				el.volume = 1; // silent *content*, so this is inaudible either way
				el.style.display = 'none';
				document.body.appendChild(el);
				this.silentEl = el;
			}
			void this.silentEl.play().catch(() => {});
		} catch {
			/* best effort */
		}
	}

	private bindRecovery(): void {
		if (this.boundRecovery || typeof window === 'undefined') return;
		this.boundRecovery = true;
		const resume = () => {
			if (this.running && this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
			if (this.running && this.silentEl && this.silentEl.paused)
				void this.silentEl.play().catch(() => {});
		};
		document.addEventListener('visibilitychange', resume);
		window.addEventListener('pointerdown', resume);
		window.addEventListener('touchend', resume);
	}

	start(): void {
		if (this.running || !this.make()) return;
		const ac = this.ctx!;
		const mood = this.chooseMood();
		void ac.resume();
		this.unlock(ac);
		this.playSilentLoop();
		this.bindRecovery();
		this.running = true;

		const master = ac.createGain();
		// long, soft fade-in so it eases in rather than appearing
		master.gain.setValueAtTime(0.0001, ac.currentTime);
		master.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.baseGain()), ac.currentTime + 5);

		const filter = ac.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = mood.cutoff;
		filter.Q.value = 0.5;
		filter.connect(master).connect(ac.destination);
		this.master = master;
		this.filter = filter;

		const chord = mood.chords[0];
		this.voices = chord.map((freq, i) => {
			const osc = ac.createOscillator();
			osc.type = mood.wave;
			osc.frequency.value = freq;
			osc.detune.value = (i - (chord.length - 1) / 2) * mood.detune;
			const g = ac.createGain();
			// lean the voicing's top notes a touch quieter for an open, soft blend
			g.gain.value = 0.26 - i * 0.03;
			osc.connect(g).connect(filter);
			osc.start();
			return osc;
		});

		const swell = ac.createOscillator();
		swell.type = 'sine';
		swell.frequency.value = mood.swellRate;
		const swellDepth = ac.createGain();
		swellDepth.gain.value = this.baseGain() * mood.swellDepth;
		swell.connect(swellDepth).connect(master.gain);
		swell.start();
		this.lfos = [swell];

		if (mood.sweepDepth > 0) {
			const sweep = ac.createOscillator();
			sweep.type = 'sine';
			sweep.frequency.value = 0.025;
			const sweepDepth = ac.createGain();
			sweepDepth.gain.value = mood.sweepDepth;
			sweep.connect(sweepDepth).connect(filter.frequency);
			sweep.start();
			this.lfos.push(sweep);
		}

		this.chordIdx = 0;
		this.timer = setInterval(() => this.nextChord(), mood.chordMs);

		if (mood.twinkleMs > 0) {
			this.twinkleStep = 0;
			// a short delay so the first bell lands after the pad has eased in
			this.twinkleTimer = setInterval(() => this.twinkle(), mood.twinkleMs);
		}
	}

	private nextChord(): void {
		const ac = this.ctx;
		if (!ac || !this.running || !this.mood) return;
		this.chordIdx = (this.chordIdx + 1) % this.mood.chords.length;
		const chord = this.mood.chords[this.chordIdx];
		const t = ac.currentTime;
		const glide = this.mood.glideMs / 1000;
		this.voices.forEach((osc, i) => {
			const target = chord[i % chord.length];
			// a moderate glide settles each chord so the harmony stays defined
			osc.frequency.exponentialRampToValueAtTime(Math.max(1, target), t + glide);
		});
	}

	/** Pluck one warm bell note from the current chord (one octave up). */
	private twinkle(): void {
		const ac = this.ctx;
		if (!ac || !this.running || !this.mood || !this.filter) return;
		const chord = this.mood.chords[this.chordIdx];
		const idx = TWINKLE_CONTOUR[this.twinkleStep % TWINKLE_CONTOUR.length];
		this.twinkleStep++;
		// octave up for sparkle; every so often two octaves for a brighter ping
		const octave = this.twinkleStep % 8 === 0 ? 4 : 2;
		const freq = chord[idx % chord.length] * octave;

		const t = ac.currentTime;
		const osc = ac.createOscillator();
		osc.type = 'sine';
		osc.frequency.value = freq;
		const g = ac.createGain();
		const peak = Math.max(0.0002, this.mood.twinkleGain);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(peak, t + 0.03); // quick, soft attack
		g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); // bell-like decay
		osc.connect(g).connect(this.filter);
		osc.start(t);
		osc.stop(t + 1.7);
	}

	stop(): void {
		if (!this.running) return;
		this.running = false;
		const ac = this.ctx;
		if (this.timer !== null) clearInterval(this.timer);
		this.timer = null;
		if (this.twinkleTimer !== null) clearInterval(this.twinkleTimer);
		this.twinkleTimer = null;
		if (this.silentEl) this.silentEl.pause();
		if (ac && this.master) {
			const t = ac.currentTime;
			this.master.gain.cancelScheduledValues(t);
			this.master.gain.setValueAtTime(Math.max(0.0002, this.master.gain.value), t);
			this.master.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
		}
		const toStop = [...this.voices, ...this.lfos];
		this.voices = [];
		this.lfos = [];
		setTimeout(() => {
			for (const o of toStop) {
				try {
					o.stop();
				} catch {
					/* already stopped */
				}
			}
		}, 1700);
	}

	setVolume(v: number): void {
		this.volume = Math.max(0, Math.min(1, v));
		if (this.ctx && this.master && this.running) {
			const t = this.ctx.currentTime;
			this.master.gain.cancelScheduledValues(t);
			this.master.gain.setValueAtTime(Math.max(0.0002, this.master.gain.value), t);
			this.master.gain.linearRampToValueAtTime(Math.max(0.0002, this.baseGain()), t + 0.4);
		}
	}

	get isRunning(): boolean {
		return this.running;
	}
}

export const ambience = new Ambience();
