<script lang="ts" module>
	/**
	 * A small, generated emblem for each game. The motif encodes the mechanic
	 * (stacked foundations, free cells, peaks, a fanned hand…) and the suit adds
	 * colour variety, so every catalogue tile reads as a distinct "kind" of game.
	 */
	export type Motif =
		| 'stack'
		| 'draw'
		| 'cells'
		| 'fan'
		| 'double'
		| 'tail'
		| 'columns'
		| 'peak'
		| 'peaks'
		| 'pyramid'
		| 'aces'
		| 'trick';

	type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
	interface IconSpec {
		motif: Motif;
		suit: Suit;
		badge?: string;
	}

	const PIP: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
	const isRed = (s: Suit) => s === 'hearts' || s === 'diamonds';

	/** Map each catalogue id to a motif + accent. Unknown ids fall back to a stack. */
	const ICONS: Record<string, IconSpec> = {
		klondike: { motif: 'stack', suit: 'spades' },
		klondikeDraw1: { motif: 'draw', suit: 'hearts' },
		freecell: { motif: 'cells', suit: 'diamonds' },
		yukon: { motif: 'fan', suit: 'clubs' },
		fortythieves: { motif: 'double', suit: 'hearts' },
		scorpion: { motif: 'tail', suit: 'spades' },
		spider1: { motif: 'columns', suit: 'clubs', badge: '1' },
		spider2: { motif: 'columns', suit: 'diamonds', badge: '2' },
		spider4: { motif: 'columns', suit: 'hearts', badge: '4' },
		golf: { motif: 'peak', suit: 'clubs' },
		tripeaks: { motif: 'peaks', suit: 'hearts' },
		pyramid: { motif: 'pyramid', suit: 'diamonds' },
		acesup: { motif: 'aces', suit: 'spades' },
		euchre: { motif: 'trick', suit: 'hearts', badge: '4' },
		euchre2: { motif: 'trick', suit: 'spades', badge: '2' },
		euchre3: { motif: 'trick', suit: 'diamonds', badge: '3' }
	};

	export function iconFor(id: string): IconSpec {
		return ICONS[id] ?? { motif: 'stack', suit: 'spades' };
	}
</script>

<script lang="ts">
	let { id, size = 46 }: { id: string; size?: number } = $props();
	const spec = $derived(iconFor(id));
	const pip = $derived(PIP[spec.suit]);
	const red = $derived(isRed(spec.suit));
</script>

<svg
	class="game-icon"
	viewBox="0 0 48 48"
	width={size}
	height={size}
	role="img"
	aria-hidden="true"
	style:--pip={red ? '#d23b4e' : '#2c2b35'}
>
	{#snippet card(x: number, y: number, rot: number, w = 13, h = 18, showPip = true)}
		<g transform="translate({x} {y}) rotate({rot})">
			<rect x={-w / 2} y={-h / 2} width={w} height={h} rx="2.5" class="mc" />
			{#if showPip}
				<text x="0" y="1.5" class="pip" text-anchor="middle">{pip}</text>
			{/if}
		</g>
	{/snippet}

	{#snippet cell(x: number, y: number)}
		<rect {x} {y} width="9" height="12" rx="2" class="cell" />
	{/snippet}

	{#if spec.motif === 'stack'}
		{@render card(13, 30, -4)}
		{@render card(22, 24, 0)}
		{@render card(31, 18, 4)}
	{:else if spec.motif === 'draw'}
		{@render card(18, 26, -2)}
		{@render card(21, 24, 2)}
		{@render card(34, 26, 8)}
		<path d="M26 24 h5" class="arrow" />
	{:else if spec.motif === 'cells'}
		{@render cell(5, 12)}
		{@render cell(15, 12)}
		{@render cell(25, 12)}
		{@render cell(35, 12)}
		{@render card(24, 33, 0)}
	{:else if spec.motif === 'fan'}
		{@render card(24, 28, -22)}
		{@render card(24, 26, -7)}
		{@render card(24, 26, 8)}
		{@render card(24, 28, 23)}
	{:else if spec.motif === 'double'}
		{@render card(16, 18, 0)}
		{@render card(16, 30, 0)}
		{@render card(32, 18, 0)}
		{@render card(32, 30, 0)}
	{:else if spec.motif === 'tail'}
		{@render card(20, 16, -6)}
		{@render card(23, 26, 4)}
		{@render card(28, 35, 16)}
	{:else if spec.motif === 'columns'}
		<rect x="9" y="12" width="7" height="26" rx="3" class="bar" />
		<rect x="20" y="12" width="7" height="26" rx="3" class="bar" />
		<rect x="31" y="12" width="7" height="26" rx="3" class="bar" />
	{:else if spec.motif === 'peak'}
		<path d="M24 9 L37 35 H11 Z" class="peak" />
		<line x1="24" y1="9" x2="24" y2="3" class="flagpole" />
		<path d="M24 3 l7 2.5 -7 2.5 Z" class="flag" />
	{:else if spec.motif === 'peaks'}
		<path d="M13 12 L20 30 H6 Z" class="peak" />
		<path d="M24 8 L32 30 H16 Z" class="peak" />
		<path d="M35 12 L42 30 H28 Z" class="peak" />
	{:else if spec.motif === 'pyramid'}
		{@render card(24, 12, 0, 12, 16)}
		{@render card(18, 26, 0, 12, 16)}
		{@render card(30, 26, 0, 12, 16)}
	{:else if spec.motif === 'aces'}
		{@render card(11, 24, -6, 11, 16)}
		{@render card(22, 24, -2, 11, 16)}
		{@render card(33, 24, 2, 11, 16)}
	{:else if spec.motif === 'trick'}
		{@render card(24, 28, -20)}
		{@render card(24, 25, -7)}
		{@render card(24, 25, 7)}
		{@render card(24, 28, 20)}
	{/if}

	{#if spec.badge}
		<g class="badge">
			<circle cx="39" cy="9" r="8" />
			<text x="39" y="12.5" text-anchor="middle">{spec.badge}</text>
		</g>
	{/if}
</svg>

<style>
	.game-icon {
		display: block;
	}
	.mc {
		fill: var(--card-bg, #fbf7ee);
		stroke: rgba(0, 0, 0, 0.18);
		stroke-width: 0.8;
	}
	.pip {
		fill: var(--pip);
		font-size: 9px;
		font-weight: 700;
		font-family: serif;
	}
	.cell {
		fill: none;
		stroke: var(--card-bg, #fbf7ee);
		stroke-width: 1.4;
		opacity: 0.75;
	}
	.bar {
		fill: var(--card-bg, #fbf7ee);
		opacity: 0.92;
	}
	.peak {
		fill: var(--card-bg, #fbf7ee);
		stroke: rgba(0, 0, 0, 0.15);
		stroke-width: 0.8;
		stroke-linejoin: round;
	}
	.flagpole {
		stroke: var(--card-bg, #fbf7ee);
		stroke-width: 1.4;
	}
	.flag {
		fill: var(--pip);
	}
	.arrow {
		stroke: var(--pip);
		stroke-width: 2;
		stroke-linecap: round;
	}
	.badge circle {
		fill: var(--back-1, #b23a48);
	}
	.badge text {
		fill: #fff;
		font-size: 10px;
		font-weight: 800;
		font-family: var(--font-rounded, sans-serif);
	}
</style>
