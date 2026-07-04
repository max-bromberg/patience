<script lang="ts">
	/**
	 * Celebration popup for a just-unlocked achievement. Renders whenever the
	 * store has a badge queued (front of the queue); dismissing shows the next one,
	 * if any. Compact and dismissible (button, backdrop tap, or Escape).
	 */
	import { ACHIEVEMENT_COUNT } from '$lib/achievements/catalog';
	import { achievements } from '$lib/storage/achievements.svelte';

	const badge = $derived(achievements.current);

	function dismiss() {
		achievements.dismissCurrent();
	}
</script>

{#if badge}
	<div
		class="overlay"
		role="button"
		tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && dismiss()}
		onkeydown={(e) => e.key === 'Escape' && dismiss()}
	>
		{#key badge.id}
			<div class="card" role="dialog" aria-label="Achievement unlocked: {badge.name}">
				<span class="kicker">🏅 Achievement unlocked</span>
				<div class="badge"><span class="emoji">{badge.emoji}</span></div>
				<h2>{badge.name}</h2>
				<p class="desc">{badge.description}</p>
				<p class="progress">{achievements.earnedCount} of {ACHIEVEMENT_COUNT} earned</p>
				<button class="nice" onclick={dismiss}>Nice</button>
			</div>
		{/key}
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		/* above the win overlay / confetti (which climb into the low thousands) */
		z-index: 7000;
		background: rgba(0, 0, 0, 0.5);
		animation: fade 0.2s var(--ease-out);
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	.card {
		width: 100%;
		max-width: 20rem;
		background: var(--card-bg);
		color: var(--card-ink-black);
		border-radius: 1.1rem;
		padding: 1.5rem 1.5rem 1.35rem;
		text-align: center;
		box-shadow: var(--card-shadow-lift);
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		animation: pop 0.32s var(--ease-out);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(0.6rem) scale(0.9);
		}
	}

	.kicker {
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #8a6d1f;
	}

	.badge {
		width: 5rem;
		height: 5rem;
		border-radius: 50%;
		display: grid;
		place-items: center;
		margin: 0.15rem 0 0.1rem;
		background: radial-gradient(circle at 50% 32%, #fff2c4, #ffd772 60%, #f0b93f);
		box-shadow:
			0 4px 14px rgba(240, 185, 63, 0.5),
			inset 0 0 0 3px rgba(255, 255, 255, 0.55);
		position: relative;
		overflow: hidden;
	}
	/* a slow sweep of shine across the medal */
	.badge::after {
		content: '';
		position: absolute;
		inset: -40%;
		background: linear-gradient(
			60deg,
			transparent 40%,
			rgba(255, 255, 255, 0.75) 50%,
			transparent 60%
		);
		transform: translateX(-120%);
		animation: shine 2.4s ease-in-out 0.3s infinite;
	}
	@keyframes shine {
		to {
			transform: translateX(120%);
		}
	}
	.emoji {
		font-size: 2.4rem;
		line-height: 1;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
	}

	.card h2 {
		margin: 0.1rem 0 0;
		font-size: 1.3rem;
	}
	.desc {
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.35;
		color: #55555e;
	}
	.progress {
		margin: 0.15rem 0 0.25rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		color: #8a8a90;
	}

	.nice {
		font-family: inherit;
		font-weight: 800;
		color: #fff;
		background: var(--back-1);
		border: none;
		border-radius: 999px;
		padding: 0.55rem 1.8rem;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.nice:active {
		transform: scale(0.96);
	}

	@media (prefers-reduced-motion: reduce) {
		.overlay,
		.card,
		.badge::after {
			animation: none;
		}
	}
</style>
