import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SkuCostMap } from '@/components/pnl/types';

/**
 * The cost sheet is the only file this tool writes as well as reads, and it is the seller's
 * backup: if it doesn't round-trip, someone re-enters a hundred SKUs by hand. The column headers
 * carry a ₹ symbol, which is exactly the kind of thing that survives export and dies on import.
 */

let parser: typeof import('@/lib/pnl/parser.js');
let skuCosts: typeof import('@/lib/pnl/skuCosts.js');

/**
 * Writes a workbook to bytes and reads it back, the way a download-then-upload would.
 *
 * The pnl layer is untyped JavaScript, so the cast is what tells TypeScript the shape the app
 * relies on — if the parser stops returning it, the app breaks, not this test.
 */
async function roundTrip(costs: SkuCostMap): Promise<SkuCostMap> {
	const workbook = await parser.generateCostsExcel(costs);
	const XLSX = await import('xlsx');
	const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
	return parser.parseCostsExcel(XLSX.read(bytes, { type: 'array' })) as SkuCostMap;
}

describe('SKU cost spreadsheet', () => {
	beforeAll(async () => {
		const store = new Map<string, string>();
		(globalThis as any).localStorage = {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => store.set(k, String(v)),
			removeItem: (k: string) => store.delete(k),
		};
		parser = await import('@/lib/pnl/parser.js');
		skuCosts = await import('@/lib/pnl/skuCosts.js');
		await parser.ensureXlsx();
	});

	beforeEach(() => {
		skuCosts.saveCosts({});
	});

	it('round-trips costs through an exported file unchanged', async () => {
		const costs = {
			'KURTI-RED-M': { making_cost: 180.5, packaging_cost: 12.25 },
			'SAREE-BLUE-XL': { making_cost: 640, packaging_cost: 30 },
		};

		expect(await roundTrip(costs)).toEqual(costs);
	});

	it('keeps SKUs whose codes look like numbers or dates', async () => {
		// Spreadsheet software loves reinterpreting these; a SKU of "10-12" must not come back
		// as a date, and a purely numeric one must not lose leading zeros.
		const costs = {
			'10-12': { making_cost: 50, packaging_cost: 5 },
			'007': { making_cost: 60, packaging_cost: 6 },
		};

		const parsed = await roundTrip(costs);
		expect(Object.keys(parsed).sort()).toEqual(['007', '10-12']);
	});

	it('exports a usable template when nothing has been entered yet', async () => {
		// An empty export would be a sheet with no headers, which is useless as a template and
		// would fail on re-import.
		const parsed = await roundTrip({});
		expect(Object.keys(parsed).length).toBeGreaterThan(0);
	});

	it('reads back zero costs as zero rather than dropping the SKU', async () => {
		// Exporting every SKU with 0 is how the template works, so 0 has to survive the trip —
		// dropping those rows would silently shrink the sheet each time it was re-exported.
		const parsed = await roundTrip({ 'BLANK-SKU': { making_cost: 0, packaging_cost: 0 } });
		expect(parsed['BLANK-SKU']).toEqual({ making_cost: 0, packaging_cost: 0 });
	});

	it('rejects a spreadsheet that is not a cost sheet', async () => {
		// Sellers will pick the wrong file; importing a payment file must yield nothing rather
		// than inventing SKUs from whatever columns happen to be there.
		const XLSX = await import('xlsx');
		const sheet = XLSX.utils.json_to_sheet([{ 'Sub Order No': 'ABC_1', 'Final Settlement Amount': 250 }]);
		const book = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');

		expect(parser.parseCostsExcel(book)).toEqual({});
	});

	it('merges an imported sheet into saved costs instead of replacing them', async () => {
		// Mirrors what CostEditor.importFromExcel does. A seller importing a sheet covering one
		// product line must not lose the costs for every other line.
		skuCosts.saveCosts({
			EXISTING: { making_cost: 100, packaging_cost: 10 },
			SHARED: { making_cost: 1, packaging_cost: 1 },
		});

		const imported = await roundTrip({ SHARED: { making_cost: 55, packaging_cost: 5 } });
		skuCosts.saveCosts({ ...(skuCosts.loadCosts() as SkuCostMap), ...imported });

		const after = skuCosts.loadCosts() as SkuCostMap;
		expect(after.EXISTING).toEqual({ making_cost: 100, packaging_cost: 10 });
		expect(after.SHARED).toEqual({ making_cost: 55, packaging_cost: 5 });
	});
});
