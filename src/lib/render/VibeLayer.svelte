<script lang="ts">
	// Ambient cosmetic overlay driven by user "vibes" settings. Non-interactive
	// (pointer-events: none) and below modals; uses blend modes + low opacity so
	// content stays readable. Rendered once app-wide in the root layout.
	import { settings } from '$lib/storage/settings.svelte';

	// Deterministic scattered sparkle positions (avoids CSS calc modulo).
	const sparkles = Array.from({ length: 14 }, (_, i) => ({
		top: (i * 37) % 100,
		left: (i * 53 + 13) % 100,
		delay: (i * 0.31).toFixed(2)
	}));

	// Deterministic falling/floating particle fields (no Math.random — vary by index).
	function field(
		count: number,
		opts: { dur: number; durJit: number; sizeMin: number; sizeJit: number }
	) {
		return Array.from({ length: count }, (_, i) => ({
			left: (i * 61 + 7) % 100,
			delay: ((i * 0.53) % opts.dur).toFixed(2),
			duration: (opts.dur + ((i * 7) % 10) * 0.1 * opts.durJit).toFixed(2),
			drift: (((i * 37) % 60) - 30).toFixed(0),
			size: (opts.sizeMin + ((i * 13) % 10) * 0.1 * opts.sizeJit).toFixed(2),
			rot: ((i * 47) % 360).toFixed(0)
		}));
	}
	const petals = field(12, { dur: 9, durJit: 4, sizeMin: 0.7, sizeJit: 0.6 });
	const hearts = field(10, { dur: 8, durJit: 3, sizeMin: 0.7, sizeJit: 0.5 });
	const bubbles = field(12, { dur: 7, durJit: 3, sizeMin: 0.5, sizeJit: 0.9 });
	const fireflies = Array.from({ length: 16 }, (_, i) => ({
		top: (i * 41 + 9) % 100,
		left: (i * 59 + 17) % 100,
		delay: (i * 0.4).toFixed(2),
		duration: (5 + ((i * 3) % 6) * 0.5).toFixed(2)
	}));
	const clouds = [
		{ top: 12, dur: 46, scale: 1, delay: 0 },
		{ top: 34, dur: 62, scale: 1.4, delay: -20 },
		{ top: 60, dur: 54, scale: 0.9, delay: -38 }
	];
</script>

