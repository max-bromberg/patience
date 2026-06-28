<script lang="ts">
	import { browser } from '$app/environment';
	import './layout.css';
	import '$lib/theme/theme.css';
	import favicon from '$lib/assets/favicon.svg';
	import { settings } from '$lib/storage/settings.svelte';

	let { children } = $props();

	// Keep <html data-theme> in sync with the chosen theme (an inline script in
	// app.html sets it before paint to avoid a flash; this tracks later changes).
	$effect(() => {
		if (browser) document.documentElement.dataset.theme = settings.theme;
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
