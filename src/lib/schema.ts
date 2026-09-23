/**
 * Shared JSON-LD builders.
 *
 * Every page used to declare its own structured data from scratch, which meant the site had no
 * single identity a search engine could attach anything to — just a scatter of unrelated objects
 * that happened to share a name string. These builders give the brand one stable `@id`
 * (`<origin>/#organization`) and the site one (`<origin>/#website`), and everything else points
 * at them. That is what lets Google treat the tools, the guides and the reviews as facts about
 * *one* entity rather than about a dozen unrelated pages.
 *
 * `Astro.site` is the only source of the origin — it is configured once in `astro.config.mjs`,
 * so a domain change never has to be chased through page files.
 */
import { SITE } from '@/lib/site';
import { url } from '@/lib/url';
import { DEFAULT_LOCALE, UI, localePath, type Locale } from '@/lib/i18n';

/** Resolves a root-absolute path against the configured site origin, honouring Astro's `base`. */
export function abs(path: string, site: URL | undefined): string {
	return new URL(url(path), site).toString();
}

/** Stable identifiers. Everything that needs to reference the brand or the site uses these. */
export const ids = {
	organization: (site: URL | undefined) => `${abs('/', site)}#organization`,
	website: (site: URL | undefined) => `${abs('/', site)}#website`,
};

/**
 * The publisher. Emitted on every page via the layout, not just the home page — an entity that
 * only appears once is an entity Google has to guess about on every other URL.
 */
export function organization(site: URL | undefined): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'@id': ids.organization(site),
		name: SITE.name,
		legalName: SITE.legalName,
		url: abs('/', site),
		description: SITE.tagline,
		logo: {
			'@type': 'ImageObject',
			url: abs('/favicon.svg', site),
		},
		// The audience is stated explicitly because these tools are useless outside it, and a
		// narrow, honest audience declaration is easier to match to a query than a broad one.
		areaServed: { '@type': 'Country', name: 'India' },
		knowsAbout: [
			'Meesho seller tools',
			'Shipping label cropping',
			'Thermal label printing',
			'E-commerce profit calculation',
		],
	};
}

/**
 * The site itself.
 *
 * Deliberately carries no `SearchAction`. The old home-page schema claimed one pointing at
 * `/faq?q={search_term_string}`, but the FAQ page has no search input and never reads `q` — a
 * structured-data claim that does not survive one click is worse than no claim at all. If site
 * search is ever built, add it back here and nowhere else.
 */
export function website(site: URL | undefined): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'@id': ids.website(site),
		name: SITE.name,
		url: abs('/', site),
		description: SITE.tagline,
		publisher: { '@id': ids.organization(site) },
		inLanguage: 'en-IN',
	};
}

/**
 * Breadcrumbs. Google renders these in place of the raw URL in mobile results, which is where
 * almost all of this site's traffic will land, so they are worth emitting even on a shallow tree.
 *
 * `trail` excludes the home page — it is prepended here so every breadcrumb starts the same way.
 *
 * The home crumb follows the page's locale, both in its label and in where it points. A Hinglish
 * page whose trail began at the English home would send the reader out of their own language at
 * the first click, and it disagreed with the visible trail in `Breadcrumb.astro`, which has always
 * prepended the locale home — two breadcrumbs describing two different trees is exactly the
 * mismatch structured data is checked for.
 */
export function breadcrumbs(
	site: URL | undefined,
	trail: { name: string; path: string }[],
	locale: Locale = DEFAULT_LOCALE,
): Record<string, unknown> {
	const items = [{ name: UI[locale].home, path: localePath('/', locale) }, ...trail];
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: abs(item.path, site),
		})),
	};
}

/**
 * The shape an imported `astro:assets` image already has, narrowed to the fields needed here.
 * Declared structurally so this module stays free of an `astro:assets` import — it is plain TS
 * that the tests can load without the Astro runtime.
 */
export interface SchemaImage {
	/** The emitted asset path, e.g. `/_astro/diagram.hash.png`. */
	src: string;
	width: number;
	height: number;
}

/**
 * A single image, described.
 *
 * `caption` doubles as the image's accessible description on the page, so it is passed in from
 * the same place the `alt` text comes from — a caption that disagrees with the alt text is the
 * usual way these two drift apart.
 */
export function imageObject(
	site: URL | undefined,
	image: SchemaImage,
	caption: string,
): Record<string, unknown> {
	return {
		'@type': 'ImageObject',
		url: new URL(image.src, site).toString(),
		width: image.width,
		height: image.height,
		caption,
	};
}

/**
 * A free browser tool.
 *
 * `price: '0'` with `priceCurrency: 'INR'` is what makes the "Free" annotation eligible in
 * results, and the currency is what ties the offer to the Indian market.
 */
export function softwareApplication(
	site: URL | undefined,
	tool: {
		name: string;
		path: string;
		description: string;
		/** Defaults to BusinessApplication; the profit calculator is a FinanceApplication. */
		category?: string;
		/** Diagrams explaining the tool, which is what makes it eligible for Google Images. */
		images?: { image: SchemaImage; caption: string }[];
		/**
		 * BCP-47 tag for the *page*, not the software. The tool's own interface is English in
		 * every locale; what changes is the language of the page describing it, and that is what
		 * `inLanguage` is read as here — the Hinglish page is a separate URL with its own copy.
		 */
		locale?: string;
	},
): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: tool.name,
		url: abs(tool.path, site),
		description: tool.description,
		applicationCategory: tool.category ?? 'BusinessApplication',
		operatingSystem: 'Any (runs in browser)',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
		publisher: { '@id': ids.organization(site) },
		isPartOf: { '@id': ids.website(site) },
		inLanguage: tool.locale ?? 'en-IN',
		...(tool.images?.length
			? { image: tool.images.map((i) => imageObject(site, i.image, i.caption)) }
			: {}),
	};
}

/**
 * A guide.
 *
 * `Article` rather than `BlogPosting`: these are reference pages that get revised, not dated
 * posts, and `dateModified` is the field that matters for them. Both dates come from the
 * frontmatter rather than the file system, because a fresh checkout resets every mtime and would
 * silently republish the whole archive as new.
 *
 * `mainEntityOfPage` is what stops Google treating the article and the URL as two things.
 */
export function article(
	site: URL | undefined,
	guide: {
		title: string;
		description: string;
		path: string;
		published: Date;
		updated: Date;
		locale?: string;
		image?: SchemaImage;
	},
): Record<string, unknown> {
	const pageUrl = abs(guide.path, site);
	return {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: guide.title,
		description: guide.description,
		url: pageUrl,
		mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
		datePublished: guide.published.toISOString(),
		dateModified: guide.updated.toISOString(),
		author: { '@id': ids.organization(site) },
		publisher: { '@id': ids.organization(site) },
		isPartOf: { '@id': ids.website(site) },
		inLanguage: guide.locale ?? 'en-IN',
		...(guide.image ? { image: imageObject(site, guide.image, guide.title) } : {}),
	};
}

/**
 * FAQ rich results.
 *
 * Takes the same array that renders the visible questions, so the two cannot drift — the pattern
 * already proven on `src/pages/faq.astro`. Answers may contain inline markup; it is stripped
 * here because the schema expects text, while the DOM keeps its links.
 */
export function faqPage(faqs: { q: string; a: string }[]): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((faq) => ({
			'@type': 'Question',
			name: faq.q,
			acceptedAnswer: {
				'@type': 'Answer',
				text: faq.a.replace(/<[^>]+>/g, ''),
			},
		})),
	};
}
