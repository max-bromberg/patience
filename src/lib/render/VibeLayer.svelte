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
</script>

<div class="vibes" aria-hidden="true">
	{#if settings.vibe('aurora')}
		<div class="aurora"></div>
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

	/* Hearth — warm flickering glow rising from the bottom */
	.hearth {
		background: radial-gradient(
			70% 45% at 50% 108%,
			rgba(255, 150, 60, 0.5),
			rgba(255, 120, 40, 0.18) 40%,
			transparent 70%
		);
		mix-blend-mode: screen;
		animation: flicker 3.2s ease-in-out infinite;
	}
	@keyframes flicker {
		0%,
		100% {
			opacity: 0.85;
			transform: scaleY(1);
		}
		25% {
			opacity: 1;
			transform: scaleY(1.04);
		}
		50% {
			opacity: 0.78;
			transform: scaleY(0.98);
		}
		75% {
			opacity: 0.95;
			transform: scaleY(1.02);
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
		.casino {
			animation: none;
		}
		.sparkle span {
			opacity: 0.5;
		}
	}
</style>
