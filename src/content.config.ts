import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// Astro re-exports a `z` from `astro:content`, but it is deprecated in Astro 7 — and the project
// already depends on zod directly, so there is no reason to go through the re-export.
import { z } from 'zod';

/**
 * The guides collection.
 *
 * Until this existed there was no way to publish a page without hand-writing an `.astro` file,
 * which is why the site had two tool pages and nothing behind them. The long tail for these
 * queries is large and shallow — one page each for "how to print meesho label on thermal
 * printer", "meesho RTO charges", "what is AWB number" — and that is only worth chasing if a new
 * page costs a Markdown file rather than a component.
 *
 * Every field here is required by something downstream, so none of them is decoration:
 *
 * - `cluster` drives the hub grouping and the "related guides" links. Hub-and-spoke linking is
 *   the whole point of a content engine; without a cluster key each guide is an orphan.
 * - `updated` is emitted as `dateModified`. Freshness is a real ranking input for how-to content
 *   and the date has to come from the frontmatter, not the file mtime, which a checkout resets.
 * - `faqs` render through the same `FaqBlock` the tool pages use and feed the same `faqPage()`
 *   builder, so a guide's questions cannot drift from its structured data.
 * - `tool` is the hub a guide points back up at. A guide that does not lead anywhere is traffic
 *   that arrives and leaves.
 *
 * `locale` is here now rather than later because the Hinglish pages are a planned phase, and
 * retrofitting a locale key onto an established collection means rewriting every slug.
 */
const guides = defineCollection({
	loader: glob({ base: './src/content/guides', pattern: '**/*.mdx' }),
	schema: z.object({
		title: z.string(),
		/** Meta description and the hub card's blurb. Kept under ~160 characters. */
		description: z.string(),
		cluster: z.enum(['how-to', 'printer', 'courier', 'profit', 'glossary', 'comparison']),
		published: z.coerce.date(),
		updated: z.coerce.date(),
		/**
		 * BCP-47. `hi-Latn` is romanized Hindi — the form Indian sellers actually type — and is
		 * what `<html lang>` and the hreflang pair will carry when those pages land.
		 */
		locale: z.enum(['en', 'hi-Latn']).default('en'),
		/**
		 * For a translation, the `id` of the English guide it translates — which is what lets the
		 * two pages emit reciprocal `hreflang` without a separate mapping file that would drift.
		 * A translation is still written by hand; this only records which page it is a version of.
		 */
		translationOf: z.string().optional(),
		/** The tool this guide sends readers to. */
		tool: z.enum(['meesho-label-cropper', 'meesho-profit-calculator']).optional(),
		/** Answers may contain inline HTML, exactly as on the tool pages. */
		faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
		draft: z.boolean().default(false),
	}),
});

export const collections = { guides };
