<script lang="ts">
	// Phase 0 placeholder home. The real catalog (Phase 4) replaces this.
</script>

<svelte:head>
	<title>Patience</title>
	<meta name="description" content="A cozy collection of single-player card games." />
</svelte:head>

<main class="table">
	<section class="card-stack" aria-hidden="true">
		<span class="pip pip--1">🂡</span>
		<span class="pip pip--2">🂾</span>
		<span class="pip pip--3">🃞</span>
	</section>
	<h1>Patience</h1>
	<p class="tagline">A cozy collection of single-player card games.</p>
	<p class="soon">Shuffling the deck… coming soon.</p>
</main>

<style>
	.table {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 2rem 1.5rem calc(2rem + env(safe-area-inset-bottom));
		text-align: center;
		color: #fdfaf3;
		background: radial-gradient(120% 80% at 50% 0%, #2f7d57 0%, #1f5e40 55%, #184a32 100%);
		font-family: ui-rounded, 'SF Pro Rounded', system-ui, sans-serif;
	}

	.card-stack {
		display: flex;
		font-size: clamp(3.5rem, 18vw, 6rem);
		line-height: 1;
		filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.35));
	}

	.pip {
		display: inline-block;
		color: #fffdf8;
		transform-origin: bottom center;
	}
	.pip--1 {
		transform: rotate(-12deg) translateY(4px);
	}
	.pip--2 {
		transform: rotate(0deg) translateY(-6px);
		margin: 0 -0.4em;
	}
	.pip--3 {
		transform: rotate(12deg) translateY(4px);
	}

	h1 {
		margin: 0.5rem 0 0;
		font-size: clamp(2.5rem, 12vw, 4rem);
		font-weight: 800;
		letter-spacing: -0.02em;
		text-shadow: 0 2px 0 rgba(0, 0, 0, 0.18);
	}

	.tagline {
		margin: 0;
		font-size: clamp(1rem, 4.5vw, 1.25rem);
		color: #eef3ea;
	}

	.soon {
		margin-top: 0.5rem;
		font-size: 0.95rem;
		color: #cfe3d4;
		font-style: italic;
	}
</style>
