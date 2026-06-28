<script lang="ts">
	import { catalog } from '$lib/games/registry';
	import GameIcon from '$lib/render/GameIcon.svelte';
	import { stats } from '$lib/storage/stats.svelte';

	let { onClose }: { onClose: () => void } = $props();

	let confirmReset = $state(false);

	// Games that have been played at least once, most-played first.
	const rows = $derived(
		catalog
			.map((m) => ({ meta: m, s: stats.forGame(m.id) }))
			.filter((r) => r.s.played > 0)
			.sort((a, b) => b.s.played - a.s.played)
	);
	const totals = $derived(stats.totals);

	const rate = (won: number, played: number) => (played > 0 ? Math.round((won / played) * 100) : 0);
	function fmtTime(ms: number): string {
		const s = Math.round(ms / 1000);
		const m = Math.floor(s / 60);
		return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
	}
</script>

<div
	class="overlay"
	role="button"
	tabindex="-1"
	onclick={(e) => e.target === e.currentTarget && onClose()}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div class="sheet" role="dialog" aria-label="Your stats">
		<h2>Your stats</h2>

		<div class="sheet-body">
			{#if !stats.hasPlays}
				<p class="empty">No games finished yet — play a hand and your record shows up here.</p>
			{:else}
				<div class="totals">
					<div class="stat">
						<span class="num">{totals.played}</span><span class="lbl">Played</span>
					</div>
					<div class="stat"><span class="num">{totals.won}</span><span class="lbl">Won</span></div>
					<div class="stat">
						<span class="num">{totals.winRate}%</span><span class="lbl">Win rate</span>
					</div>
				</div>

				<ul class="list">
					{#each rows as { meta, s } (meta.id)}
						<li>
							<span class="ic"><GameIcon id={meta.id} size={34} /></span>
							<span class="info">
								<span class="name">{meta.name}</span>
								<span class="sub">{s.won}/{s.played} won · {rate(s.won, s.played)}%</span>
								{#if s.bestTimeMs || s.bestMoves}
									<span class="bests">
										{#if s.bestTimeMs}⚡ {fmtTime(s.bestTimeMs)}{/if}
										{#if s.bestTimeMs && s.bestMoves}·{/if}
										{#if s.bestMoves}🎯 {s.bestMoves} moves{/if}
									</span>
								{/if}
							</span>
							{#if s.best > 1}
								<span class="streak" title="Best win streak">🔥 {s.best}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="sheet-actions">
			{#if stats.hasPlays}
				{#if confirmReset}
					<button class="btn danger" onclick={() => (stats.reset(), (confirmReset = false))}>
						Confirm reset
					</button>
					<button class="btn ghost" onclick={() => (confirmReset = false)}>Cancel</button>
				{:else}
					<button class="btn ghost" onclick={() => (confirmReset = true)}>Reset</button>
				{/if}
			{/if}
			<button class="btn primary" onclick={onClose}>Done</button>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.5);
		z-index: 50;
		animation: fade 0.2s var(--ease-out);
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	.sheet {
		background: var(--card-bg);
		color: var(--card-ink-black);
		border-radius: 1rem;
		padding: 1.25rem 1.4rem;
		width: 100%;
		max-width: 26rem;
		max-height: calc(100dvh - 1.5rem);
		box-shadow: var(--card-shadow-lift);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		overflow: hidden;
	}
	.sheet h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	.sheet-body {
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		display: grid;
		gap: 1rem;
	}
	.empty {
		margin: 0;
		color: #6a6a72;
		font-size: 0.92rem;
		line-height: 1.4;
	}

	.totals {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		text-align: center;
	}
	.stat {
		display: grid;
		gap: 0.1rem;
		padding: 0.6rem 0.3rem;
		border-radius: 0.7rem;
		background: rgba(0, 0, 0, 0.05);
	}
	.stat .num {
		font-size: 1.4rem;
		font-weight: 800;
	}
	.stat .lbl {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #6a6a72;
		font-weight: 700;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}
	.list li {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.4rem 0.5rem;
		border-radius: 0.6rem;
		background: rgba(0, 0, 0, 0.03);
	}
	.ic {
		flex: 0 0 auto;
		line-height: 0;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
	}
	.info {
		display: grid;
		gap: 0.05rem;
		min-width: 0;
		flex: 1;
	}
	.info .name {
		font-weight: 700;
		font-size: 0.92rem;
	}
	.info .sub {
		font-size: 0.74rem;
		color: #6a6a72;
	}
	.info .bests {
		font-size: 0.7rem;
		color: #8a8a90;
		font-weight: 600;
	}
	.streak {
		font-size: 0.85rem;
		font-weight: 800;
		white-space: nowrap;
	}

	.sheet-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		flex: none;
		padding-top: 0.8rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
	}
	.btn {
		font-family: inherit;
		border: none;
		border-radius: 999px;
		padding: 0.5rem 1.1rem;
		font-weight: 700;
		cursor: pointer;
		background: rgba(0, 0, 0, 0.06);
		color: var(--card-ink-black);
	}
	.btn.primary {
		background: var(--back-1);
		color: #fff;
	}
	.btn.ghost {
		background: transparent;
	}
	.btn.danger {
		background: #c8324a;
		color: #fff;
	}
</style>
