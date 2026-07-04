/**
 * Background ambience — a warm, music-box style score. Rather than a sustained
 * drone, each bright major-key "mood" plays a flowing arpeggio of soft bell
 * tones (a celesta/glockenspiel timbre: fundamental + an octave partial) drawn
 * only from the notes of the current chord, so it always stays consonant. A
 * gentle echo gives it lush space and a quiet octave pad grounds the harmony.
 * Notes are re-struck per step (never pitch-glided), which keeps the harmony
 * clean and the texture lively instead of monotone. Moods rotate one per
 * session so it stays fresh. No audio assets; all synthesized via Web Audio,
 * SSR-safe, started only from a user gesture.
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
	/** Four-note major-key voicings the arpeggio draws its notes from. */
	readonly chords: number[][];
	readonly stepMs: number; // time between arpeggio notes (tempo/feel)
	readonly stepsPerChord: number; // notes played before moving to the next chord
	readonly cutoff: number; // lowpass base (higher = brighter/airier)
	readonly arpGain: number; // peak level of each bell pluck
	readonly padGain: number; // level of the soft octave pad bed (0 = none)
	readonly delayTime: number; // echo spacing (s)
	readonly feedback: number; // echo feedback amount (0–0.5)
}

// Bright, major-key moods. The progressions are simple and uplifting; the
// music-box arpeggio + echo carry the melody.
const MOODS: Mood[] = [
	{
		// C major, lively and sunny (I–V–vi–IV …)
		name: 'Sunbeam',
		chords: [
			ch('C4', 'E4', 'G4', 'C5'), // C
			ch('G3', 'B3', 'D4', 'G4'), // G
			ch('A3', 'C4', 'E4', 'A4'), // Am
			ch('F3', 'A3', 'C4', 'F4'), // F
			ch('C4', 'E4', 'G4', 'C5'), // C
			ch('G3', 'B3', 'D4', 'G4'), // G
			ch('F3', 'A3', 'C4', 'F4'), // F
			ch('G3', 'B3', 'D4', 'G4') // G
		],
		stepMs: 300,
		stepsPerChord: 12,
		cutoff: 3200,
		arpGain: 0.1,
		padGain: 0.05,
		delayTime: 0.3,
		feedback: 0.26
	},
	{
		// F major, soft and dreamy
		name: 'Lagoon',
		chords: [
			ch('F3', 'A3', 'C4', 'F4'), // F
			ch('C4', 'E4', 'G4', 'C5'), // C
			ch('D3', 'F3', 'A3', 'D4'), // Dm
			ch('A#3', 'D4', 'F4', 'A#4'), // A#(Bb)
			ch('F3', 'A3', 'C4', 'F4'), // F
			ch('C4', 'E4', 'G4', 'C5'), // C
			ch('D3', 'F3', 'A3', 'D4'), // Dm
			ch('C4', 'E4', 'G4', 'C5') // C
		],
		stepMs: 360,
		stepsPerChord: 12,
		cutoff: 2700,
		arpGain: 0.1,
		padGain: 0.06,
		delayTime: 0.36,
		feedback: 0.3
	},
	{
		// D major, brightest and most playful
		name: 'Carousel',
		chords: [
			ch('D4', 'F#4', 'A4', 'D5'), // D
			ch('A3', 'C#4', 'E4', 'A4'), // A
			ch('B3', 'D4', 'F#4', 'B4'), // Bm
			ch('G3', 'B3', 'D4', 'G4'), // G
			ch('D4', 'F#4', 'A4', 'D5'), // D
			ch('A3', 'C#4', 'E4', 'A4'), // A
			ch('G3', 'B3', 'D4', 'G4'), // G
			ch('A3', 'C#4', 'E4', 'A4') // A
		],
		stepMs: 280,
		stepsPerChord: 16,
		cutoff: 3400,
		arpGain: 0.1,
		padGain: 0.05,
		delayTime: 0.28,
		feedback: 0.24
	}
];

// Melodic contour: indices into the 8-note (two-octave) pool of the current
// chord. A length coprime with the chord step counts so the figure slowly
// evolves across the loop rather than repeating in lockstep. -1 is a rest, for
// a little music-box phrasing.
const ARP = [0, 2, 4, 7, 5, 3, -1];

