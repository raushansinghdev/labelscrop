import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { DEFAULT_EXPENSES } from '@/components/pnl/expenses';
import { buildProfitReportPdf } from '@/lib/pnl/report/profitReport';
import type { PnlOverall, PnlResult, SkuRow } from '@/components/pnl/types';

function overall(patch: Partial<PnlOverall> = {}): PnlOverall {
	return {
		net_settlement: 128952,
		cogs: 79020,
		cogs_making: 61030,
		cogs_packaging: 17990,
		cogs_making_lost: 6100,
		cogs_packaging_lost: 2595,
		making_loss_rto: 3000,
		making_loss_return: 3100,
		packaging_loss_rto: 1300,
		packaging_loss_return: 1295,
		return_shipping_charge: -15236,
		gross_profit: 49932,
		ads_cost: -5763,
		referral_income: 0,
		compensation_recovery: 0,
		net_profit: 44169,
		payment_window_start: '2026-08-01',
		payment_window_end: '2026-08-31',
		total_orders: 1336,
		total_units: 1337,
		...patch,
	};
}

function sku(patch: Partial<SkuRow> = {}): SkuRow {
	return {
		sku: 'eyes_50',
		product_name: '6mm Safety Eyes for Crochet',
		orders: 243,
		units: 243,
		delivered_orders: 210,
		rto_orders: 20,
		return_orders: 13,
		gross_sale_amount: 24000,
		net_settlement: 21000,
		cogs: 10130,
		cogs_making: 8000,
		cogs_packaging: 2130,
		rto_cost: 400,
		profit: 10870,
		margin_pct: 51.8,
		avg_sale_price: 98,
		cost_mapped: true,
		...patch,
	};
}

function result(patch: Partial<PnlResult> = {}): PnlResult {
	return {
		overall: overall(),
		sku_rows: [sku(), sku({ sku: 'KC_CHK_02', profit: -772, margin_pct: -8.3, cost_mapped: false })],
		status_breakdown: [
			{ status: 'delivered', order_count: 1095, total_settlement: 120000, percentage: 82 },
			{ status: 'rto', order_count: 160, total_settlement: 5000, percentage: 12 },
			{ status: 'return', order_count: 81, total_settlement: 3952, percentage: 6 },
		],
		unmapped_skus: [{ sku: 'KC_CHK_02', order_count: 9, settlement_amount: 800 }],
		pending_orders: null,
		review_orders: [],
		loss_rates: { rto: 0, return_rate: 1, lost: 1, unresolved: 0, rto_packaging_loss: 1, return_packaging_loss: 1 },
		...patch,
	};
}

const input = {
	overheads: 3500,
	expenses: DEFAULT_EXPENSES.map((row) => (row.id === 'rent' ? { ...row, monthly: 3600 } : row)),
	expenseDays: 31,
	fileNames: ['payment.xlsx'],
	generatedAt: new Date('2026-09-20T00:00:00Z'),
};

describe('buildProfitReportPdf', () => {
	it('produces a readable PDF with the overview on its own first page', async () => {
		const bytes = await buildProfitReportPdf({ result: result(), ...input });
		const doc = await PDFDocument.load(bytes);

		expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
		const [width, height] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
		// A4, which is what a seller's printer expects.
		expect(Math.round(width)).toBe(595);
		expect(Math.round(height)).toBe(842);
	});

	/**
	 * The built-in fonts encode WinAnsi and throw on anything outside it. Product names are the
	 * seller's own free text, so emoji and Devanagari do turn up — and one of them must not be
	 * able to stop the whole download.
	 */
	it('survives product names the font cannot encode', async () => {
		const rows = [
			sku({ sku: 'HB_MIX_02', product_name: 'Crochet Hair Band ★ Pack of 2 💐' }),
			sku({ sku: 'देसी_01', product_name: 'क्रोशिया फूल' }),
		];
		await expect(buildProfitReportPdf({ result: result({ sku_rows: rows }), ...input })).resolves.toBeInstanceOf(
			Uint8Array,
		);
	});

	/**
	 * A long catalogue used to draw its continuation on top of the page it had just filled: the
	 * table restarted its heading at the top of the same sheet, and the assumptions landed on top
	 * of the rows. Forty-five rows is about what one page holds, so a page per forty-five is the
	 * cheap way to assert that each continuation actually got a sheet of its own.
	 */
	it('gives a long product table a page per continuation', async () => {
		const rows = Array.from({ length: 200 }, (_, i) => sku({ sku: `SKU_${i}`, profit: 5000 - i }));
		const bytes = await buildProfitReportPdf({ result: result({ sku_rows: rows }), ...input });
		const doc = await PDFDocument.load(bytes);

		expect(doc.getPageCount()).toBeGreaterThanOrEqual(1 + Math.ceil(rows.length / 45));
	});

	it('handles a loss-making month and an empty file without throwing', async () => {
		const loss = result({ overall: overall({ net_profit: -8000 }) });
		await expect(buildProfitReportPdf({ result: loss, ...input })).resolves.toBeInstanceOf(Uint8Array);

		const empty = result({ sku_rows: [], status_breakdown: [], unmapped_skus: [] });
		await expect(
			buildProfitReportPdf({ result: empty, ...input, overheads: 0, expenses: DEFAULT_EXPENSES }),
		).resolves.toBeInstanceOf(Uint8Array);
	});
});
