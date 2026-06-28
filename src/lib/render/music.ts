/**
 * Background ambience — a soft, generative pad built from a few detuned sine
 * voices that drift through a gentle chord progression, with slow LFO swells on
 * volume and filter cutoff so it breathes instead of droning. No audio assets;
 * all synthesized via Web Audio, SSR-safe, and only started from a user gesture.
 *
 * iOS Safari needs extra care to make a synth-only graph audible:
 *  - a 1-sample silent buffer must be played *inside* the unlocking gesture,
 *  - a silent looping <audio> element flips the audio session to the media
 *    channel so the hardware mute/ringer switch doesn't silence Web Audio,
 *  - the context must be resumed again after interruptions (tab hide, calls).
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
				// iOS treats a DOM-attached media element more reliably for the
				// session-category flip than a detached one.
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
		void ac.resume();
		this.unlock(ac);
		this.playSilentLoop();
		this.bindRecovery();
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
		if (this.silentEl) this.silentEl.pause();
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
