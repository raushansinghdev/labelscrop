# LabelsCrop

Free, browser-only shipping label cropping and sorting tools for Indian e-commerce sellers. Meesho support first; Amazon and Flipkart are on the roadmap. No login, no server, no file ever leaves the browser.

See `/Users/raushan2410/.claude/plans/okay-so-i-want-moonlit-gizmo.md` for the full architecture plan.

## Stack

- [Astro](https://astro.build) (static output) for the SEO-critical shell
- A single React island (via `@astrojs/react`) for the interactive tool page
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Radix primitives) for components
- `motion` for in-tool animation; native Astro View Transitions for static-page navigation
- `pdf-lib` + `pdfjs-dist` (in a Web Worker, via `comlink`) for all PDF processing — planned for Phase B
- `zod` for config validation, `nanostores` for any state shared across islands

## Status

Phases A–D are done: static SEO shell, the platform-agnostic PDF engine with the Meesho adapter, the tool UI
wired to a Web Worker, and a mobile-first polish pass (step indicator, sticky bottom action bar, touch-sized
option cards/chips, live full-sheet preview, share-to-app on phones). A4 output supports 1, 2, or 4 labels per
sheet, with or without the invoice attached. Next up is Phase E (ads, analytics, deploy).

## Commands

| Command                    | Action                                      |
| :-------------------------- | :------------------------------------------- |
| `npm install`                | Install dependencies                         |
| `npm run dev`                 | Start local dev server at `localhost:4321`  |
| `npm run build`               | Build the production site to `./dist/`      |
| `npm run preview`             | Preview the build locally                    |
| `npx astro check`             | Type-check `.astro` files                    |
| `npx vitest run`               | Run the test suite                           |

## Deploying

Static output, intended for Cloudflare Pages (connect the GitHub repo; it builds and deploys automatically on every push, with preview URLs per branch/PR). Update `site` in `astro.config.mjs` to the real domain once one is chosen.
