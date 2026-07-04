/**
 * Tiny synthesized sound effects via the Web Audio API — no audio assets, no
 * licensing. Soft but crisp cues for card interactions. Muted via user settings;
 * SSR-safe (no AudioContext on the server). The context is created/resumed
 * lazily inside the play calls, which always fire from a user gesture.
 *
 * Everything runs through a shared gentle compressor so layered hits stay tight
 * and punchy without ever clipping, and repeated cues get a touch of random
 * detune so they feel organic rather than machine-gun identical.
 */

import { settings } from '$lib/storage/settings.svelte';

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
let bus: DynamicsCompressorNode | null = null;

function audio(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		const AC: Ctor | undefined =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
		if (!AC) return null;
		try {
			ctx = new AC();
		} catch {
			return null;
		}
	}
	if (ctx.state === 'suspended') void ctx.resume();
	return ctx;
}

/** Shared output: a light compressor keeps stacked hits crisp and clip-free. */
function out(ac: AudioContext): DynamicsCompressorNode {
	if (!bus || bus.context !== ac) {
		bus = ac.createDynamicsCompressor();
		bus.threshold.value = -18;
		bus.knee.value = 24;
		bus.ratio.value = 3;
		bus.attack.value = 0.002;
		bus.release.value = 0.14;
		bus.connect(ac.destination);
	}
	return bus;
}

/** Small random detune ratio (±cents) so repeated cues don't feel robotic. */
function vary(cents: number): number {
	return Math.pow(2, ((Math.random() * 2 - 1) * cents) / 1200);
}

interface ToneOptions {
	freq: number;
	type?: OscillatorType;
	dur?: number;
	gain?: number;
	/** Glide to this frequency over the duration (for soft thunks/swishes). */
	glideTo?: number;
	/** Attack time (s) — smaller = crisper transient. */
	attack?: number;
	delay?: number;
}

function tone(ac: AudioContext, o: ToneOptions): void {
	const {
		freq,
		type = 'triangle',
		dur = 0.12,
		gain = 0.08,
		glideTo,
		attack = 0.004,
		delay = 0
	} = o;
	const t0 = ac.currentTime + delay;
	const osc = ac.createOscillator();
	const g = ac.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t0);
	if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
	g.gain.setValueAtTime(0.0001, t0);
	g.gain.exponentialRampToValueAtTime(gain, t0 + attack); // crisp attack
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	osc.connect(g).connect(out(ac));
	osc.start(t0);
	osc.stop(t0 + dur + 0.02);
}

/** A crisp bell/ping: fundamental + octave partial, fast bright decay. */
function bell(ac: AudioContext, freq: number, gain = 0.07, dur = 0.5, delay = 0): void {
	const t0 = ac.currentTime + delay;
	const env = ac.createGain();
	env.gain.setValueAtTime(0.0001, t0);
	env.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
	env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	env.connect(out(ac));
	const o1 = ac.createOscillator();
	o1.type = 'sine';
	o1.frequency.value = freq;
	o1.connect(env);
	const o2 = ac.createOscillator();
	o2.type = 'sine';
	o2.frequency.value = freq * 2.0;
	const o2g = ac.createGain();
	o2g.gain.value = 0.35;
	o2.connect(o2g).connect(env);
	o1.start(t0);
	o2.start(t0);
	o1.stop(t0 + dur + 0.02);
	o2.stop(t0 + dur + 0.02);
}

/** A short filtered-noise burst — the "swish" of cards moving. */
function swish(ac: AudioContext, dur = 0.16, gain = 0.05, cutoff = 1600, hp = 300): void {
	const t0 = ac.currentTime;
	const frames = Math.floor(ac.sampleRate * dur);
	const buffer = ac.createBuffer(1, frames, ac.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
	const src = ac.createBufferSource();
	src.buffer = buffer;
	// band-limit: a highpass removes rumble so it reads as a crisp paper swish
	const low = ac.createBiquadFilter();
	low.type = 'lowpass';
	low.frequency.value = cutoff;
	const high = ac.createBiquadFilter();
	high.type = 'highpass';
	high.frequency.value = hp;
	const g = ac.createGain();
	g.gain.setValueAtTime(gain, t0);
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	src.connect(high).connect(low).connect(g).connect(out(ac));
	src.start(t0);
	src.stop(t0 + dur);
}

function withAudio(fn: (ac: AudioContext) => void): void {
	if (!settings.sound) return;
	const ac = audio();
	if (ac) fn(ac);
}

export const sfx = {
	/** Card placed onto a pile — a crisp, soft "tak". */
	place(): void {
		withAudio((ac) => {
			swish(ac, 0.05, 0.03, 3200, 800); // tiny transient click
			tone(ac, { freq: 200 * vary(40), glideTo: 150, dur: 0.1, gain: 0.08, attack: 0.003 });
		});
	},
	/** Stock draw / pick up. */
	draw(): void {
		withAudio((ac) => swish(ac, 0.11, 0.05, 2600, 500));
	},
	/** Card flip — a light, bright tick. */
	flip(): void {
		withAudio((ac) => {
			swish(ac, 0.04, 0.025, 3600, 1200);
			tone(ac, { freq: 340 * vary(50), type: 'sine', dur: 0.06, gain: 0.05, attack: 0.002 });
		});
	},
	/** New deal — a soft riffle of a few quick swishes. */
	deal(): void {
		withAudio((ac) => {
			swish(ac, 0.2, 0.06, 1800, 400);
			swish(ac, 0.16, 0.04, 1300, 350);
			for (let i = 0; i < 3; i++)
				setTimeout(() => audio() && swish(audio()!, 0.05, 0.02, 3000, 900), 40 + i * 55);
		});
	},
	/** A card reaching a foundation — a bright little reward ding. */
	foundation(): void {
		withAudio((ac) => bell(ac, 880 * vary(30), 0.06, 0.4));
	},
	/** Illegal move / spring-back — a soft low thud. */
	invalid(): void {
		withAudio((ac) => tone(ac, { freq: 150, glideTo: 88, type: 'sine', dur: 0.15, gain: 0.05 }));
	},
	/** Victory fanfare — a gentle ascending arpeggio of bells with a sparkle. */
	win(): void {
		withAudio((ac) => {
			[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => bell(ac, freq, 0.075, 0.7, i * 0.11));
			bell(ac, 1567.98, 0.04, 0.9, 0.5); // high sparkle to top it off
		});
	}
};
