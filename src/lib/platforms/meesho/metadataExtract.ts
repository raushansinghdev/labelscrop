import { parseHeaderDataRow } from '@/lib/engine/table';
import type { OrderMetadata, PageTextModel, PaymentMode, TextItem } from '@/lib/engine/types';

type ProductColumn = 'sku' | 'size' | 'qty' | 'color' | 'orderNo';
type InvoiceColumn = 'purchaseOrderNo';

const PRODUCT_COLUMNS: { key: ProductColumn; match: RegExp }[] = [
	{ key: 'sku', match: /^SKU$/i },
	{ key: 'size', match: /^Size$/i },
	{ key: 'qty', match: /^Qty$/i },
	{ key: 'color', match: /^Color$/i },
	{ key: 'orderNo', match: /^Order No\.?$/i },
];

const INVOICE_COLUMNS: { key: InvoiceColumn; match: RegExp }[] = [
	{ key: 'purchaseOrderNo', match: /^Purchase Order No\.?$/i },
];

function findItem(items: TextItem[], pattern: RegExp): TextItem | null {
	return items.find((item) => pattern.test(item.text.trim())) ?? null;
}

function extractPaymentMode(items: TextItem[]): PaymentMode | null {
	if (findItem(items, /^COD\s*:/i)) return 'COD';
	if (findItem(items, /^Prepaid\s*:/i)) return 'Prepaid';
	return null;
}

/** The courier name is always printed directly above the "Pickup" badge, in the same column — this holds
 * regardless of which courier (Delhivery, Ekart, Valmo, Xpressbees, ...) or exact font size is used, so we
 * anchor on the "Pickup" badge's position rather than matching specific courier names. */
function extractCourier(items: TextItem[]): string | null {
	const pickupItem = findItem(items, /^Pickup$/i);
	if (!pickupItem) return null;

	const candidates = items.filter(
		(item) => item.y > pickupItem.y && Math.abs(item.x - pickupItem.x) <= 40,
	);
	if (candidates.length === 0) return null;

	candidates.sort((a, b) => a.y - b.y);
	return candidates[0].text.trim();
}

/** The AWB/tracking number is a bare run of digits (no separators) printed above the barcode, in the label
 * region. The one other bare-digit run on the page — the Purchase Order No. — lives below the label/invoice
 * boundary, so restricting the search to items above `labelRegionMinY` is enough to disambiguate the two
 * without needing to know anything about barcode/QR image positions. */
function extractAwb(items: TextItem[], labelRegionMinY: number): string | null {
	const candidates = items.filter(
		(item) => item.y >= labelRegionMinY && /^\d{12,20}$/.test(item.text.trim()),
	);
	if (candidates.length === 0) return null;

	candidates.sort((a, b) => {
		const lengthDiff = b.text.trim().length - a.text.trim().length;
		return lengthDiff !== 0 ? lengthDiff : a.y - b.y;
	});
	return candidates[0].text.trim();
}

/** The destination/pickup hub code sometimes wraps across two or more lines when long (e.g.
 * "Naihati_Rajendrapu" / "r_DPP" / "(West" / "Bengal)"). Joining the wrapped runs with no separator and then
 * stripping the trailing "(State)" parenthetical reconstructs the code correctly in both the single-line and
 * wrapped cases. */
function extractDestinationCode(items: TextItem[]): string | null {
	const startItem = findItem(items, /^Destination Code$/i);
	const endItem = findItem(items, /^Return Code$/i);
	if (!startItem || !endItem) return null;

	const between = items
		.filter(
			(item) =>
				item.y < startItem.y && item.y > endItem.y && Math.abs(item.x - startItem.x) <= 40,
		)
		.sort((a, b) => b.y - a.y);
	if (between.length === 0) return null;

	const joined = between.map((item) => item.text.trim()).join('');
	const stripped = joined.replace(/\([^)]*\)\s*$/, '').trim();
	return stripped || null;
}

function parseQty(raw: string | null): number | null {
	if (!raw) return null;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) ? n : null;
}

/** Extracts every normalized field this platform can recognize from one label page's text. Every field is
 * independently best-effort — a page missing or reordering one block still yields metadata for everything
 * else that matched, rather than failing outright (an unrecognized page falls back to `null`s and the
 * caller sorts it as "original order" per the plan's non-blocking-warning error handling). */
export function extractMeeshoMetadata(page: PageTextModel, splitY: number | null): OrderMetadata {
	const items = page.items;
	const labelRegionMinY = splitY ?? 0;

	const productRow = parseHeaderDataRow(items, PRODUCT_COLUMNS);
	const invoiceRow = parseHeaderDataRow(
		items.filter((item) => splitY === null || item.y < splitY),
		INVOICE_COLUMNS,
	);

	const orderNo = productRow?.values.orderNo ?? null;
	const purchaseOrderNoFromInvoice = invoiceRow?.values.purchaseOrderNo ?? null;
	// Fallback: on every sample seen so far the Purchase Order No. is exactly the Order No. with its
	// trailing "_N" sub-order suffix removed. Only used when the invoice section itself couldn't be parsed.
	const purchaseOrderNoFallback = orderNo ? (orderNo.match(/^(\d+)_\d+$/)?.[1] ?? null) : null;

	return {
		sku: productRow?.values.sku ?? null,
		size: productRow?.values.size ?? null,
		qty: parseQty(productRow?.values.qty ?? null),
		color: productRow?.values.color ?? null,
		orderNo,
		purchaseOrderNo: purchaseOrderNoFromInvoice ?? purchaseOrderNoFallback,
		awb: extractAwb(items, labelRegionMinY),
		courier: extractCourier(items),
		paymentMode: extractPaymentMode(items),
		destinationCode: extractDestinationCode(items),
	};
}
