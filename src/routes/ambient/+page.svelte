<script lang="ts">
	// Ambient "Unwind" mode — a calm, screensaver-like scene with no game. The
	// background music keeps playing and slowly drifts through its moods while soft
	// orbs float and a gentle dot breathes. Tap anywhere, press Escape, or hit Done
	// to return home; the music carries on app-wide (we never stop the ambience).
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { MOODS, isMoodUnlocked, type Mood } from '$lib/audio/moods';
	import { ambience } from '$lib/render/music';
	import { achievements } from '$lib/storage/achievements.svelte';
	import { settings } from '$lib/storage/settings.svelte';

	// Soft drifting orbs. Fully deterministic (fixed, index-keyed values — no
	// Math.random) so server and client render identically and hydration is clean.
	interface Orb {
		top: number;
		left: number;
		size: number; // vmax
		tint: string;
		dur: number; // seconds
		delay: number; // seconds
		dx: number; // % drift
		dy: number; // % drift
	}
	const orbs: Orb[] = [
		{
			top: 18,
			left: 22,
			size: 46,
			tint: 'rgba(255, 209, 138, 0.34)',
			dur: 38,
			delay: 0,
			dx: 6,
			dy: -5
		},
		{
			top: 64,
			left: 70,
			size: 54,
			tint: 'rgba(255, 162, 140, 0.30)',
			dur: 46,
			delay: -12,
			dx: -7,
			dy: 6
		},
		{
			top: 40,
			left: 52,
			size: 38,
			tint: 'rgba(150, 200, 190, 0.28)',
			dur: 34,
			delay: -24,
			dx: 5,
			dy: -4
		},
		{
			top: 72,
			left: 20,
			size: 42,
			tint: 'rgba(190, 172, 235, 0.28)',
			dur: 52,
			delay: -8,
			dx: -6,
			dy: 7
		},
		{
			top: 28,
			left: 78,
			size: 50,
			tint: 'rgba(255, 232, 200, 0.30)',
			dur: 42,
			delay: -30,
			dx: 8,
			dy: -6
		}
	];

	let currentName = $state('');

	let leftPage = false;
	function leave(): void {
		if (leftPage) return;
		leftPage = true;
		void goto(resolve('/'));
	}

	onMount(() => {
		// Build the drift playlist from the moods you've unlocked. If that's fewer
		// than two there's nothing to drift between, so fall back to every mood.
		const has = (id: string) => achievements.has(id);
		const unlocked = MOODS.filter((m) => isMoodUnlocked(m, has));
		const list: Mood[] = unlocked.length >= 2 ? unlocked : [...MOODS];

		// Start the music if it's enabled; pick up from wherever it already is.
		if (settings.music) {
			ambience.setVolume(settings.musicVolume);
			ambience.start();
		}
		let idx = list.findIndex((m) => m.id === ambience.moodId);
		if (idx < 0) idx = 0;
		currentName = list[idx].name;

		// Breathing intensity: a slow sine so the arrangement gently swells and
		// settles (~0.30 → 0.54). setIntensity smooths internally, so a coarse tick
		// is plenty and stays cheap.
		const t0 = Date.now();
		const BREATH_MS = 14000;
		const breathe = () => {
			const phase = ((Date.now() - t0) / BREATH_MS) * Math.PI * 2;
			ambience.setIntensity(0.42 + 0.12 * Math.sin(phase));
		};
		breathe();
		const breathTimer = setInterval(breathe, 2500);

		// Drift to the next mood on a slow interval; the engine crossfades for us.
		const DRIFT_MS = 32000;
		const driftTimer = setInterval(() => {
			idx = (idx + 1) % list.length;
			const next = list[idx];
			ambience.setMood(next);
			currentName = next.name;
		}, DRIFT_MS);

		// Ways out. Arm the tap-to-exit a beat late so the gesture that opened this
		// scene doesn't immediately dismiss it.
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') leave();
		};
		const armTimer = setTimeout(() => {
			window.addEventListener('pointerdown', leave);
		}, 500);
		window.addEventListener('keydown', onKey);

		return () => {
			clearInterval(breathTimer);
			clearInterval(driftTimer);
			clearTimeout(armTimer);
			window.removeEventListener('pointerdown', leave);
			window.removeEventListener('keydown', onKey);
			// Intentionally NOT calling ambience.stop() — music keeps playing app-wide.
		};
	});
