/**
 * Background ambience — a small multi-voice sequencer. Each track (see
 * $lib/audio/moods) is its own arrangement: a chord progression in some
 * key/scale plus a handful of voices (bass, pads, a real melodic lead, arps,
 * sparkles, soft percussion), each with its own rhythm and timbre. That's what
 * makes the tracks distinct tunes rather than one arpeggio re-keyed.
 *
 * Everything is synthesized via Web Audio (no assets), SSR-safe, and started
 * only from a user gesture. The track is chosen to fit the game you're playing,
 * can switch live between games, and adapts to how you're doing: `setIntensity`
 * brightens and energizes as you close on a win and dims when you're stuck.
 *
 * iOS Safari needs extra care to make a synth-only graph audible:
 *  - a 1-sample silent buffer must be played *inside* the unlocking gesture,
 *  - a silent looping <audio> element flips the audio session to the media
 *    channel so the hardware mute/ringer switch doesn't silence Web Audio,
 *  - the context must be resumed again after interruptions (tab hide, calls).
 */

import { LOBBY_MOOD, getMood, hz, type Cell, type Mood, type Voice } from '$lib/audio/moods';

type Ctor = typeof AudioContext;

class Ambience {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private comp: DynamicsCompressorNode | null = null;
	private filter: BiquadFilterNode | null = null;
	private voiceBus: GainNode | null = null;
	private delayNode: DelayNode | null = null;
	private feedbackGain: GainNode | null = null;
	private graph: AudioNode[] = [];
	private noise: AudioBuffer | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private step = 0;
	private volume = 0.5;
	private intensity = 0.5; // 0 = struggling/pensive, 1 = winning/bright
	private running = false;
	private boundRecovery = false;
	private silentEl: HTMLAudioElement | null = null;
	private mood: Mood = getMood(LOBBY_MOOD)!;
	private targetId: string = LOBBY_MOOD; // mood we're heading toward (may still be mid-crossfade)
	private swapTimer: ReturnType<typeof setTimeout> | null = null;

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
		return this.volume * 0.5;
	}
	private effectiveCutoff(): number {
		return this.mood.cutoff * (0.55 + 0.5 * this.intensity);
	}
	private busLevel(): number {
		return 0.78 + 0.38 * this.intensity;
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
		// Backgrounded (app switch, lock, another tab) → quiet the music; foreground
		// → bring it back. Without this the silent media-channel loop keeps the
		// synth playing behind other apps. Gestures also trigger a resume, to
		// recover from iOS suspending the context after an interruption.
		const onVisibility = () => {
			if (typeof document !== 'undefined' && document.hidden) this.suspend();
			else this.resume();
		};
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pointerdown', () => this.resume());
		window.addEventListener('touchend', () => this.resume());
	}

	private suspend(): void {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
		if (this.silentEl) this.silentEl.pause();
		if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
	}

	private resume(): void {
		if (!this.running || (typeof document !== 'undefined' && document.hidden)) return;
		if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
		if (this.silentEl && this.silentEl.paused) void this.silentEl.play().catch(() => {});
		if (this.timer === null) this.timer = setInterval(() => this.tick(), this.mood.stepMs);
	}

	private noiseBuffer(ac: AudioContext): AudioBuffer {
		if (!this.noise || this.noise.sampleRate !== ac.sampleRate) {
			const frames = Math.floor(ac.sampleRate * 0.2);
			const b = ac.createBuffer(1, frames, ac.sampleRate);
			const d = b.getChannelData(0);
			for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
			this.noise = b;
		}
		return this.noise;
	}

	start(): void {
		if (this.running || !this.make()) return;
		const ac = this.ctx!;
		void ac.resume();
		this.unlock(ac);
		this.playSilentLoop();
		this.bindRecovery();
		this.running = true;

		const comp = ac.createDynamicsCompressor();
		comp.threshold.value = -16;
		comp.knee.value = 22;
		comp.ratio.value = 3.2;
		comp.attack.value = 0.006;
		comp.release.value = 0.2;
		comp.connect(ac.destination);

		const master = ac.createGain();
		master.gain.setValueAtTime(0.0001, ac.currentTime);
		master.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.baseGain()), ac.currentTime + 3);
		master.connect(comp);

		const filter = ac.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = this.effectiveCutoff();
		filter.Q.value = 0.5;
		filter.connect(master);

		// feedback delay for space
		const delay = ac.createDelay(1.0);
		delay.delayTime.value = this.mood.delayTime;
		const feedback = ac.createGain();
		feedback.gain.value = this.mood.feedback;
		const damp = ac.createBiquadFilter();
		damp.type = 'lowpass';
		damp.frequency.value = 2400;
		const wet = ac.createGain();
		wet.gain.value = 0.35;
		delay.connect(damp).connect(feedback).connect(delay);
		delay.connect(wet).connect(filter);

		// all tuned voices feed this bus → filter (+ reverb send)
		const voiceBus = ac.createGain();
		voiceBus.gain.value = this.busLevel();
		voiceBus.connect(filter);
		voiceBus.connect(delay);

		this.comp = comp;
		this.master = master;
		this.filter = filter;
		this.voiceBus = voiceBus;
		this.delayNode = delay;
		this.feedbackGain = feedback;
		this.graph = [comp, master, filter, delay, feedback, damp, wet, voiceBus];

		this.step = 0;
		this.timer = setInterval(() => this.tick(), this.mood.stepMs);
	}

	/**
	 * Switch tracks with a short crossfade so entering/changing games doesn't jar:
	 * the voices duck out over a beat (the reverb tail rings on to bridge the gap),
	 * the track swaps at the bottom of the dip, then the new one fades in. Rapid
	 * calls (quick navigation) collapse to the latest target.
	 */
	setMood(mood: Mood): void {
		if (mood.id === this.targetId) return;
		this.targetId = mood.id;
		if (!this.running || !this.ctx || !this.voiceBus) {
			this.mood = mood; // not playing yet — just stage it for start()
			return;
		}
		const ac = this.ctx;
		const fadeOut = 0.34;
		// duck the voices; a swap already in flight is replaced by this newer one
		if (this.swapTimer) clearTimeout(this.swapTimer);
		this.voiceBus.gain.cancelScheduledValues(ac.currentTime);
		this.voiceBus.gain.setTargetAtTime(0.0001, ac.currentTime, fadeOut / 3);
		this.swapTimer = setTimeout(() => {
			this.swapTimer = null;
			if (!this.running || !this.ctx || !this.voiceBus) return;
			const restart = mood.stepMs !== this.mood.stepMs;
			this.mood = mood;
			this.step = 0;
			const t = this.ctx.currentTime;
			this.filter?.frequency.setTargetAtTime(this.effectiveCutoff(), t, 0.3);
			this.delayNode?.delayTime.setTargetAtTime(mood.delayTime, t, 0.3);
			this.feedbackGain?.gain.setTargetAtTime(mood.feedback, t, 0.3);
			if (restart && this.timer !== null) {
				clearInterval(this.timer);
				this.timer = setInterval(() => this.tick(), mood.stepMs);
			}
			this.voiceBus.gain.setTargetAtTime(this.busLevel(), t, 0.45); // fade the new track in
		}, fadeOut * 1000);
	}

	/** Adapt to how the player's doing (0 = stuck → darker/sparser, 1 = winning). */
	setIntensity(v: number): void {
		const next = Math.max(0, Math.min(1, v));
		if (Math.abs(next - this.intensity) < 0.02) return;
		this.intensity = next;
		if (!this.running || !this.ctx) return;
		const t = this.ctx.currentTime;
		this.filter?.frequency.setTargetAtTime(this.effectiveCutoff(), t, 1.2);
		// don't touch the bus mid-crossfade — the swap's fade-in uses busLevel()
		// (which already reads the latest intensity) when it lands.
		if (!this.swapTimer) this.voiceBus?.gain.setTargetAtTime(this.busLevel(), t, 1.2);
	}

	// --- scale/degree helpers ------------------------------------------------

	/** A scale degree (0 = tonic; wraps octaves) → semitones from the tonic. */
	private degToSemitone(deg: number): number {
		const s = this.mood.scale;
		const n = s.length;
		const oct = Math.floor(deg / n);
		const idx = ((deg % n) + n) % n;
		return s[idx] + 12 * oct;
	}

	private freqForDegree(deg: number, octave = 0): number {
		return hz(this.mood.root) * Math.pow(2, (this.degToSemitone(deg) + 12 * octave) / 12);
	}

	/** Steps until this part next plays (for holding sustained notes). */
	private gapSteps(pattern: Cell[], idx: number): number {
		const len = pattern.length;
		for (let i = 1; i <= len; i++) if (pattern[(idx + i) % len] != null) return i;
		return len;
	}

	// --- sequencer -----------------------------------------------------------

	private tick(): void {
		const ac = this.ctx;
		if (!ac || !this.running || !this.voiceBus) return;
		const mood = this.mood;
		const t = ac.currentTime + 0.05; // lookahead for clean scheduling
		const bar = Math.floor(this.step / mood.stepsPerBar) % mood.progression.length;
		const chordRoot = mood.progression[bar];
		const stepSec = mood.stepMs / 1000;

		for (const part of mood.parts) {
			const idx = this.step % part.pattern.length;
			const cell = part.pattern[idx];
			if (cell == null) continue;
			// thin the melody out when struggling; keep bass/pad grounding
			const melodic = part.mode !== 'chord' || (part.role !== 'bass' && part.role !== 'pad');
			if (melodic && this.intensity < 0.32 && this.step % 2 === 1) continue;

			if (part.mode === 'perc') {
				this.perc(t, typeof cell === 'number' ? cell : 1, part.voice);
				continue;
			}
			const gate = part.voice.sustain ? this.gapSteps(part.pattern, idx) * stepSec : 0;
			const notes = Array.isArray(cell) ? cell : [cell];
			for (const nRaw of notes) {
				const n = nRaw as number;
				const deg = part.mode === 'chord' ? chordRoot + 2 * n : n;
				this.playNote(this.freqForDegree(deg, part.voice.octave ?? 0), t, gate, part.voice);
			}
		}
		this.step++;
	}

	/** Schedule one tuned note (pluck or held), with optional detune + partial. */
	private playNote(freq: number, when: number, gateSec: number, v: Voice): void {
		const ac = this.ctx;
		if (!ac || !this.voiceBus) return;
		const peak = Math.max(0.0002, v.gain * (0.7 + 0.4 * this.intensity));
		const env = ac.createGain();
		env.gain.setValueAtTime(0.0001, when);
		env.gain.exponentialRampToValueAtTime(peak, when + v.attack);
		let end: number;
		if (v.sustain) {
			const hold = when + v.attack + Math.max(0, gateSec - v.attack);
			env.gain.setValueAtTime(peak, hold);
			env.gain.exponentialRampToValueAtTime(0.0001, hold + v.release);
			end = hold + v.release;
		} else {
			env.gain.exponentialRampToValueAtTime(0.0001, when + v.attack + v.release);
			end = when + v.attack + v.release;
		}
		env.connect(this.voiceBus);

		const oscs: OscillatorNode[] = [];
		const o1 = ac.createOscillator();
		o1.type = v.wave;
		o1.frequency.value = freq;
		o1.connect(env);
		oscs.push(o1);
		if (v.detune) {
			const o2 = ac.createOscillator();
			o2.type = v.wave;
			o2.frequency.value = freq;
			o2.detune.value = v.detune;
			o2.connect(env);
			oscs.push(o2);
		}
		if (v.partial) {
			const op = ac.createOscillator();
			op.type = 'sine';
			op.frequency.value = freq * 2;
			const pg = ac.createGain();
			pg.gain.value = v.partial;
			op.connect(pg).connect(env);
			oscs.push(op);
		}
		for (const o of oscs) {
			o.start(when);
			o.stop(end + 0.05);
		}
	}

	/** A soft shaker/tick — filtered noise burst (percussion). */
	private perc(when: number, brightness: number, v: Voice): void {
		const ac = this.ctx;
		if (!ac || !this.voiceBus) return;
		const src = ac.createBufferSource();
		src.buffer = this.noiseBuffer(ac);
		const hp = ac.createBiquadFilter();
		hp.type = 'highpass';
		hp.frequency.value = 3000 + brightness * 3000;
		const env = ac.createGain();
		const peak = Math.max(0.0002, v.gain * (0.6 + 0.5 * this.intensity));
		env.gain.setValueAtTime(peak, when);
		env.gain.exponentialRampToValueAtTime(0.0001, when + v.release);
		src.connect(hp).connect(env).connect(this.voiceBus);
		src.start(when);
		src.stop(when + v.release + 0.02);
	}

	stop(): void {
		if (!this.running) return;
		this.running = false;
		const ac = this.ctx;
		if (this.timer !== null) clearInterval(this.timer);
		this.timer = null;
		if (this.swapTimer) {
			clearTimeout(this.swapTimer);
			this.swapTimer = null;
		}
		if (this.silentEl) this.silentEl.pause();
		if (ac && this.master) {
			const t = ac.currentTime;
			this.master.gain.cancelScheduledValues(t);
			this.master.gain.setValueAtTime(Math.max(0.0002, this.master.gain.value), t);
			this.master.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
		}
		const graph = this.graph;
		this.graph = [];
		this.filter = null;
		this.voiceBus = null;
		this.delayNode = null;
		this.feedbackGain = null;
		setTimeout(() => {
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
	v.setUint16(20, 1, true);
	v.setUint16(22, 1, true);
	v.setUint32(24, rate, true);
	v.setUint32(28, rate, true);
	v.setUint16(32, 1, true);
	v.setUint16(34, 8, true);
	str(36, 'data');
	v.setUint32(40, samples, true);
	for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
	return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export const ambience = new Ambience();
