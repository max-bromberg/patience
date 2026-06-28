/** Render shell surface. These modules may import Svelte/DOM (unlike the engine). */
export { default as Table } from './Table.svelte';
export { default as Pile } from './Pile.svelte';
export { default as CardView } from './CardView.svelte';
export { default as GameIcon } from './GameIcon.svelte';
export { GameController, type TableSource } from './controller.svelte';
export * from './display';
export * from './dnd';
