/**
 * Tiny synthesized sound effects via the Web Audio API — no audio assets, no
 * licensing. Soft, short cues for card interactions. Muted via user settings;
 * SSR-safe (no AudioContext on the server). The context is created/resumed
 * lazily inside the play calls, which always fire from a user gesture.
 */

import { settings } from '$lib/storage/settings.svelte';

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;

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

interface ToneOptions {
	freq: number;
	type?: OscillatorType;
	dur?: number;
	gain?: number;
	/** Glide to this frequency over the duration (for soft thunks/swishes). */
	glideTo?: number;
	delay?: number;
}

function tone(ac: AudioContext, o: ToneOptions): void {
	const { freq, type = 'triangle', dur = 0.12, gain = 0.08, glideTo, delay = 0 } = o;
	const t0 = ac.currentTime + delay;
	const osc = ac.createOscillator();
	const g = ac.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t0);
	if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
	g.gain.setValueAtTime(0.0001, t0);
	g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	osc.connect(g).connect(ac.destination);
	osc.start(t0);
	osc.stop(t0 + dur + 0.02);
}

/** A short filtered-noise burst — the "swish" of cards moving. */
function swish(ac: AudioContext, dur = 0.16, gain = 0.05, cutoff = 1600): void {
	const t0 = ac.currentTime;
	const frames = Math.floor(ac.sampleRate * dur);
	const buffer = ac.createBuffer(1, frames, ac.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
	const src = ac.createBufferSource();
	src.buffer = buffer;
	const filter = ac.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = cutoff;
	const g = ac.createGain();
	g.gain.setValueAtTime(gain, t0);
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	src.connect(filter).connect(g).connect(ac.destination);
	src.start(t0);
	src.stop(t0 + dur);
}

function withAudio(fn: (ac: AudioContext) => void): void {
	if (!settings.sound) return;
	const ac = audio();
	if (ac) fn(ac);
}

export const sfx = {
	/** Card placed onto a pile. */
	place(): void {
		withAudio((ac) => tone(ac, { freq: 220, glideTo: 150, dur: 0.11, gain: 0.09 }));
	},
	/** Stock draw / pick up. */
	draw(): void {
		withAudio((ac) => swish(ac, 0.12, 0.045, 1800));
	},
	/** Card flip. */
	flip(): void {
		withAudio((ac) => tone(ac, { freq: 330, type: 'sine', dur: 0.07, gain: 0.06 }));
	},
	/** New deal — a soft shuffle swish. */
	deal(): void {
		withAudio((ac) => {
			swish(ac, 0.22, 0.06, 1400);
			swish(ac, 0.18, 0.04, 1100);
		});
	},
	/** Illegal move / spring-back. */
	invalid(): void {
		withAudio((ac) => tone(ac, { freq: 150, glideTo: 90, type: 'sine', dur: 0.14, gain: 0.05 }));
	},
	/** Victory fanfare — a gentle ascending arpeggio. */
	win(): void {
		withAudio((ac) => {
			[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
				tone(ac, { freq, type: 'triangle', dur: 0.22, gain: 0.08, delay: i * 0.12 })
			);
		});
	}
};
