import { formatCurrency } from '../format';
import type { PnlOverall } from '../types';

export interface WaterfallBar {
	name: string;
	/** Signed: positive adds to the running total, negative subtracts. */
	delta: number;
	detail?: string;
	/**
	 * `[from, to]` on the value axis — recharts draws a floating bar between them.
	 *
	 * The earlier version stacked a transparent spacer bar under a visible one to fake this.
	 * That broke: recharts painted the spacer with the visible bar's colour, so every step ran
	 * down to zero and the chart read as though each cost were the size of the whole payout.
	 */
	range: [number, number];
	/**
	 * A Tailwind fill utility rather than a colour string. SVG presentation attributes don't
	 * resolve `var()` reliably across browsers, so the colour has to arrive as a real CSS rule.
	 */
	className: string;
}

/**
 * Turns the overall P&L into stacked bar geometry for the waterfall.
 *
 * Kept separate from the component because this is the part that can be silently wrong: if the
 * steps don't sum to `net_profit`, the chart draws a plausible-looking bridge that lands on the
 * wrong number. `waterfall.test.ts` asserts they reconcile.
 */
export function buildWaterfall(overall: PnlOverall, overheads = 0): WaterfallBar[] {
	const steps: { name: string; delta: number; detail?: string; total?: boolean }[] = [
		{
			name: 'Settlement',
			delta: overall.net_settlement,
			detail: 'What Meesho actually paid into your bank for these orders, after their fees.',
		},
		{
			name: 'Cost of goods',
			delta: -(overall.cogs_making - overall.cogs_making_lost),
			detail: 'Making cost of the items customers kept.',
		},
		{
			name: 'Packaging',
			delta: -(overall.cogs_packaging - overall.cogs_packaging_lost),
			detail: 'Packaging for the orders that were delivered.',
		},
		{
			name: 'Packaging lost',
			delta: -overall.cogs_packaging_lost,
			detail: `Packaging consumed on orders that came back.\nRTO ${formatCurrency(overall.packaging_loss_rto)} · Returns ${formatCurrency(overall.packaging_loss_return)}`,
		},
		{
			name: 'Stock lost',
			delta: -overall.cogs_making_lost,
			detail: `Item cost written off on returns, at your loss rates.\nRTO ${formatCurrency(overall.making_loss_rto)} · Returns ${formatCurrency(overall.making_loss_return)}\n\nReverse shipping of ${formatCurrency(Math.abs(overall.return_shipping_charge))} was already taken out of settlement.`,
		},
		{ name: 'Ads', delta: overall.ads_cost, detail: 'Account-level ad spend for the period.' },
		{ name: 'Referral', delta: overall.referral_income, detail: 'Referral income credited to the account.' },
		{
			name: 'Claims',
			delta: overall.compensation_recovery,
			detail: 'Compensation received, less recoveries taken back.',
		},
		{
			name: 'Expenses',
			delta: -overheads,
			detail: 'Rent, salary and bills for this period. Not attached to any order.',
		},
		// The closing bar must equal every step above it, overheads included, or the bridge lands
		// somewhere other than the figure the seller is shown. `waterfall.test.ts` pins this.
		{ name: 'Net profit', delta: overall.net_profit - overheads, total: true },
	];

	let running = 0;
	return steps.map((step, index) => {
		if (step.total) {
			// The closing bar is drawn from zero, not stacked on the running total.
			return {
				name: step.name,
				delta: step.delta,
				range: [0, step.delta],
				className: step.delta >= 0 ? 'fill-chart-2' : 'fill-chart-3',
			};
		}

		const bar: WaterfallBar = {
			name: step.name,
			delta: step.delta,
			detail: step.detail,
			range: [running, running + step.delta],
			// The opening settlement bar is neither a gain nor a loss — it's the pot everything
			// else comes out of, so it gets the neutral brand colour.
			className: index === 0 ? 'fill-chart-1' : step.delta >= 0 ? 'fill-chart-2' : 'fill-chart-3',
		};
		running += step.delta;
		return bar;
	});
}

/**
 * A value axis with round numbers on it: the domain to draw, and the ticks to label.
 *
 * Recharts picks pleasant ticks by itself when it derives the domain, but it cannot derive one
 * from `[from, to]` tuples, and handing it the exact extremes made every tick inherit whatever odd
 * number the data happened to end on — an axis reading ₹71k, ₹55k, ₹25k. Left to space the labels
 * itself it then divides whatever domain it is given into equal parts, which is just as arbitrary,
 * so the ticks are handed over too.
 *
 * The interval comes from the 1 / 2 / 2.5 / 5 / 10 series every hand-drawn axis uses, and the ends
 * are pushed outwards to a multiple of it. Outwards is the part that matters: a domain that
 * cropped its own data would draw bars running off the end of the chart.
 */
export function niceAxis(min: number, max: number, intervals = 5): { domain: [number, number]; ticks: number[] } {
	const span = Math.max(1, max - min);
	const rough = span / intervals;
	const magnitude = 10 ** Math.floor(Math.log10(rough));
	const normalized = rough / magnitude;
	const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;

	const low = Math.floor(min / step) * step;
	const high = Math.ceil(max / step) * step;

	const ticks: number[] = [];
	// Counted rather than accumulated: adding a float step repeatedly drifts, and an axis labelled
	// ₹20,000.0000001 is a strange thing to ship.
	for (let i = 0; low + i * step <= high + step / 2; i += 1) ticks.push(low + i * step);

	return { domain: [low, high], ticks };
}
