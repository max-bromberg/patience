<script lang="ts">
	// A short, self-contained confetti burst for wins. Pure CSS animation per
	// piece; mounted only on victory (client-side), so Math.random is fine here.
	const COLORS = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#fffdf8'];
	const COUNT = 70;

	interface Piece {
		left: number;
		delay: number;
		duration: number;
		color: string;
		size: number;
		rotate: number;
		drift: number;
	}

	const pieces: Piece[] = Array.from({ length: COUNT }, (_, i) => ({
		left: Math.random() * 100,
		delay: Math.random() * 0.6,
		duration: 1.8 + Math.random() * 1.6,
		color: COLORS[i % COLORS.length],
		size: 6 + Math.random() * 7,
		rotate: Math.random() * 360,
		drift: (Math.random() - 0.5) * 120
	}));
</script>

<div class="confetti" aria-hidden="true">
	{#each pieces as p, i (i)}
		<span
			style="
				left:{p.left}%;
				width:{p.size}px;
				height:{p.size * 0.6}px;
				background:{p.color};
				animation-delay:{p.delay}s;
				animation-duration:{p.duration}s;
				--rot:{p.rotate}deg;
				--drift:{p.drift}px;
			"
		></span>
	{/each}
</div>

<style>
	.confetti {
		position: fixed;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 5500;
	}
	.confetti span {
		position: absolute;
		top: -5%;
		border-radius: 1px;
		opacity: 0;
		animation-name: fall;
		animation-timing-function: ease-in;
		animation-iteration-count: 1;
		animation-fill-mode: forwards;
	}
	@keyframes fall {
		0% {
			opacity: 1;
			transform: translate3d(0, -10vh, 0) rotate(var(--rot));
		}
		100% {
			opacity: 0.9;
			transform: translate3d(var(--drift), 110vh, 0) rotate(calc(var(--rot) + 540deg));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.confetti {
			display: none;
		}
	}
</style>