</script>

<svelte:head>
	<title>Unwind · Patience</title>
	<meta
		name="description"
		content="A calm, screensaver-like scene — just the music drifting through its moods."
	/>
</svelte:head>

<main class="unwind">
	<div class="orbs" aria-hidden="true">
		{#each orbs as o, i (i)}
			<span
				class="orb"
				style="top:{o.top}%; left:{o.left}%; width:{o.size}vmax; height:{o.size}vmax; --tint:{o.tint}; --dur:{o.dur}s; --delay:{o.delay}s; --dx:{o.dx}%; --dy:{o.dy}%"
			></span>
		{/each}
	</div>

	<div class="center">
		<div class="breath" aria-hidden="true"></div>
		<div class="label">
			{#key currentName}
				<p class="mood-name" in:fade={{ duration: 1200 }} out:fade={{ duration: 1200 }}>
					{currentName}
				</p>
			{/key}
		</div>
		<p class="hint">Tap anywhere to return</p>
	</div>

	<button class="done" onclick={leave}>Done</button>
</main>

<style>
	.unwind {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background: var(--table-bg);
		background-blend-mode: var(--table-blend);
		color: var(--ui-text);
		font-family: var(--font-rounded);
		display: grid;
		place-items: center;
		cursor: pointer;
	}

	/* Floating soft orbs */
	.orbs {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.orb {
		position: absolute;
		border-radius: 50%;
		background: radial-gradient(circle at 50% 50%, var(--tint), transparent 68%);
		filter: blur(10px);
		transform: translate(-50%, -50%);
		will-change: transform;
		animation: orb-float var(--dur, 40s) ease-in-out var(--delay, 0s) infinite alternate;
	}
	@keyframes orb-float {
		from {
			transform: translate(-50%, -50%) scale(1);
		}
		to {
			transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.12);
		}
	}

	/* Centered breathing dot + mood name */
	.center {
		position: relative;
		z-index: 1;
		display: grid;
		justify-items: center;
		gap: 1.4rem;
		padding: max(1.5rem, env(safe-area-inset-top)) max(1.5rem, env(safe-area-inset-right))
			max(1.5rem, env(safe-area-inset-bottom)) max(1.5rem, env(safe-area-inset-left));
		text-align: center;
		pointer-events: none;
	}
	.breath {
		width: clamp(90px, 22vmin, 180px);
		height: clamp(90px, 22vmin, 180px);
		border-radius: 50%;
		background: radial-gradient(
			circle at 50% 45%,
			color-mix(in srgb, var(--drop-ring) 70%, transparent),
			color-mix(in srgb, var(--drop-ring) 12%, transparent) 62%,
			transparent 72%
		);
		box-shadow: 0 0 60px 8px color-mix(in srgb, var(--drop-ring) 22%, transparent);
		animation: breathe 7s ease-in-out infinite;
		will-change: transform, opacity;
	}
	@keyframes breathe {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.72;
		}
		50% {
			transform: scale(1.12);
			opacity: 0.95;
		}
	}

	/* Mood name crossfades — stack the entering/leaving names in one spot. */
	.label {
		position: relative;
		min-height: 2.2rem;
		width: 100%;
	}
	.mood-name {
		position: absolute;
		inset: 0;
		margin: 0;
		font-size: clamp(1.5rem, 6vw, 2.4rem);
		font-weight: 800;
		letter-spacing: 0.01em;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
	}
	.hint {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--ui-muted);
		opacity: 0.8;
		animation: hint-pulse 5s ease-in-out infinite;
	}
	@keyframes hint-pulse {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 0.85;
		}
	}

	.done {
		position: absolute;
		z-index: 2;
		top: calc(0.9rem + env(safe-area-inset-top));
		right: max(1rem, env(safe-area-inset-right));
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--ui-text);
		background: var(--ui-surface);
		border: 1px solid var(--tile-border);
		border-radius: 999px;
		padding: 0.5rem 1.1rem;
		cursor: pointer;
		backdrop-filter: blur(6px);
	}
	.done:hover {
		background: var(--ui-surface-hover);
	}

	@media (prefers-reduced-motion: reduce) {
		.orb,
		.breath,
		.hint {
			animation: none;
		}
		.breath {
			opacity: 0.85;
		}
		.hint {
			opacity: 0.7;
		}
	}
</style>
