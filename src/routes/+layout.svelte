<script lang="ts">
	import { browser } from '$app/environment';
	import './layout.css';
	import '$lib/theme/theme.css';
	import VibeLayer from '$lib/render/VibeLayer.svelte';
	import { shade } from '$lib/theme/color';
	import { settings } from '$lib/storage/settings.svelte';

	let { children } = $props();

	const CUSTOM_VARS = ['--felt-1', '--felt-2', '--felt-3', '--back-1', '--back-2'];

	// Keep <html data-theme> + inline custom colors in sync with settings. An
	// inline script in app.html applies the saved theme before paint (no flash);
	// this tracks later changes.
	$effect(() => {
		if (!browser) return;
		const el = document.documentElement;
		el.dataset.theme = settings.theme;
		if (settings.theme === 'custom') {
			const { felt, back } = settings.custom;
			el.style.setProperty('--felt-1', felt);
			el.style.setProperty('--felt-2', shade(felt, -0.24));
			el.style.setProperty('--felt-3', shade(felt, -0.42));
			el.style.setProperty('--back-1', back);
			el.style.setProperty('--back-2', shade(back, -0.22));
		} else {
			for (const v of CUSTOM_VARS) el.style.removeProperty(v);
		}
	});
</script>

<VibeLayer />
{@render children()}