class Ambience {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private filter: BiquadFilterNode | null = null;
	private arpBus: GainNode | null = null;
	private padVoices: { osc: OscillatorNode; gain: GainNode }[] = [];
	private lfos: OscillatorNode[] = [];
	private graph: AudioNode[] = []; // nodes to disconnect on stop
	private timer: ReturnType<typeof setInterval> | null = null;
	private chordIdx = 0;
	private chordStep = 0;
	private arpStep = 0;
	private pool: number[] = [];
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
		// bells are short/sparse, so a bit more level than a drone — with headroom
		// kept under the echo build-up so dense passages never clip.
		return this.volume * 0.42;
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
		// When the tab is backgrounded (app switch, lock, another tab) quiet the
		// music; when it returns to the foreground, bring it back. Without this the
		// silent media-channel loop keeps the audio session alive and the synth
		// plays on behind other apps — on iOS the music never stops after swiping
		// out. Gestures also trigger a resume, to recover from iOS suspending the
		// context after an interruption (a call, Siri) while we're still visible.
		const onVisibility = () => {
			if (typeof document !== 'undefined' && document.hidden) this.suspend();
			else this.resume();
		};
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pointerdown', () => this.resume());
		window.addEventListener('touchend', () => this.resume());
	}

	/** Pause playback while backgrounded, keeping the graph and state intact. */
	private suspend(): void {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
		if (this.silentEl) this.silentEl.pause();
		if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
	}

	/** Resume playback after returning to the foreground (or on a gesture). */
	private resume(): void {
		if (!this.running || (typeof document !== 'undefined' && document.hidden)) return;
		if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
		if (this.silentEl && this.silentEl.paused) void this.silentEl.play().catch(() => {});
		if (this.timer === null && this.mood)
			this.timer = setInterval(() => this.tick(), this.mood.stepMs);
	}

	/** Two octaves of the chord's notes, ascending — the arpeggio's note pool. */
	private makePool(chord: number[]): number[] {
		return [...chord, ...chord.map((f) => f * 2)].sort((a, b) => a - b);
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
		// soft fade-in so it eases in rather than appearing
		master.gain.setValueAtTime(0.0001, ac.currentTime);
		master.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.baseGain()), ac.currentTime + 4);
		master.connect(ac.destination);

		const filter = ac.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = mood.cutoff;
		filter.Q.value = 0.4;
		filter.connect(master);

		// A damped feedback delay gives the bells a lush, spacious tail.
		const delay = ac.createDelay(1.0);
		delay.delayTime.value = mood.delayTime;
		const feedback = ac.createGain();
		feedback.gain.value = mood.feedback;
		const damp = ac.createBiquadFilter();
		damp.type = 'lowpass';
		damp.frequency.value = 2200; // keep echoes soft, not brittle
		const wet = ac.createGain();
		wet.gain.value = 0.4;
		delay.connect(damp).connect(feedback).connect(delay);
		delay.connect(wet).connect(filter);

		// Everything melodic feeds this bus → dry into the filter and into the echo.
		const arpBus = ac.createGain();
		arpBus.gain.value = 1;
		arpBus.connect(filter);
		arpBus.connect(delay);

		this.master = master;
		this.filter = filter;
		this.arpBus = arpBus;
		this.graph = [master, filter, delay, feedback, damp, wet, arpBus];

		// A very slow filter sweep adds a gentle shimmer over the loop.
		const sweep = ac.createOscillator();
		sweep.type = 'sine';
		sweep.frequency.value = 0.03;
		const sweepDepth = ac.createGain();
		sweepDepth.gain.value = mood.cutoff * 0.1;
		sweep.connect(sweepDepth).connect(filter.frequency);
		sweep.start();
		this.lfos = [sweep];

		this.chordIdx = 0;
		this.chordStep = 0;
		this.arpStep = 0;
		this.pool = this.makePool(mood.chords[0]);
		this.timer = setInterval(() => this.tick(), mood.stepMs);
	}

	/** One arpeggio step: maybe change chord, then strike one bell note. */
	private tick(): void {
		const ac = this.ctx;
		if (!ac || !this.running || !this.mood || !this.arpBus) return;
		const mood = this.mood;
		const t = ac.currentTime + 0.04; // tiny lookahead for clean scheduling

		// At the top of each chord, swap the pad bed under the melody.
		if (this.chordStep === 0) this.setPad(mood.chords[this.chordIdx], t);

		const idx = ARP[this.arpStep % ARP.length];
		this.arpStep++;
		if (idx >= 0) {
			const freq = this.pool[idx % this.pool.length];
			// a soft accent on the first note of each chord gives a gentle pulse
			const gain = mood.arpGain * (this.chordStep === 0 ? 1.25 : 1);
			this.pluck(freq, t, gain);
		}

		this.chordStep++;
		if (this.chordStep >= mood.stepsPerChord) {
			this.chordStep = 0;
			this.chordIdx = (this.chordIdx + 1) % mood.chords.length;
			this.pool = this.makePool(mood.chords[this.chordIdx]);
		}
	}

	/** A warm bell pluck: fundamental + a quieter octave partial, fast decay. */
	private pluck(freq: number, when: number, gain: number): void {
		const ac = this.ctx;
		if (!ac || !this.arpBus) return;
		const env = ac.createGain();
		env.gain.setValueAtTime(0.0001, when);
		env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.012); // soft strike
		env.gain.exponentialRampToValueAtTime(0.0001, when + 1.7); // bell-like ring-out
		env.connect(this.arpBus);

		const o1 = ac.createOscillator();
		o1.type = 'sine';
		o1.frequency.value = freq;
		o1.connect(env);

		const o2 = ac.createOscillator();
		o2.type = 'sine';
		o2.frequency.value = freq * 2; // octave shimmer
		const o2g = ac.createGain();
		o2g.gain.value = 0.32;
		o2.connect(o2g).connect(env);

		o1.start(when);
		o2.start(when);
		o1.stop(when + 1.8);
		o2.stop(when + 1.8);
	}

	/** Crossfade a soft two-note octave pad to ground the current chord. */
	private setPad(chord: number[], when: number): void {
		const ac = this.ctx;
		if (!ac || !this.filter || !this.mood) return;

		// release the previous pad
		for (const v of this.padVoices) {
			v.gain.gain.cancelScheduledValues(when);
			v.gain.gain.setValueAtTime(Math.max(0.0002, v.gain.gain.value), when);
			v.gain.gain.exponentialRampToValueAtTime(0.0001, when + 1.4);
			try {
				v.osc.stop(when + 1.6);
			} catch {
				/* already scheduled */
			}
		}
		this.padVoices = [];
		if (this.mood.padGain <= 0) return;

		// root + its octave: pure, consonant warmth under the bells
		const root = chord[0];
		for (const freq of [root, root * 2]) {
			const osc = ac.createOscillator();
			osc.type = 'triangle';
			osc.frequency.value = freq;
			const gain = ac.createGain();
			gain.gain.setValueAtTime(0.0001, when);
			gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.mood.padGain), when + 1.6);
			osc.connect(gain).connect(this.filter);
			osc.start(when);
			this.padVoices.push({ osc, gain });
		}
	}

	stop(): void {
		if (!this.running) return;
		this.running = false;
		const ac = this.ctx;
		if (this.timer !== null) clearInterval(this.timer);
		this.timer = null;
		if (this.silentEl) this.silentEl.pause();
		if (ac && this.master) {
			const t = ac.currentTime;
			this.master.gain.cancelScheduledValues(t);
			this.master.gain.setValueAtTime(Math.max(0.0002, this.master.gain.value), t);
			this.master.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
		}
		const oscs = [...this.lfos, ...this.padVoices.map((v) => v.osc)];
		const graph = this.graph;
		this.lfos = [];
		this.padVoices = [];
		this.graph = [];
		setTimeout(() => {
			for (const o of oscs) {
				try {
					o.stop();
				} catch {
					/* already stopped */
				}
			}
			for (const n of graph) {
				try {
					n.disconnect();
				} catch {
					/* already gone */
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

export const ambience = new Ambience();
