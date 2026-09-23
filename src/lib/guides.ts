import { getCollection, type CollectionEntry } from 'astro:content';
import { DEFAULT_LOCALE, alternates, localePath, type Alternate, type Locale } from '@/lib/i18n';

export type Guide = CollectionEntry<'guides'>;

/**
 * Cluster display metadata.
 *
 * The keys mirror the `cluster` enum in `content.config.ts`; TypeScript will complain here if one
 * is added there and forgotten. Ordered the way the hub page reads top to bottom, which is the
 * order a seller meets the problems: get the labels printed, then work out what you earned.
 */
export const CLUSTERS = {
	'how-to': {
		en: { label: 'Getting started', blurb: 'Step-by-step walkthroughs of the jobs sellers do every day.' },
		'hi-Latn': { label: 'Shuruaat', blurb: 'Roz ke kaam, step by step.' },
	},
	printer: {
		en: { label: 'Printing', blurb: 'Label sizes, thermal printers, and A4 settings that actually work.' },
		'hi-Latn': { label: 'Printing', blurb: 'Label size, thermal printer aur A4 settings jo sach mein kaam karti hain.' },
	},
	courier: {
		en: { label: 'Couriers', blurb: 'Valmo, Delhivery, Shadowfax and the rest, and what changes between them.' },
		'hi-Latn': { label: 'Courier', blurb: 'Valmo, Delhivery, Shadowfax — aur inmein farak kya hai.' },
	},
	profit: {
		en: { label: 'Payments & profit', blurb: 'Settlements, deductions, returns, and what your margin really is.' },
		'hi-Latn': { label: 'Payment aur profit', blurb: 'Settlement, deduction, return — aur aapka asli margin kitna hai.' },
	},
	glossary: {
		en: { label: 'Glossary', blurb: 'The abbreviations on a label and in a payment file, in plain words.' },
		'hi-Latn': { label: 'Shabdkosh', blurb: 'Label aur payment file ke short forms, aasan bhasha mein.' },
	},
	comparison: {
		en: { label: 'Comparisons', blurb: 'Honest side-by-sides so you can pick without trying all of them.' },
		'hi-Latn': { label: 'Comparison', blurb: 'Seedha comparison, taaki sab try kiye bina chun sakein.' },
	},
} as const satisfies Record<Guide['data']['cluster'], Record<Locale, { label: string; blurb: string }>>;

export type ClusterKey = keyof typeof CLUSTERS;

/** Cluster label and blurb in one locale. */
export function cluster(key: ClusterKey, locale: Locale) {
	return CLUSTERS[key][locale];
}

/** The hub for each tool, so a guide can link back up without repeating the path and title. */
export const TOOLS = {
	'meesho-label-cropper': { name: 'Meesho Label Cropper', path: '/tools/meesho-label-cropper' },
	'meesho-profit-calculator': { name: 'Meesho Profit Calculator', path: '/tools/meesho-profit-calculator' },
} as const;

/**
 * Published guides, newest revision first.
 *
 * Drafts are filtered out in production only, so an unfinished guide is still previewable with
 * `astro dev` but can never be built into the sitemap by accident.
 */
export async function publishedGuides(locale: Locale = DEFAULT_LOCALE): Promise<Guide[]> {
	const all = await getCollection(
		'guides',
		({ data }) => data.locale === locale && (import.meta.env.DEV || !data.draft),
	);
	return all.sort((a, b) => b.data.updated.valueOf() - a.data.updated.valueOf());
}

/**
 * Sibling guides for the "read next" block: same cluster first, then the same tool.
 *
 * Falling back to the tool matters more than it looks. A cluster with one guide in it would
 * otherwise render an empty block and leave the page a dead end, which is exactly the orphan
 * problem the collection exists to avoid.
 */
export function relatedGuides(current: Guide, all: Guide[], limit = 3): Guide[] {
	const others = all.filter((g) => g.id !== current.id);
	const sameCluster = others.filter((g) => g.data.cluster === current.data.cluster);
	const sameTool = others.filter(
		(g) => g.data.cluster !== current.data.cluster && g.data.tool && g.data.tool === current.data.tool,
	);
	return [...sameCluster, ...sameTool, ...others].slice(0, limit);
}

/**
 * The frontmatter locale as a full BCP-47 tag.
 *
 * Frontmatter says `en` because that is what an author wants to type, but every other piece of
 * structured data on this site declares `en-IN` — and a guide claiming plain `en` while the
 * WebSite it belongs to claims `en-IN` is a contradiction for no benefit. The region matters
 * here: this is advice about an Indian marketplace, written for sellers in India.
 */
export function bcp47(locale: Locale): string {
	return locale === 'en' ? 'en-IN' : locale;
}

/** The path a guide is served at, in its own locale. */
export function guidePath(guide: Guide): string {
	return localePath(`/guides/${guide.id}`, guide.data.locale);
}

/**
 * The `hreflang` set for one guide.
 *
 * Both directions are derived from the same `translationOf` link, so a translation can never
 * point at an English guide that does not point back — the non-reciprocal case Google discards.
 */
export function guideAlternates(guide: Guide, everyGuide: Guide[]): Alternate[] {
	const englishId = guide.data.translationOf ?? guide.id;
	const family = everyGuide.filter(
		(g) => g.id === englishId || g.data.translationOf === englishId,
	);
	if (family.length < 2) return [];

	const paths: Partial<Record<Locale, string>> = {};
	for (const member of family) paths[member.data.locale] = `/guides/${member.id}`;
	return alternates(paths);
}

/** Every guide in every locale, for translation lookups. Drafts excluded in production. */
export async function allGuides(): Promise<Guide[]> {
	return getCollection('guides', ({ data }) => import.meta.env.DEV || !data.draft);
}

/** `2026-09-23` → `23 September 2026`. Indian date order, spelled out so it cannot be misread. */
export function formatDate(date: Date): string {
	return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
