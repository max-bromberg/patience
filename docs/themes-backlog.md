# Themes Backlog

Shelved theming/aesthetic ideas. v1 ships a **single signature look** — a warm,
cute felt-table. Everything below is a candidate for a later "comprehensive theme
options" pass and is intentionally **not** built yet.

## Decided for v1

- One signature look: warm green felt table, soft shadows, rounded type, satisfying motion.
- Theme tokens should be structured (CSS custom properties in `src/lib/theme/`) so
  alternate themes can slot in later without touching components.

## Candidate themes (later)

- **Light / dark toggle** — respect `prefers-color-scheme`, plus a manual override
  persisted in `localStorage`.
- **Felt color variants** — selectable table colors (classic green, burgundy, navy,
  twilight purple, sand).
- **Seasonal / holiday skins** — subtle accent + back-of-card art swaps.
- **Card back designs** — a small gallery of patterned card backs.
- **High-contrast / accessibility theme** — larger pips, stronger color separation.
- **"Cozy night"** — dimmed warm palette for low-light play.

## Notes

- All themes must keep card faces legible and maintain WCAG-ish contrast for rank/suit.
- Motion intensity could itself be a setting (respect `prefers-reduced-motion`).
