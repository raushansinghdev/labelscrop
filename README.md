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

**Phase A (this commit): static SEO shell.** Landing page, How it Works, FAQ, About, Privacy/Terms, and placeholder pages for the Meesho/Amazon/Flipkart tools. The Meesho tool page has no working upload/crop engine yet — that's Phase B.

Phase B is blocked on getting a second real Meesho label sample from a different courier (one Delhivery sample is already in hand) and the final options list for the Meesho tool.

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
