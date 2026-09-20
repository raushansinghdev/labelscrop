import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Regression cover for the P&L calculation layer ported from the standalone dashboard.
 *
 * The fixture is a real Meesho payment file containing live business data, so it is NOT
 * committed. Point PNL_FIXTURE at a payment file to run these, otherwise they skip — that
 * keeps CI green while still catching arithmetic drift locally.
 */
const FIXTURE =
	process.env.PNL_FIXTURE ??
	path.resolve(
		import.meta.dirname,
		'../../../Meesho pnl/4497632_SP_ORDER_ADS_REFERRAL_PAYMENT_FILE_PREVIOUS_PAYMENT_2026-08-01_2026-08-31.xlsx',
	);

const hasFixture = existsSync(FIXTURE);

describe.skipIf(!hasFixture)('computePnl against a real payment file', () => {
	let result: any;

	beforeAll(async () => {
		// SKU costs live in localStorage in the browser; an empty stub models a first-time
		// visitor who has not entered any costs yet.
		const store = new Map<string, string>();
		(globalThis as any).localStorage = {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => store.set(k, String(v)),
			removeItem: (k: string) => store.delete(k),
		};

		const XLSX = await import('xlsx');
		const workbook = XLSX.read(readFileSync(FIXTURE), { type: 'buffer', cellDates: true });

		// readExcelFile would normally prime this; in Node the workbook is read directly.
		const parser = await import('@/lib/pnl/parser.js');
		await parser.ensureXlsx();

		const { computePnl } = await import('@/lib/pnl/calculator.js');
		result = await computePnl(workbook, null, { rto: 0, return_rate: 1, lost: 1, unresolved: 0 });
	});

	it('resolves multi-leg settlements to one row per sub-order', async () => {
		// The whole point of the original build: Meesho splits some orders across two rows,
		// the second carrying a blank status. Those must collapse to one order, not two, and
		// the blank-status leg's amount must still be counted.
		const XLSX = await import('xlsx');
		const workbook = XLSX.read(readFileSync(FIXTURE), { type: 'buffer', cellDates: true });
		const { parseOrderPayments } = await import('@/lib/pnl/parser.js');
		const rawRows = parseOrderPayments(workbook);

		const distinctSubOrders = new Set(rawRows.map((r: any) => r['Sub Order No'])).size;

		expect(result.overall.total_orders).toBe(distinctSubOrders);
		// If nothing collapsed, this file wouldn't exercise the behaviour at all.
		expect(rawRows.length).toBeGreaterThan(distinctSubOrders);

		// Settlement is summed over every leg, including the blank-status ones.
		const rawSettlement = rawRows.reduce((sum: number, r: any) => sum + r['Final Settlement Amount'], 0);
		expect(result.overall.net_settlement).toBeCloseTo(rawSettlement, 1);
	});

	it('reports a payment window matching the file', () => {
		expect(result.overall.payment_window_start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(result.overall.payment_window_end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('subtracts ads spend from net profit', () => {
		// Ads cost arrives already negative in the source file, so net profit must sit at or
		// below gross profit. Getting this backwards was the bug in a competing tool.
		expect(result.overall.ads_cost).toBeLessThanOrEqual(0);
		expect(result.overall.net_profit).toBeLessThanOrEqual(result.overall.gross_profit);
	});

	it('flags SKUs with no cost recorded', () => {
		// With an empty cost store every SKU should come back unmapped.
		expect(result.unmapped_skus.length).toBe(result.sku_rows.length);
	});

	it('recomputes lower profit once SKU costs are recorded', async () => {
		// Mirrors what CostEditor does: write a cost through skuCosts, then re-run the P&L
		// against the same workbook. Profit must fall and the SKU must stop being unmapped.
		const XLSX = await import('xlsx');
		const workbook = XLSX.read(readFileSync(FIXTURE), { type: 'buffer', cellDates: true });
		const { updateSingleSku } = await import('@/lib/pnl/skuCosts.js');
		const { computePnl } = await import('@/lib/pnl/calculator.js');

		const target = result.sku_rows[0];
		updateSingleSku(target.sku, 40, 10);

		const after = await computePnl(workbook, null, { rto: 0, return_rate: 1, lost: 1, unresolved: 0 });
		const updatedRow = after.sku_rows.find((r: any) => r.sku === target.sku);

		expect(updatedRow.cost_mapped).toBe(true);
		expect(updatedRow.profit).toBeLessThan(target.profit);
		expect(after.unmapped_skus.length).toBe(result.unmapped_skus.length - 1);

		// Leave the store as the other tests expect to find it.
		const { loadCosts, saveCosts } = await import('@/lib/pnl/skuCosts.js');
		const costs = loadCosts() as Record<string, unknown>;
		delete costs[target.sku];
		saveCosts(costs);
	});

	it('combines several payment files into one P&L', async () => {
		// Sellers get one file per payment cycle, so a quarter means three files. Passing the
		// same file twice is the sharpest version of the test: orders are keyed by sub-order
		// number, so the order count must NOT double, while account-level ads spend — which is
		// a per-file total with no key to merge on — must.
		const XLSX = await import('xlsx');
		const bytes = readFileSync(FIXTURE);
		const a = XLSX.read(bytes, { type: 'buffer', cellDates: true });
		const b = XLSX.read(bytes, { type: 'buffer', cellDates: true });

		const { computePnl } = await import('@/lib/pnl/calculator.js');
		const combined = await computePnl([a, b], null, {
			rto: 0,
			return_rate: 1,
			lost: 1,
			unresolved: 0,
		});

		expect(combined.overall.total_orders).toBe(result.overall.total_orders);
		expect(combined.overall.ads_cost).toBeCloseTo(result.overall.ads_cost * 2, 1);
		// Settlement is summed per sub-order, so duplicated legs do add up.
		expect(combined.overall.net_settlement).toBeCloseTo(result.overall.net_settlement * 2, 1);
	});

	it('treats a single workbook and a one-item array the same', async () => {
		const XLSX = await import('xlsx');
		const workbook = XLSX.read(readFileSync(FIXTURE), { type: 'buffer', cellDates: true });
		const { computePnl } = await import('@/lib/pnl/calculator.js');
		const rates = { rto: 0, return_rate: 1, lost: 1, unresolved: 0 };

		const single = await computePnl(workbook, null, rates);
		const wrapped = await computePnl([workbook], null, rates);

		expect(wrapped.overall).toEqual(single.overall);
	});

	it('produces a status breakdown covering every order', () => {
		// Every resolved order lands in exactly one status bucket, blank-status ones included,
		// so the buckets must account for the full order count with no leakage.
		const counted = result.status_breakdown.reduce((sum: number, s: any) => sum + s.order_count, 0);
		expect(counted).toBe(result.overall.total_orders);

		const pct = result.status_breakdown.reduce((sum: number, s: any) => sum + s.percentage, 0);
		expect(pct).toBeCloseTo(100, 1);
	});
});
