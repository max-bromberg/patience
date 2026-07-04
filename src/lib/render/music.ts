/**
 * Background ambience — a warm, music-box style score. Each mood plays a flowing
 * arpeggio of soft bell tones drawn only from the notes of the current chord, so
 * it always stays consonant. A gentle echo gives it lush space and a quiet
 * octave pad grounds the harmony. No audio assets; all synthesized via Web
 * Audio, SSR-safe, started only from a user gesture.
 *
 * The mood is chosen to fit the game you're playing (see $lib/audio/moods), can
 * be switched live as you move between games, and adapts to how you're doing:
 * `setIntensity` brightens and energizes the sound as you close on a win and
 * dims it when you're stuck.
 *
 * iOS Safari needs extra care to make a synth-only graph audible:
 *  - a 1-sample silent buffer must be played *inside* the unlocking gesture,
 *  - a silent looping <audio> element flips the audio session to the media
 *    channel so the hardware mute/ringer switch doesn't silence Web Audio,
 *  - the context must be resumed again after interruptions (tab hide, calls).
 */

import { LOBBY_MOOD, getMood, type Mood } from '$lib/audio/moods';

type Ctor = typeof AudioContext;

class Ambience {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private filter: BiquadFilterNode | null = null;
	private arpBus: GainNode | null = null;
	private delayNode: DelayNode | null = null;
	private feedbackGain: GainNode | null = null;
	private sweepDepth: GainNode | null = null;
	private padVoices: { osc: OscillatorNode; gain: GainNode }[] = [];
	private lfos: OscillatorNode[] = [];
	private graph: AudioNode[] = []; // nodes to disconnect on stop
	private timer: ReturnType<typeof setInterval> | null = null;
	private chordIdx = 0;
	private chordStep = 0;
	private arpStep = 0;
	private pool: number[] = [];
	private volume = 0.5;
	private intensity = 0.5; // 0 = struggling/pensive, 1 = winning/bright
	private running = false;
	private boundRecovery = false;
	private silentEl: HTMLAudioElement | null = null;
	private mood: Mood = getMood(LOBBY_MOOD)!;

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

	/** Effective lowpass cutoff for the current mood + intensity (brighter = winning). */
	private effectiveCutoff(): number {
		return this.mood.cutoff * (0.55 + 0.5 * this.intensity);
	}

	/** Melodic bus level for the current intensity (livelier = winning). */
	private arpLevel(): number {
		return 0.78 + 0.4 * this.intensity;
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
		if (this.timer === null) this.timer = setInterval(() => this.tick(), this.mood.stepMs);
	}

	/** Two octaves of the chord's notes, ascending — the arpeggio's note pool. */
	private makePool(chord: number[]): number[] {
		return [...chord, ...chord.map((f) => f * 2)].sort((a, b) => a - b);
	}

	start(): void {
		if (this.running || !this.make()) return;
		const ac = this.ctx!;
		const mood = this.mood;
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
		filter.frequency.value = this.effectiveCutoff();
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
		arpBus.gain.value = this.arpLevel();
		arpBus.connect(filter);
		arpBus.connect(delay);

		this.master = master;
		this.filter = filter;
		this.arpBus = arpBus;
		this.delayNode = delay;
		this.feedbackGain = feedback;
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
		this.sweepDepth = sweepDepth;

		this.chordIdx = 0;
		this.chordStep = 0;
		this.arpStep = 0;
		this.pool = this.makePool(mood.chords[0]);
		this.timer = setInterval(() => this.tick(), mood.stepMs);
	}