<div class="vibes" aria-hidden="true">
	{#if settings.vibe('clouds')}
		<div class="clouds">
			{#each clouds as c, i (i)}
				<span style="top:{c.top}%; --dur:{c.dur}s; --delay:{c.delay}s; --scale:{c.scale}">☁️</span>
			{/each}
		</div>
	{/if}
	{#if settings.vibe('aurora')}
		<div class="aurora"></div>
	{/if}
	{#if settings.vibe('petals')}
		<div class="fall">
			{#each petals as p, i (i)}
				<span
					class="petal"
					style="left:{p.left}%; animation-delay:{p.delay}s; animation-duration:{p.duration}s; --drift:{p.drift}px; --rot:{p.rot}deg; font-size:{p.size}rem"
					>🌸</span
				>
			{/each}
		</div>
	{/if}
	{#if settings.vibe('hearts')}
		<div class="rise">
			{#each hearts as p, i (i)}
				<span
					class="heart"
					style="left:{p.left}%; animation-delay:{p.delay}s; animation-duration:{p.duration}s; --drift:{p.drift}px; font-size:{p.size}rem"
					>💗</span
				>
			{/each}
		</div>
	{/if}
	{#if settings.vibe('bubbles')}
		<div class="rise">
			{#each bubbles as p, i (i)}
				<span
					class="bubble"
					style="left:{p.left}%; animation-delay:{p.delay}s; animation-duration:{p.duration}s; --drift:{p.drift}px; width:{p.size}rem; height:{p.size}rem"
				></span>
			{/each}
		</div>
	{/if}
	{#if settings.vibe('fireflies')}
		<div class="fireflies">
			{#each fireflies as f, i (i)}
				<span
					style="top:{f.top}%; left:{f.left}%; animation-delay:{f.delay}s; animation-duration:{f.duration}s"
				></span>
			{/each}
		</div>
	{/if}
	{#if settings.vibe('hearth')}
		<div class="hearth"></div>
	{/if}
	{#if settings.vibe('vignette')}
		<div class="vignette"></div>
	{/if}
	{#if settings.vibe('sparkle')}
		<div class="sparkle">
			{#each sparkles as s, i (i)}
				<span style="top:{s.top}%; left:{s.left}%; animation-delay:{s.delay}s"></span>
			{/each}
		</div>
	{/if}
	{#if settings.vibe('casino')}
		<div class="casino top"></div>
		<div class="casino bottom"></div>
	{/if}
</div>

<style>
	.vibes {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 3;
		overflow: hidden;
	}
	.vibes > * {
		position: absolute;
		inset: 0;
	}

	/* Hearth — warm glow rising from the bottom. Flicker varies brightness only
	   (no transform), so the soft gradient edge never reveals a hard cut. */
	.hearth {
		background: radial-gradient(
			95% 65% at 50% 118%,
			rgba(255, 150, 60, 0.5),
			rgba(255, 120, 40, 0.16) 45%,
			transparent 78%
		);
		mix-blend-mode: screen;
		animation: flicker 3.4s ease-in-out infinite;
		will-change: opacity, filter;
	}
	@keyframes flicker {
		0%,
		100% {
			opacity: 0.86;
			filter: brightness(1);
		}
		25% {
			opacity: 1;
			filter: brightness(1.12);
		}
		50% {
			opacity: 0.8;
			filter: brightness(0.96);
		}
		75% {
			opacity: 0.94;
			filter: brightness(1.05);
		}
	}

	/* Aurora — slow drifting bands of color */
	.aurora {
		background:
			radial-gradient(40% 60% at 20% 30%, rgba(80, 220, 180, 0.25), transparent 70%),
			radial-gradient(45% 55% at 80% 20%, rgba(140, 120, 255, 0.22), transparent 70%),
			radial-gradient(50% 60% at 50% 80%, rgba(80, 160, 255, 0.18), transparent 70%);
		mix-blend-mode: screen;
		animation: drift 18s ease-in-out infinite alternate;
	}
	@keyframes drift {
		from {
			transform: translate3d(-4%, -2%, 0) scale(1.05);
		}
		to {
			transform: translate3d(4%, 3%, 0) scale(1.15);
		}
	}

	/* Falling particles (petals) */
	.fall span,
	.rise span {
		position: absolute;
		top: -8%;
		line-height: 1;
		will-change: transform, opacity;
	}
	.petal {
		animation-name: petal-fall;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
		opacity: 0.85;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
	}
	@keyframes petal-fall {
		0% {
			transform: translate3d(0, -10vh, 0) rotate(0deg);
			opacity: 0;
		}
		10% {
			opacity: 0.85;
		}
		100% {
			transform: translate3d(var(--drift), 110vh, 0) rotate(calc(var(--rot) + 360deg));
			opacity: 0.85;
		}
	}

	/* Rising particles (hearts, bubbles) */
	.rise span {
		top: auto;
		bottom: -8%;
	}
	.heart {
		animation-name: rise;
		animation-timing-function: ease-in;
		animation-iteration-count: infinite;
	}
	.bubble {
		border-radius: 50%;
		background: radial-gradient(
			circle at 35% 30%,
			rgba(255, 255, 255, 0.9),
			rgba(255, 255, 255, 0.15)
		);
		border: 1px solid rgba(255, 255, 255, 0.3);
		animation-name: rise;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}
	@keyframes rise {
		0% {
			transform: translate3d(0, 10vh, 0) scale(0.8);
			opacity: 0;
		}
		15% {
			opacity: 0.8;
		}
		100% {
			transform: translate3d(var(--drift), -110vh, 0) scale(1.1);
			opacity: 0;
		}
	}

	/* Drifting clouds */
	.clouds span {
		position: absolute;
		left: -20%;
		font-size: 4rem;
		opacity: 0.5;
		filter: blur(1px);
		transform: scale(var(--scale, 1));
		animation: cloud-drift var(--dur, 50s) linear infinite;
		animation-delay: var(--delay, 0s);
	}
	@keyframes cloud-drift {
		from {
			transform: translateX(0) scale(var(--scale, 1));
		}
		to {
			transform: translateX(150vw) scale(var(--scale, 1));
		}
	}

	/* Fireflies — soft warm glimmers drifting */
	.fireflies span {
		position: absolute;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #ffe9a8;
		box-shadow: 0 0 8px 3px rgba(255, 220, 130, 0.7);
		animation: firefly 6s ease-in-out infinite;
	}
	@keyframes firefly {
		0%,
		100% {
			opacity: 0;
			transform: translate(0, 0);
		}
		25% {
			opacity: 0.9;
		}
		50% {
			opacity: 0.5;
			transform: translate(14px, -10px);
		}
		75% {
			opacity: 0.8;
		}
	}

	/* Vignette — soft darkened edges (no motion) */
	.vignette {
		background: radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0, 0, 0, 0.5));
		mix-blend-mode: multiply;
	}

	/* Sparkle — scattered twinkles */
	.sparkle span {
		position: absolute;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 6px 2px rgba(255, 255, 255, 0.8);
		opacity: 0;
		animation: twinkle 4s ease-in-out infinite;
	}
	@keyframes twinkle {
		0%,
		92%,
		100% {
			opacity: 0;
			transform: scale(0.5);
		}
		96% {
			opacity: 0.9;
			transform: scale(1.3);
		}
	}

	/* Casino — chasing marquee bulbs along the top and bottom edges */
	.casino {
		left: 0;
		right: 0;
		height: 6px;
		inset: auto 0;
		background: repeating-linear-gradient(
			90deg,
			#ff4d6d 0 14px,
			#ffd166 14px 28px,
			#06d6a0 28px 42px,
			#4cc9f0 42px 56px,
			#b388ff 56px 70px
		);
		background-size: 70px 100%;
		animation: chase 0.8s linear infinite;
		opacity: 0.9;
	}
	.casino.top {
		top: 0;
	}
	.casino.bottom {
		bottom: 0;
		animation-direction: reverse;
	}
	@keyframes chase {
		to {
			background-position-x: 70px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hearth,
		.aurora,
		.sparkle span,
		.casino,
		.fall span,
		.rise span,
		.clouds span,
		.fireflies span {
			animation: none;
		}
		/* keep the cute particle fields hidden rather than frozen mid-screen */
		.fall,
		.rise {
			display: none;
		}
		.sparkle span,
		.fireflies span {
			opacity: 0.4;
		}
	}
</style>
