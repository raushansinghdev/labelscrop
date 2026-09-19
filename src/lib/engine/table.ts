import type { TextItem } from './types';

export interface ColumnSpec<K extends string> {
	key: K;
	/** Matches this column's header cell text. */
	match: RegExp;
}

export interface ParsedRow<K extends string> {
	headerY: number;
	dataY: number;
	values: Record<K, string | null>;
}

const DEFAULT_Y_TOLERANCE = 1;
// How far (in PDF points) an item may sit from its nearest header column and still be considered part of
// that table, when hunting for the data row. Needs to be generous enough to tolerate normal column-to-cell
// misalignment, but tight enough to exclude an unrelated block sitting in a completely different column
// (e.g. a wrapped customer-address line has no business being mistaken for a table cell).
const DEFAULT_X_CLUSTER_TOLERANCE = 80;

/** Parses a simple "header row, then one data row, columns aligned by x-position" table — the pattern used
 * by both the Product Details (SKU/Size/Qty/Color/Order No.) and Purchase Order (Purchase Order No./Invoice
 * No./Order Date/Invoice Date) blocks on a Meesho label. Column values are matched to headers by nearest
 * x-position rather than array order, so this works regardless of which columns a given template includes
 * or how they're arranged — a platform module only needs to supply the header patterns. Returns `null` if no
 * header row could be located at all (missing individual columns still resolve to `null` values, not a
 * total failure), since a single unrecognized table shouldn't fail the whole page.
 *
 * Candidate rows are restricted to items that sit near one of the table's own header columns — without
 * this, a neighboring block in a different column (e.g. a customer address that happens to wrap onto an
 * extra line on some pages) can land at a y-position between the header and the true data row and get
 * mistaken for it. */
export function parseHeaderDataRow<K extends string>(
	items: TextItem[],
	columns: ColumnSpec<K>[],
	yTolerance = DEFAULT_Y_TOLERANCE,
	xClusterTolerance = DEFAULT_X_CLUSTER_TOLERANCE,
): ParsedRow<K> | null {
	const headerMatches: { key: K; item: TextItem }[] = [];
	for (const col of columns) {
		const found = items.find((item) => col.match.test(item.text.trim()));
		if (found) headerMatches.push({ key: col.key, item: found });
	}
	if (headerMatches.length === 0) return null;

	// Headers are expected to share one row; anchor on the first match's y and only keep others that are
	// actually close to it, in case a column's pattern accidentally matched something elsewhere on the page.
	const headerY = headerMatches[0].item.y;
	const confirmedHeaders = headerMatches.filter(
		(h) => Math.abs(h.item.y - headerY) <= yTolerance * 4,
	);
	if (confirmedHeaders.length === 0) return null;

	const headerXs = confirmedHeaders.map((h) => h.item.x);
	const isNearAnyColumn = (item: TextItem) =>
		headerXs.some((hx) => Math.abs(item.x - hx) <= xClusterTolerance);

	const candidateRowYs = Array.from(
		new Set(
			items
				.filter((item) => item.y < headerY - yTolerance && isNearAnyColumn(item))
				.map((item) => item.y),
		),
	).sort((a, b) => b - a);
	const dataY = candidateRowYs[0];
	if (dataY === undefined) return null;

	const rowItems = items.filter(
		(item) => Math.abs(item.y - dataY) <= yTolerance && isNearAnyColumn(item),
	);

	const values = {} as Record<K, string | null>;
	for (const col of columns) {
		const header = confirmedHeaders.find((h) => h.key === col.key);
		if (!header) {
			values[col.key] = null;
			continue;
		}
		let best: TextItem | null = null;
		let bestDist = Infinity;
		for (const item of rowItems) {
			const dist = Math.abs(item.x - header.item.x);
			if (dist < bestDist) {
				bestDist = dist;
				best = item;
			}
		}
		values[col.key] = best ? best.text.trim() : null;
	}

	return { headerY, dataY, values };
}
