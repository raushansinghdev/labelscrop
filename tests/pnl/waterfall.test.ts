import { describe, expect, it } from 'vitest';
import { buildWaterfall, niceAxis } from '@/components/pnl/charts/waterfall';
import type { PnlOverall } from '@/components/pnl/types';

/**
 * The waterfall is the one chart that can lie convincingly: if the steps don't add up, it still
 * renders a tidy bridge, just one that lands somewhere other than the real net profit. These
 * tests pin the arithmetic so that can't happen silently.
 */

/** A seller who sold ₹1,00,000, kept most of it, lost some to returns, and spent on ads. */
function overall(patch: Partial<PnlOverall> = {}): PnlOverall {
	const base: PnlOverall = {
		net_settlement: 100000,
		cogs: 42000,
		cogs_making: 30000,
		cogs_packaging: 12000,
		cogs_making_lost: 4000,
		cogs_packaging_lost: 2000,
		making_loss_rto: 1500,
		making_loss_return: 2500,
		packaging_loss_rto: 800,
		packaging_loss_return: 1200,
		return_shipping_charge: -3000,
		gross_profit: 58000,
		ads_cost: -8000,
		referral_income: 1200,
		compensation_recovery: 800,
		net_profit: 52000,
		payment_window_start: '2026-08-01',
		payment_window_end: '2026-08-31',
		total_orders: 500,
		total_units: 540,
	};
	const merged = { ...base, ...patch };
	// Keep the fixture internally consistent unless a test overrides net_profit on purpose.
	if (!('net_profit' in patch)) {
		merged.net_profit =
			merged.net_settlement -
			merged.cogs +
			merged.ads_cost +
			merged.referral_income +
			merged.compensation_recovery;
	}
	return merged;
}

