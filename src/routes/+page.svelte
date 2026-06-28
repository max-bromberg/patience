<script lang="ts">
	import { resolve } from '$app/paths';
	import type { GameMeta } from '$lib/engine';
	import { catalog } from '$lib/games/registry';

	// Group the catalog by family (e.g. 'builder') for sectioned browsing.
	// The catalog is a build-time constant, so this is computed once.
	function groupByFamily(metas: readonly GameMeta[]): [string, GameMeta[]][] {
		const groups: [string, GameMeta[]][] = [];
		for (const meta of metas) {
			const found = groups.find(([family]) => family === meta.family);
			if (found) found[1].push(meta);
			else groups.push([meta.family, [meta]]);
		}
		return groups;
	}
	const groups = groupByFamily(catalog);

	const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
</script>

<svelte:head>
	<title>Patience · cozy card games</title>
	<meta name="description" content="A cozy collection of single-player card games." />
</svelte:head>

<main class="home">
	<div class="shell">
		<header class="hero">
			<div class="logo" aria-hidden="true">
				<span class="pip a">🂡</span><span class="pip b">🂾</span><span class="pip c">🃞</span>
			</div>
			<h1>Patience</h1>
			<p class="tagline">A cozy collection of single-player card games.</p>
		</header>

		{#each groups as [family, metas] (family)}
			<section class="family">
				<h2>{titleCase(family)}</h2>
				<ul class="grid">
					{#each metas as meta (meta.id)}
						<li>
							<a class="tile" href={resolve(`/play/${meta.id}`)}>
								<span class="art" aria-hidden="true">
									<span class="mini m1"></span>
									<span class="mini m2"></span>
									<span class="mini m3"></span>
								</span>
								<span class="name">{meta.name}</span>
								<span class="blurb">{meta.blurb}</span>
								<span class="pill {meta.difficulty}">{meta.difficulty}</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}

		<footer class="foot">More games dealing soon.</footer>
	</div>
</main>

<style>
	.home {
		min-height: 100dvh;
		background: var(--table-bg);
		background-blend-mode: var(--table-blend);
		color: var(--ui-text);
		font-family: var(--font-rounded);
		padding: calc(1.5rem + env(safe-area-inset-top)) clamp(1.1rem, 4vw, 3rem)
			calc(2rem + env(safe-area-inset-bottom));
		box-sizing: border-box;
	}

	.shell {
		max-width: 1180px;
		margin: 0 auto;
	}

	.hero {
		text-align: center;
		margin-bottom: 1.75rem;
	}
	.logo {
		font-size: clamp(2.75rem, 14vw, 4rem);
		line-height: 1;
		filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.35));
	}
	.logo .pip {
		display: inline-block;
		color: #fffdf8;
	}
	.logo .a {
		transform: rotate(-12deg) translateY(4px);
	}
	.logo .b {
		transform: translateY(-6px);
		margin: 0 -0.35em;
	}
	.logo .c {
		transform: rotate(12deg) translateY(4px);
	}
	h1 {
		margin: 0.4rem 0 0;
		font-size: clamp(2.25rem, 11vw, 3.25rem);
		font-weight: 800;
		letter-spacing: -0.02em;
		text-shadow: 0 2px 0 rgba(0, 0, 0, 0.18);
	}
	.tagline {
		margin: 0.2rem 0 0;
		color: var(--ui-muted);
		font-size: clamp(0.95rem, 4vw, 1.1rem);
	}

	.family h2 {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--ui-muted);
		margin: 1.25rem 0 0.6rem;
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 230px));
		justify-content: center;
		gap: 0.9rem;
	}

	.tile {
		display: grid;
		grid-template-rows: auto auto 1fr auto;
		gap: 0.4rem;
		height: 100%;
		padding: 0.9rem;
		border-radius: 1rem;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: inherit;
		text-decoration: none;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
		transition:
			transform 0.16s var(--ease-out),
			background 0.16s var(--ease-out);
	}
	.tile:hover {
		transform: translateY(-3px);
		background: rgba(0, 0, 0, 0.3);
	}
	.tile:active {
		transform: translateY(-1px);
	}

	.art {
		position: relative;
		display: block;
		height: 56px;
	}
	.mini {
		position: absolute;
		top: 4px;
		width: 34px;
		height: 48px;
		border-radius: 6px;
		background: var(--card-bg);
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(0, 0, 0, 0.12);
	}
	.m1 {
		left: calc(50% - 30px);
		transform: rotate(-14deg);
	}
	.m2 {
		left: calc(50% - 17px);
		top: 1px;
		z-index: 1;
	}
	.m3 {
		left: calc(50% - 4px);
		transform: rotate(14deg);
		background: repeating-linear-gradient(
			45deg,
			var(--back-1) 0,
			var(--back-1) 4px,
			var(--back-2) 4px,
			var(--back-2) 8px
		);
	}

	.name {
		font-weight: 700;
		font-size: 1.05rem;
	}
	.blurb {
		font-size: 0.82rem;
		color: var(--ui-muted);
		line-height: 1.25;
	}
	.pill {
		justify-self: start;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		font-weight: 700;
	}
	.pill.easy {
		background: #2f7d57;
		color: #eafff1;
	}
	.pill.medium {
		background: #c79a3a;
		color: #2b2208;
	}
	.pill.hard {
		background: #c8324a;
		color: #fff0f2;
	}

	.foot {
		text-align: center;
		color: var(--ui-muted);
		font-size: 0.85rem;
		margin-top: 2rem;
		font-style: italic;
	}
</style>
