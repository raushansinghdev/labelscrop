import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Two payment files that share days — or the same file added twice — must not count the shared
 * payments twice. Before this was covered, adding "file.xlsx" and "file 2.xlsx" doubled the
 * settlement, the ads spend and the profit, with nothing on screen to say so.
 *
 * Synthetic workbooks laid out the way Meesho's are (title row, header row, legend row, data), so
 * this runs in CI without a real payment file.
 */

let calc: typeof import('@/lib/pnl/calculator.js');
let parser: typeof import('@/lib/pnl/parser.js');
let XLSX: typeof import('xlsx');

const HEADERS = [
	'Sub Order No',
	'Order Date',
	'Supplier SKU',
	'Live Order Status',
	'Product Name',
	'Quantity',
	'Total Sale Amount (Incl. Shipping & GST)',
	'Payment Date',
	'Final Settlement Amount',
	'Return Shipping Charge (Incl. GST)',
];

type Leg = [order: string, sku: string, status: string, paid: string, settlement: number];

function paymentFile(legs: Leg[], ads: number[] = []) {
	const book = XLSX.utils.book_new();
	const rows = legs.map(([order, sku, status, paid, settlement]) => [
		order,
		new Date('2026-08-01'),
		sku,
		status,
		`Product ${sku}`,
		1,
		settlement + 50,
		new Date(paid),
		settlement,
		0,
	]);
	XLSX.utils.book_append_sheet(
		book,
		XLSX.utils.aoa_to_sheet([['Order Payments'], HEADERS, HEADERS.map(() => 'legend'), ...rows]),
		'Order Payments',
	);
	const adsHeaders = ['Deduction Duration', 'Total Ads Cost'];
	XLSX.utils.book_append_sheet(
		book,
		XLSX.utils.aoa_to_sheet([['Ads Cost'], adsHeaders, ['legend', 'legend'], ...ads.map((a, i) => [`day ${i}`, a])]),
		'Ads Cost',
	);
	return book;
}

const RATES = {
	rto: 0,
	return_rate: 1,
	lost: 1,
	unresolved: 0,
	rto_packaging_loss: 1,
	return_packaging_loss: 1,
};

describe('combining payment files', () => {
	beforeAll(async () => {
		const store = new Map<string, string>();
		(globalThis as any).localStorage = {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => store.set(k, String(v)),
			removeItem: (k: string) => store.delete(k),
		};
		XLSX = await import('xlsx');
		parser = await import('@/lib/pnl/parser.js');
		await parser.ensureXlsx();
		calc = await import('@/lib/pnl/calculator.js');
	});

	it('counts the same file added twice once', async () => {
		const file = paymentFile(
			[
				['A1', 'SKU1', 'Delivered', '2026-08-10', 200],
				['A2', 'SKU2', 'Delivered', '2026-08-11', 300],
			],
			[-40],
		);
		const once = await calc.computePnl([file], null, RATES);
		const twice = await calc.computePnl([file, file], null, RATES);
		expect(twice.overall.net_settlement).toBe(500);
		expect(twice.overall.ads_cost).toBe(-40);
		expect(twice.overall).toEqual(once.overall);
	});

	it('counts only the shared days once when windows overlap', async () => {
		const august = paymentFile([
			['A1', 'SKU1', 'Delivered', '2026-08-10', 200],
			['A2', 'SKU1', 'Delivered', '2026-08-20', 300],
		]);
		const lateAugust = paymentFile([
			['A2', 'SKU1', 'Delivered', '2026-08-20', 300],
			['A3', 'SKU1', 'Delivered', '2026-09-02', 150],
		]);
		const result = await calc.computePnl([august, lateAugust], null, RATES);
		expect(result.overall.net_settlement).toBe(650);
		expect(result.overall.total_orders).toBe(3);
	});

	it('keeps a leg repeated within one file — Meesho does pay identical legs', async () => {
		const file = paymentFile([
			['A1', 'SKU1', 'Delivered', '2026-08-10', 100],
			['A1', 'SKU1', 'Delivered', '2026-08-10', 100],
		]);
		const result = await calc.computePnl([file, file], null, RATES);
		expect(result.overall.net_settlement).toBe(200);
	});

	it('recognises a leg whose status changed between downloads, and keeps the newer status', async () => {
		const early = paymentFile([['A1', 'SKU1', 'Shipped', '2026-08-10', 200]]);
		const later = paymentFile([['A1', 'SKU1', 'RTO', '2026-08-10', 200]]);
		const result = await calc.computePnl([early, later], null, RATES);
		expect(result.overall.net_settlement).toBe(200);
		expect(result.status_breakdown.map((s: { status: string }) => s.status)).toEqual(['rto']);
	});
});

describe('toAmount', () => {
	beforeAll(async () => {
		parser = await import('@/lib/pnl/parser.js');
	});

	it.each([
		[150, 150],
		['150', 150],
		['₹150', 150],
		['₹ 1,250.50', 1250.5],
		['Rs. 99', 99],
		['-12', -12],
		['', 0],
		[null, 0],
		['n/a', 0],
	])('%s → %s', (input, expected) => {
		expect(parser.toAmount(input)).toBe(expected);
	});
});

/**
 * Meesho writes dates as text. Read as the calendar day they spell wherever the browser is — run
 * the suite with TZ=America/Los_Angeles to see the UTC-midnight version land on the day before.
 */
describe('payment-file dates', () => {
	let format: typeof import('@/components/pnl/format');

	beforeAll(async () => {
		parser = await import('@/lib/pnl/parser.js');
		format = await import('@/components/pnl/format');
	});

	it('reads a date-only string as that local day', () => {
		const date = parser.toDate('2026-09-18') as Date;
		expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 8, 18]);
	});

	it('reads the "date time" form older Safari rejects', () => {
		const date = parser.toDate('2026-08-09 01:52:53') as Date;
		expect([date.getDate(), date.getHours(), date.getMinutes()]).toEqual([9, 1, 52]);
	});

	it('passes Date cells through and treats blanks and junk as missing', () => {
		const cell = new Date(2026, 0, 5);
		expect(parser.toDate(cell)).toBe(cell);
		expect(parser.toDate('')).toBeNull();
		expect(parser.toDate(null)).toBeNull();
		expect(parser.toDate('not a date')).toBeNull();
	});

	it('formats the payment window on the days it names', () => {
		expect(format.formatDateRange('2026-08-20', '2026-09-18')).toMatch(/^20 Aug 2026 – 18 Sept? 2026$/);
	});
});
