/**
 * Background ambience — a soft, generative pad. Several warm "moods" (open,
 * consonant chord sets) rotate one per session so it stays fresh; each drifts
 * slowly through its progression with a gentle volume swell and a touch of
 * filter movement so it breathes instead of droning. No audio assets; all
 * synthesized via Web Audio, SSR-safe, started only from a user gesture.
 *
 * iOS Safari needs extra care to make a synth-only graph audible:
 *  - a 1-sample silent buffer must be played *inside* the unlocking gesture,
 *  - a silent looping <audio> element flips the audio session to the media
 *    channel so the hardware mute/ringer switch doesn't silence Web Audio,
 *  - the context must be resumed again after interruptions (tab hide, calls).
 */

import { readJSON, writeJSON } from '$lib/storage/storage';

type Ctor = typeof AudioContext;

interface Mood {
	readonly name: string;
	readonly wave: OscillatorType;
	/** Open, consonant four-note voicings (Hz) the pad wanders through. */
	readonly chords: number[][];
	readonly chordMs: number;
	readonly cutoff: number; // lowpass base (higher = more open/airy)
	readonly detune: number; // cents of chorus spread (small = less wavering)
	readonly swellRate: number; // Hz of the volume LFO
	readonly swellDepth: number; // fraction of base gain
	readonly sweepDepth: number; // Hz of slow filter movement (0 = still)
}

// Warm, major-leaning, openly voiced moods — gentle and collected, not eerie.
const MOODS: Mood[] = [
	{
		name: 'Meadow',
		wave: 'triangle',
		chords: [
			[130.81, 196.0, 329.63, 493.88], // C  (C-G-E-B) maj7, open
			[174.61, 261.63, 349.23, 523.25], // F  (F-C-F-C)
			[196.0, 293.66, 392.0, 587.33], // G  (G-D-G-D)
			[164.81, 246.94, 329.63, 493.88] // Em (E-B-E-B)
		],
		chordMs: 18000,
		cutoff: 1500,
		detune: 2,
		swellRate: 0.04,
		swellDepth: 0.16,
		sweepDepth: 140
	},
	{
		name: 'Hearth',
		wave: 'sine',
		chords: [
			[87.31, 130.81, 174.61, 261.63], // F  low + warm
			[110.0, 164.81, 220.0, 329.63], // Am
			[98.0, 146.83, 196.0, 293.66], // G
			[130.81, 196.0, 261.63, 392.0] // C
		],
		chordMs: 20000,
		cutoff: 1200,
		detune: 0,
		swellRate: 0.03,
		swellDepth: 0.14,
		sweepDepth: 90
	},
	{
		name: 'Dusk',
		wave: 'triangle',
		chords: [
			[146.83, 220.0, 293.66, 440.0], // D  open fifths
			[196.0, 293.66, 392.0, 587.33], // G
			[164.81, 246.94, 329.63, 493.88], // Em7
			[110.0, 164.81, 220.0, 329.63] // A→Am, resolve down
		],
		chordMs: 16000,
		cutoff: 1400,
		detune: 3,
		swellRate: 0.05,
		swellDepth: 0.18,
		sweepDepth: 120
	}
];

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
	}

	private nextChord(): void {
		const ac = this.ctx;
		if (!ac || !this.running || !this.mood) return;
		this.chordIdx = (this.chordIdx + 1) % this.mood.chords.length;
		const chord = this.mood.chords[this.chordIdx];
		const t = ac.currentTime;
		this.voices.forEach((osc, i) => {
			const target = chord[i % chord.length];
			// long glide between chords keeps it calm and collected
			osc.frequency.exponentialRampToValueAtTime(Math.max(1, target), t + 6);
		});
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
