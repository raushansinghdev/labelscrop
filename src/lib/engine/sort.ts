import type { SortKey, SourcePage } from './types';

// Separates the two fields in a composite sort key. A printable separator (space, "-") risks colliding
// with real color/size text (e.g. "Free Size"); this escape never appears in extracted label text.
const COMPOSITE_SEPARATOR = '\u0000';

function sortValue(page: SourcePage, key: SortKey): string | null {
	const { color, size } = page.metadata;
	switch (key) {
		case 'sku':
			return page.metadata.sku;
		case 'courier':
			return page.metadata.courier;
		case 'destinationCode':
			return page.metadata.destinationCode;
		case 'colorSize':
			return color === null && size === null ? null : `${color ?? ''}${COMPOSITE_SEPARATOR}${size ?? ''}`;
		case 'sizeColor':
			return color === null && size === null ? null : `${size ?? ''}${COMPOSITE_SEPARATOR}${color ?? ''}`;
		case 'original':
			return null;
	}
}

/** Reorders pages by the requested key. Pages whose metadata is missing that field (extraction failed, or
 * an unrecognized page) sort to the end rather than being dropped or throwing — per the plan's error
 * handling, a page with no usable metadata should still make it into the output, just in its original
 * relative position among the "unknown" pages. `'original'` returns pages in upload order unchanged. */
export function sortPages(pages: SourcePage[], key: SortKey): SourcePage[] {
	const indexed = pages.map((page, index) => ({ page, index }));

	indexed.sort((a, b) => {
		if (key === 'original') {
			return (
				a.page.fileIndex - b.page.fileIndex ||
				a.page.pageIndex - b.page.pageIndex ||
				a.index - b.index
			);
		}

		const av = sortValue(a.page, key);
		const bv = sortValue(b.page, key);
		if (av === null && bv === null) return a.index - b.index;
		if (av === null) return 1;
		if (bv === null) return -1;

		const cmp = av.localeCompare(bv);
		return cmp !== 0 ? cmp : a.index - b.index;
	});

	return indexed.map((entry) => entry.page);
}