describe('buildWaterfall', () => {
	it('bridges from settlement to net profit with no gap', () => {
		const data = buildWaterfall(overall());
		const steps = data.slice(0, -1);
		const total = data[data.length - 1];

		const bridged = steps.reduce((sum, step) => sum + step.delta, 0);
		expect(bridged).toBeCloseTo(total.delta, 6);
	});

	it('splits COGS so the four cost steps sum to total COGS', () => {
		// The four cost bars are carved out of `cogs`; if they don't re-add to it, the chart is
		// double-counting or dropping part of what the KPI cards report.
		const o = overall();
		const data = buildWaterfall(o);
		const costSteps = ['Cost of goods', 'Packaging', 'Packaging lost', 'Stock lost'];
		const charged = data
			.filter((d) => costSteps.includes(d.name))
			.reduce((sum, d) => sum + Math.abs(d.delta), 0);

		expect(charged).toBeCloseTo(o.cogs, 6);
	});

	it('floats each bar between the running totals either side of it', () => {
		// This is the bug that shipped once already: when the span didn't track the running
		// total, every step was drawn down to zero and each cost looked the size of the payout.
		const data = buildWaterfall(overall());
		let running = 0;
		for (const bar of data.slice(0, -1)) {
			expect(bar.range[0]).toBeCloseTo(running, 6);
			expect(bar.range[1]).toBeCloseTo(running + bar.delta, 6);
			running += bar.delta;
		}
	});

	it('never lets a mid-chart bar touch zero unless the flow really passes through it', () => {
		// The visible symptom of the old bug: a cost bar spanning the full height of the chart.
		const data = buildWaterfall(overall());
		for (const bar of data.slice(1, -1)) {
			const [from, to] = bar.range;
			expect(Math.abs(to - from)).toBeCloseTo(Math.abs(bar.delta), 6);
			// Every step here happens while the running total is well above zero.
			expect(Math.min(from, to)).toBeGreaterThan(0);
		}
	});

	it('draws the closing bar from zero, not from the running total', () => {
		const total = buildWaterfall(overall()).at(-1)!;
		expect(total.range[0]).toBe(0);
		expect(total.range[1]).toBeCloseTo(total.delta, 6);
	});

	it('hangs the closing bar below zero when the month lost money', () => {
		const o = overall({ net_settlement: 20000 });
		expect(o.net_profit).toBeLessThan(0);

		const total = buildWaterfall(o).at(-1)!;
		expect(total.range).toEqual([0, o.net_profit]);
		expect(total.className).toBe('fill-chart-3');
	});

	it('closes the last step exactly on the net profit bar', () => {
		// The bridge and the total are computed independently; if they disagree the chart shows
		// a step that stops short of the bar it is supposed to land on.
		const data = buildWaterfall(overall());
		const lastStep = data.at(-2)!;
		const total = data.at(-1)!;
		expect(lastStep.range[1]).toBeCloseTo(total.range[1], 6);
	});

	it('colours the opening bar neutrally and the rest by direction', () => {
		const data = buildWaterfall(overall());
		expect(data[0].className).toBe('fill-chart-1');

		for (const bar of data.slice(1, -1)) {
			expect(bar.className).toBe(bar.delta >= 0 ? 'fill-chart-2' : 'fill-chart-3');
		}
	});

	it('still reconciles when nothing was returned', () => {
		// A clean month zeroes the two loss steps; the bridge must still land on net profit
		// rather than leaving a gap where those bars were.
		const o = overall({
			cogs_making_lost: 0,
			cogs_packaging_lost: 0,
			making_loss_rto: 0,
			making_loss_return: 0,
			packaging_loss_rto: 0,
			packaging_loss_return: 0,
			return_shipping_charge: 0,
		});
		const data = buildWaterfall(o);
		const bridged = data.slice(0, -1).reduce((sum, step) => sum + step.delta, 0);

		expect(bridged).toBeCloseTo(o.net_profit, 6);
		expect(data.find((d) => d.name === 'Stock lost')?.delta).toBe(-0);
	});

	it('reconciles when no SKU costs have been entered at all', () => {
		// First-time visitors see this: every cost bar is zero and the bridge is settlement → ads.
		const o = overall({
			cogs: 0,
			cogs_making: 0,
			cogs_packaging: 0,
			cogs_making_lost: 0,
			cogs_packaging_lost: 0,
			making_loss_rto: 0,
			making_loss_return: 0,
			packaging_loss_rto: 0,
			packaging_loss_return: 0,
		});
		const data = buildWaterfall(o);
		const bridged = data.slice(0, -1).reduce((sum, step) => sum + step.delta, 0);

		expect(bridged).toBeCloseTo(o.net_profit, 6);
	});
});

describe('niceAxis', () => {
	it('rounds outwards so the axis lands on round numbers', () => {
		// A real file: settlement of 71,060 down to a net loss of 34,808 once expenses are in.
		const { domain, ticks } = niceAxis(-34808, 71060);
		expect(domain).toEqual([-50000, 75000]);
		expect(ticks).toEqual([-50000, -25000, 0, 25000, 50000, 75000]);
	});

	it('never crops the data it was given', () => {
		for (const [min, max] of [
			[-13595, 71060],
			[0, 940],
			[-7, 3],
			[-250000, 1250000],
		]) {
			const { domain } = niceAxis(min, max);
			expect(domain[0]).toBeLessThanOrEqual(min);
			expect(domain[1]).toBeGreaterThanOrEqual(max);
		}
	});

	it('puts a tick at each end and nothing beyond them', () => {
		const { domain, ticks } = niceAxis(-13595, 71060);
		expect(ticks[0]).toBe(domain[0]);
		expect(ticks[ticks.length - 1]).toBe(domain[1]);
	});

	it('survives a flat domain', () => {
		// Every bar zero — an empty file. The log of a zero span would otherwise be -Infinity.
		const { domain } = niceAxis(0, 0);
		expect(Number.isFinite(domain[0])).toBe(true);
		expect(Number.isFinite(domain[1])).toBe(true);
	});
});
