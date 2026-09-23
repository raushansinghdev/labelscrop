/**
 * Single source of truth for brand identity.
 *
 * "SellerWala" is an umbrella brand, chosen over the older single-tool "LabelsCrop" for two
 * reasons: the site now hosts a profit calculator that has nothing to do with labels, and the
 * label-cropper naming space is crowded with near-identical competitors (labelcropper.com,
 * lablecropper.com, lebelcrop.com, elabelcrop.com, ailabelcrop.com). A distinctive name is
 * easier for a search engine to treat as its own entity and harder for a visitor to mistype
 * into a competitor's site. Keyword matching lives in the URL path instead, which is where it
 * still counts: /tools/meesho-label-cropper.
 *
 * The production domain deliberately lives in `astro.config.mjs` as `site`, not here —
 * pages read it via `Astro.site` so there is exactly one place to change it.
 */
export const SITE = {
	/** Brand name, as it appears in titles, prose, and structured data. */
	name: 'SellerWala',
	/** Used in prose where the brand is the grammatical subject, e.g. "<name> does not…". */
	legalName: 'SellerWala',
	/**
	 * One-line positioning used in `Organization` schema and as the fallback OG description.
	 * Kept here so the description of what this site *is* cannot drift between pages.
	 */
	tagline: 'Free browser-based tools for Indian e-commerce sellers',
} as const;
