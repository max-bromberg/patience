/**
 * Background ambience — a soft, generative pad built from a few detuned sine
 * voices that drift through a gentle chord progression, with slow LFO swells on
 * volume and filter cutoff so it breathes instead of droning. No audio assets;
 * all synthesized via Web Audio, SSR-safe, and only started from a user gesture
 * (browser autoplay policy). Mirrors the sfx module's lazy-context approach.
 */

type Ctor = typeof AudioContext;

// Cozy four-note chords (Hz), a slow ii–V–I-ish wander in C.
const CHORDS: number[][] = [
	[130.81, 164.81, 196.0, 293.66], // Cmaj add9
	[110.0, 130.81, 164.81, 246.94], // Am7
	[87.31, 130.81, 174.61, 220.0], // Fmaj
	[98.0, 146.83, 196.0, 246.94] // Gsus
];
const CHORD_MS = 14000;

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
		return this.volume * 0.14; // keep it well under the foreground sfx
	}

	start(): void {
		if (this.running || !this.make()) return;
		const ac = this.ctx!;
		if (ac.state === 'suspended') void ac.resume();
		this.running = true;

		const master = ac.createGain();
		master.gain.setValueAtTime(0.0001, ac.currentTime);
		master.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.baseGain()), ac.currentTime + 3);

		const filter = ac.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = 900;
		filter.Q.value = 0.6;
		filter.connect(master).connect(ac.destination);
		this.master = master;
		this.filter = filter;

		// chord voices
		const chord = CHORDS[0];
		this.voices = chord.map((freq, i) => {
			const osc = ac.createOscillator();
			osc.type = 'sine';
			osc.frequency.value = freq;
			osc.detune.value = (i - 1.5) * 4; // gentle chorus spread
			const g = ac.createGain();
			g.gain.value = 0.25;
			osc.connect(g).connect(filter);
			osc.start();
			return osc;
		});

		// slow swell on volume + slow sweep on the filter, for movement
		const swell = ac.createOscillator();
		swell.type = 'sine';
		swell.frequency.value = 0.05;
		const swellDepth = ac.createGain();
		swellDepth.gain.value = this.baseGain() * 0.35;
		swell.connect(swellDepth).connect(master.gain);
		swell.start();

		const sweep = ac.createOscillator();
		sweep.type = 'sine';
		sweep.frequency.value = 0.03;
		const sweepDepth = ac.createGain();
		sweepDepth.gain.value = 350;
		sweep.connect(sweepDepth).connect(filter.frequency);
		sweep.start();
		this.lfos = [swell, sweep];

		this.chordIdx = 0;
		this.timer = setInterval(() => this.nextChord(), CHORD_MS);
	}

	private nextChord(): void {
		const ac = this.ctx;
		if (!ac || !this.running) return;
		this.chordIdx = (this.chordIdx + 1) % CHORDS.length;
		const chord = CHORDS[this.chordIdx];
		const t = ac.currentTime;
		this.voices.forEach((osc, i) => {
			const target = chord[i % chord.length];
			osc.frequency.exponentialRampToValueAtTime(Math.max(1, target), t + 4);
		});
	}

	stop(): void {
		if (!this.running) return;
		this.running = false;
		const ac = this.ctx;
		if (this.timer !== null) clearInterval(this.timer);
		this.timer = null;
		if (ac && this.master) {
			const t = ac.currentTime;
			this.master.gain.cancelScheduledValues(t);
			this.master.gain.setValueAtTime(Math.max(0.0002, this.master.gain.value), t);
			this.master.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
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
		}, 1400);
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
