/**
 * Single source of truth for brand identity.
 *
 * The name is still being decided (the site is moving from a single-tool "LabelsCrop"
 * brand to a seller-tools umbrella that also hosts the profit calculator), so nothing
 * hardcodes it. Renaming is a one-line edit here instead of a sweep across every page.
 *
 * The production domain deliberately lives in `astro.config.mjs` as `site`, not here —
 * pages read it via `Astro.site` so there is exactly one place to change it.
 */
export const SITE = {
	/** Brand name, as it appears in titles, prose, and structured data. */
	name: 'LabelsCrop',
	/** Used in prose where the brand is the grammatical subject, e.g. "<name> does not…". */
	legalName: 'LabelsCrop',
} as const;