	/**
	 * Switch the active mood, ramping timbre smoothly and picking up the new chord
	 * progression at the next step. Safe to call before start() (stored for then)
	 * or repeatedly with the same mood (a no-op).
	 */
	setMood(mood: Mood): void {
		if (mood.id === this.mood.id) return;
		const restart = mood.stepMs !== this.mood.stepMs;
		this.mood = mood;
		if (!this.running || !this.ctx) return;
		const ac = this.ctx;
		const t = ac.currentTime;
		// ease the new progression in from the top
		this.chordIdx = 0;
		this.chordStep = 0;
		this.arpStep = 0;
		this.pool = this.makePool(mood.chords[0]);
		// ramp timbre to the new mood
		if (this.filter) {
			this.filter.frequency.cancelScheduledValues(t);
			this.filter.frequency.setTargetAtTime(this.effectiveCutoff(), t, 0.6);
		}
		if (this.sweepDepth) this.sweepDepth.gain.setTargetAtTime(mood.cutoff * 0.1, t, 0.6);
		if (this.delayNode) this.delayNode.delayTime.setTargetAtTime(mood.delayTime, t, 0.6);
		if (this.feedbackGain) this.feedbackGain.gain.setTargetAtTime(mood.feedback, t, 0.6);
		if (restart && this.timer !== null) {
			clearInterval(this.timer);
			this.timer = setInterval(() => this.tick(), mood.stepMs);
		}
	}

	/**
	 * Adapt the sound to how the player's doing (0 = stuck/struggling → darker and
	 * sparser, 1 = winning → brighter and livelier). Ramps smoothly so it breathes
	 * rather than jumps.
	 */
	setIntensity(v: number): void {
		const next = Math.max(0, Math.min(1, v));
		if (Math.abs(next - this.intensity) < 0.02) return;
		this.intensity = next;
		if (!this.running || !this.ctx) return;
		const t = this.ctx.currentTime;
		if (this.filter) this.filter.frequency.setTargetAtTime(this.effectiveCutoff(), t, 1.2);
		if (this.arpBus) this.arpBus.gain.setTargetAtTime(this.arpLevel(), t, 1.2);
	}

	/** One arpeggio step: maybe change chord, then strike one bell note. */
	private tick(): void {
		const ac = this.ctx;
		if (!ac || !this.running || !this.arpBus) return;
		const mood = this.mood;
		const t = ac.currentTime + 0.04; // tiny lookahead for clean scheduling

		// At the top of each chord, swap the pad bed under the melody.
		if (this.chordStep === 0) this.setPad(mood.chords[this.chordIdx], t);

		const idx = mood.arp[this.arpStep % mood.arp.length];
		this.arpStep++;
		// When struggling, thin the melody out for a more pensive feel.
		const rest = idx < 0 || (this.intensity < 0.3 && this.arpStep % 3 === 0);
		if (!rest) {
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
		o1.type = this.mood.wave;
		o1.frequency.value = freq;
		o1.connect(env);

		const o2 = ac.createOscillator();
		o2.type = 'sine';
		o2.frequency.value = freq * 2; // octave shimmer
		const o2g = ac.createGain();
		o2g.gain.value = this.mood.partial;
		o2.connect(o2g).connect(env);

		o1.start(when);
		o2.start(when);
		o1.stop(when + 1.8);
		o2.stop(when + 1.8);
	}

	/** Crossfade a soft two-note octave pad to ground the current chord. */
	private setPad(chord: number[], when: number): void {
		const ac = this.ctx;
		if (!ac || !this.filter) return;

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
		// pad thins out when struggling, fills in when winning
		const padGain = this.mood.padGain * (0.45 + 0.7 * this.intensity);
		if (padGain <= 0.001) return;

		// root + its octave: pure, consonant warmth under the bells
		const root = chord[0];
		for (const freq of [root, root * 2]) {
			const osc = ac.createOscillator();
			osc.type = 'triangle';
			osc.frequency.value = freq;
			const gain = ac.createGain();
			gain.gain.setValueAtTime(0.0001, when);
			gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, padGain), when + 1.6);
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
		this.delayNode = null;
		this.feedbackGain = null;
		this.sweepDepth = null;
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

	get moodId(): string {
		return this.mood.id;
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
