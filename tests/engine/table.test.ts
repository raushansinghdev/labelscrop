import { describe, expect, it } from 'vitest';
import { parseHeaderDataRow } from '@/lib/engine/table';
import type { TextItem } from '@/lib/engine/types';

function item(text: string, x: number, y: number): TextItem {
	return { text, x, y };
}

type Col = 'sku' | 'size' | 'qty' | 'color' | 'orderNo';
const PRODUCT_COLUMNS: { key: Col; match: RegExp }[] = [
	{ key: 'sku', match: /^SKU$/i },
	{ key: 'size', match: /^Size$/i },
	{ key: 'qty', match: /^Qty$/i },
	{ key: 'color', match: /^Color$/i },
	{ key: 'orderNo', match: /^Order No\.?$/i },
];

describe('parseHeaderDataRow', () => {
	it('parses a clean header + data row, matching columns by x-position', () => {
		const items: TextItem[] = [
			item('SKU', 19, 517.4),
			item('Size', 203, 517.4),
			item('Qty', 297.5, 517.4),
			item('Color', 344.8, 517.4),
			item('Order No.', 439.3, 517.4),
			item('SKU-A', 19, 500.9),
			item('Free Size', 203, 500.9),
			item('1', 297.5, 500.9),
			item('Yellow', 344.8, 500.9),
			item('100000000000000001_1', 439.3, 500.9),
		];

		const result = parseHeaderDataRow(items, PRODUCT_COLUMNS);

		expect(result).not.toBeNull();
		expect(result?.values).toEqual({
			sku: 'SKU-A',
			size: 'Free Size',
			qty: '1',
			color: 'Yellow',
			orderNo: '100000000000000001_1',
		});
	});

	it('returns null when the header row is entirely absent', () => {
		const items: TextItem[] = [item('Unrelated content', 19, 500)];
		expect(parseHeaderDataRow(items, PRODUCT_COLUMNS)).toBeNull();
	});

	it('ignores an unrelated block in a different column even when it sits between the header and true data row', () => {
		// Regression test: on the real Meesho template, a longer customer address can wrap onto an extra
		// line that lands, purely by y-coordinate, between the Purchase-Order-table header and its actual
		// data row. Without x-clustering, "next line below the header" would wrongly grab that address line.
		type InvCol = 'purchaseOrderNo';
		const invoiceColumns: { key: InvCol; match: RegExp }[] = [
			{ key: 'purchaseOrderNo', match: /^Purchase Order No\.?$/i },
		];
		const items: TextItem[] = [
			// Unrelated left-column block, including an extra wrapped line at y=412 — between the header (419.7)
			// and the real data row (407.7) — but far away in x from the table's own column.
			item('Some Customer Name - address line one,', 18, 448.6),
			item('address line two,', 18, 436.6),
			item('address line three, an extra wrapped line', 18, 412),
			// The actual table.
			item('Purchase Order No.', 227.7, 419.7),
			item('100000000000000001', 227.7, 407.7),
		];

		const result = parseHeaderDataRow(items, invoiceColumns);
		expect(result?.values.purchaseOrderNo).toBe('100000000000000001');
	});

	it('resolves missing individual columns to null rather than failing the whole row', () => {
		const items: TextItem[] = [
			item('SKU', 19, 517.4),
			item('Order No.', 439.3, 517.4),
			item('SKU-A', 19, 500.9),
			item('100000000000000001_1', 439.3, 500.9),
		];

		const result = parseHeaderDataRow(items, PRODUCT_COLUMNS);
		expect(result?.values.sku).toBe('SKU-A');
		expect(result?.values.orderNo).toBe('100000000000000001_1');
		expect(result?.values.size).toBeNull();
		expect(result?.values.qty).toBeNull();
		expect(result?.values.color).toBeNull();
	});
});
