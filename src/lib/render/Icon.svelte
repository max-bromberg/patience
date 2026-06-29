<script lang="ts" module>
	/**
	 * Reusable inline-SVG icon set for the UI chrome (top bars, quick actions,
	 * modal buttons). Every glyph is drawn with `currentColor`, so an icon simply
	 * inherits the `color` of the button it sits in — which is always a theme
	 * custom property (`--ui-text`, `--drop-ring`, …). That means the whole icon
	 * set recolors automatically with the active theme / custom palette, no
	 * per-icon wiring needed. The motifs lean card-themed where it reads well
	 * (deal = two cards, random = a die, help = a card-corner "?").
	 */
	export type IconName =
		| 'back'
		| 'undo'
		| 'deal'
		| 'sound-on'
		| 'sound-off'
		| 'help'
		| 'auto'
		| 'stats'
		| 'settings'
		| 'dice'
		| 'continue'
		| 'share'
		| 'check';
</script>

<script lang="ts">
	let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg
	class="ui-icon"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	role="img"
	aria-hidden="true"
>
	{#if name === 'back'}
		<polyline points="14 6 8 12 14 18" />
	{:else if name === 'undo'}
		<polyline points="9 14 4 9 9 4" />
		<path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H9" />
	{:else if name === 'deal'}
		<!-- two cards mid-shuffle -->
		<rect x="3.5" y="7" width="10" height="13.5" rx="2" transform="rotate(-9 8.5 13.75)" />
		<rect x="10.5" y="3.5" width="10" height="13.5" rx="2" transform="rotate(9 15.5 10.25)" />
	{:else if name === 'sound-on'}
		<path d="M4 9v6h3.5L13 19V5L7.5 9H4z" fill="currentColor" stroke-linejoin="round" />
		<path d="M16.5 8.8a4.5 4.5 0 0 1 0 6.4" fill="none" />
		<path d="M19.2 6.3a8 8 0 0 1 0 11.4" fill="none" />
	{:else if name === 'sound-off'}
		<path d="M4 9v6h3.5L13 19V5L7.5 9H4z" fill="currentColor" stroke-linejoin="round" />
		<line x1="16.5" y1="9.5" x2="21.5" y2="14.5" />
		<line x1="21.5" y1="9.5" x2="16.5" y2="14.5" />
	{:else if name === 'help'}
		<path d="M9 9.2a3 3 0 1 1 4.3 2.9c-.9.5-1.3 1-1.3 2.1" />
		<line x1="12" y1="17.5" x2="12" y2="17.6" stroke-width="2.4" />
	{:else if name === 'auto'}
		<polygon points="12 6 20 12 12 18" fill="currentColor" />
		<polygon points="4 6 12 12 4 18" fill="currentColor" />
	{:else if name === 'stats'}
		<line x1="6" y1="20" x2="6" y2="13" />
		<line x1="12" y1="20" x2="12" y2="5" />
		<line x1="18" y1="20" x2="18" y2="10" />
	{:else if name === 'settings'}
		<circle cx="12" cy="12" r="3" />
		<path
			d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
		/>
	{:else if name === 'dice'}
		<rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
		<circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
		<circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
		<circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
		<circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
		<circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
	{:else if name === 'continue'}
		<polygon points="7 5 19 12 7 19" fill="currentColor" />
	{:else if name === 'share'}
		<circle cx="18" cy="5" r="2.6" />
		<circle cx="6" cy="12" r="2.6" />
		<circle cx="18" cy="19" r="2.6" />
		<line x1="8.3" y1="13.4" x2="15.7" y2="17.6" />
		<line x1="15.7" y1="6.4" x2="8.3" y2="10.6" />
	{:else if name === 'check'}
		<polyline points="5 12.5 10 17.5 19 6.5" />
	{/if}
</svg>

<style>
	.ui-icon {
		display: block;
		flex: 0 0 auto;
	}
</style>
