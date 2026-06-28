<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import './layout.css';
	import '$lib/theme/theme.css';
	import '$lib/theme/faces.css';
	import VibeLayer from '$lib/render/VibeLayer.svelte';
	import { ambience } from '$lib/render/music';
	import { shade } from '$lib/theme/color';
	import { settings } from '$lib/storage/settings.svelte';

	let { children } = $props();

	// Background music: keep volume in sync and stop when turned off. Starting is
	// gated on a user gesture (browser autoplay policy) — the settings toggle
	// starts it within its own click; this kicks it on the first interaction when
	// it was left on from a previous visit.
	$effect(() => {
		if (!browser) return;
		ambience.setVolume(settings.musicVolume);
		if (!settings.music) ambience.stop();
	});
	onMount(() => {
		const kick = () => {
			if (settings.music) ambience.start();
		};
		window.addEventListener('pointerdown', kick, { once: true });
		window.addEventListener('keydown', kick, { once: true });
		return () => {
			window.removeEventListener('pointerdown', kick);
			window.removeEventListener('keydown', kick);
		};
	});

	const CUSTOM_VARS = ['--felt-1', '--felt-2', '--felt-3', '--back-1', '--back-2', '--drop-ring'];

	// Keep <html data-theme> + inline custom colors in sync with settings. An
	// inline script in app.html applies the saved theme before paint (no flash);
	// this tracks later changes. Also keep the mobile browser-chrome color in
	// step with the felt.
	$effect(() => {
		if (!browser) return;
		const el = document.documentElement;
		el.dataset.theme = settings.theme;
		el.dataset.face = settings.face;
		if (settings.theme === 'custom') {
			const { felt, back, accent } = settings.custom;
			el.style.setProperty('--felt-1', felt);
			el.style.setProperty('--felt-2', shade(felt, -0.24));
			el.style.setProperty('--felt-3', shade(felt, -0.42));
			el.style.setProperty('--back-1', back);
			el.style.setProperty('--back-2', shade(back, -0.22));
			el.style.setProperty('--drop-ring', accent);
		} else {
			for (const v of CUSTOM_VARS) el.style.removeProperty(v);
		}
		const themeColor = getComputedStyle(el).getPropertyValue('--felt-2').trim();
		if (themeColor) {
			let meta = document.querySelector('meta[name="theme-color"]');
			if (!meta) {
				meta = document.createElement('meta');
				meta.setAttribute('name', 'theme-color');
				document.head.appendChild(meta);
			}
			meta.setAttribute('content', themeColor);
		}
	});
</script>

<VibeLayer />
{@render children()}
