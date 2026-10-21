# Sutra design system

Sutra is the product; "by Emporum" is the studio line and stays small and secondary (see `components/brand/Logo.tsx`).
The look is derived from the Emporum reference: obsidian surfaces, warm ivory text, restrained antique gold, and a 3px gold hairline across the top of every screen.

- **Tokens**: `tailwind.config.ts`. Surfaces step `paper` (page), `surface` (cards), `raised` (hover and nested); `inset` is for inputs. Gold is an accent for selection, focus, links and the single primary action per screen.
- **Type**: Manrope (UI) and DM Mono (student codes, the "by Emporum" line), both self-hosted via `@fontsource`, so there are no third-party font requests.
- **Components**: `components/ui.tsx` (buttons, inputs, cards, tables, badges, progress, stats), `components/status.tsx` (the single definition of how attendance and outcomes look), `components/states.tsx` (loading and error), `components/confirm-dialog.tsx` (accessible confirmation).
- **Status is never colour alone**: every outcome and attendance state has its own icon and a text label.
- **Layout**: `components/layout/` (sidebar, mobile menu, auth frame).
- **Motion**: hover and selection feedback, one sheen on the sign-in card, short rises for alerts. All of it is disabled under `prefers-reduced-motion`.
