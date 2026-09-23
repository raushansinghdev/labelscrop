/**
 * Locales, and the `hreflang` pairs that connect them.
 *
 * **Why romanized Hindi and not Devanagari.** Around 93% of native Hindi speakers write in Roman
 * script, and Hinglish preference among Indian users has risen from roughly 45% to 56% over the
 * last decade. A Meesho seller looking for this tool types `meesho label crop kaise kare`, not
 * `मीशो लेबल क्रॉप कैसे करें`. Devanagari pages would be beautifully translated and would target
 * queries almost nobody enters. Devanagari is worth revisiting only once Hinglish is measurably
 * ranking, and mainly for voice search.
 *
 * **`hi-Latn` is valid BCP-47** — `hi` plus the ISO 15924 script subtag for Latin — and Google
 * detects Hindi written in Latin script. Being honest about the mechanism, though: Google's
 * documentation does not explicitly confirm how it treats script subtags in `hreflang`. The
 * ranking work is done by the on-page text matching the query. The `hreflang` is cheap insurance,
 * not the thing that makes it work.
 *
 * **Everything is hand-written.** Machine-translating a site into eight or ten locales is the
 * textbook trigger for Google's scaled-content-abuse policy. Two locales written properly beat
 * ten thin ones, and this is a rule about the site rather than about any one page.
 */
export const LOCALES = {
	en: {
		/** `<html lang>` and the `hreflang` attribute. */
		tag: 'en-IN',
		/** URL prefix. The default locale is unprefixed, so English URLs never change. */
		prefix: '',
		/** Shown in the language switcher, in the language itself. */
		name: 'English',
		ogLocale: 'en_IN',
	},
	'hi-Latn': {
		tag: 'hi-Latn',
		prefix: '/hi',
		name: 'Hinglish',
		ogLocale: 'hi_IN',
	},
} as const satisfies Record<string, { tag: string; prefix: string; name: string; ogLocale: string }>;

export type Locale = keyof typeof LOCALES;

export const DEFAULT_LOCALE: Locale = 'en';

/** Prefixes a root-absolute path for a locale. `/guides` + `hi-Latn` → `/hi/guides`. */
export function localePath(path: string, locale: Locale): string {
	const { prefix } = LOCALES[locale];
	if (!prefix) return path;
	return path === '/' ? prefix : `${prefix}${path}`;
}

/**
 * Page chrome, per locale.
 *
 * Only the furniture lives here — headings the template emits, not content. Article prose is
 * written per language in `src/content/guides/`, never assembled from strings, because a page
 * built out of interpolated fragments reads like a page built out of interpolated fragments.
 *
 * The Hinglish column is written the way sellers actually write: Roman script, Hindi words where
 * Hindi is natural and English words where English is what people say out loud. "Sawal" rather
 * than "prashn"; "print karein" rather than "mudran karen". Over-correcting toward formal Hindi
 * is the most common way Hinglish copy ends up sounding like a government form.
 */
export const UI = {
	en: {
		home: 'Home',
		guides: 'Guides',
		onThisPage: 'On this page',
		commonQuestions: 'Common questions',
		readNext: 'Read next',
		updated: 'Updated',
		allGuides: 'All guides',
		tryTitle: 'Try it on your own file',
		tryText: 'Free, no login, and nothing is uploaded — it all runs in your browser.',
		openTool: (tool: string) => `Open the ${tool}`,
	},
	'hi-Latn': {
		home: 'Home',
		guides: 'Guides',
		onThisPage: 'Is page mein',
		commonQuestions: 'Aksar puche jane wale sawal',
		readNext: 'Aage padhein',
		updated: 'Update kiya',
		allGuides: 'Sabhi guides',
		tryTitle: 'Apni file par try karein',
		tryText: 'Bilkul free, koi login nahi, aur kuch bhi upload nahi hota — sab aapke browser mein hi chalta hai.',
		openTool: (tool: string) => `${tool} kholein`,
	},
} as const satisfies Record<Locale, Record<string, unknown>>;

export interface Alternate {
	/** The `hreflang` value. */
	hreflang: string;
	/** Root-absolute path, before Astro's `base` is applied. */
	path: string;
}

/**
 * The `hreflang` set for a page that exists in more than one locale.
 *
 * Two rules this follows, both of which are the usual way `hreflang` gets implemented wrongly:
 *
 * 1. **Every alternate list includes the page itself.** A set where page A points at B but B does
 *    not point back at A is non-reciprocal, and Google ignores non-reciprocal annotations
 *    entirely — so a self-reference is not redundant, it is what makes the set valid.
 * 2. **`x-default` points at the default locale**, which is where a visitor with no matching
 *    language should land.
 *
 * Returns an empty array for a page with no translation. A single page annotating only itself is
 * pointless markup, and an `hreflang` pointing at a URL that does not exist is worse than none.
 */
export function alternates(paths: Partial<Record<Locale, string>>): Alternate[] {
	const entries = Object.entries(paths) as [Locale, string][];
	if (entries.length < 2) return [];

	const list: Alternate[] = entries.map(([locale, path]) => ({
		hreflang: LOCALES[locale].tag,
		path: localePath(path, locale),
	}));

	const fallback = paths[DEFAULT_LOCALE];
	if (fallback) list.push({ hreflang: 'x-default', path: localePath(fallback, DEFAULT_LOCALE) });
	return list;
}
