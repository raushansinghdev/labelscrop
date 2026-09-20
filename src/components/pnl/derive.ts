/**
 * The arithmetic the overview is built from, in one place.
 *
 * None of this is in the calculator: it is the second layer, where the P&L meets the seller's own
 * fixed costs and gets turned into the handful of figures the dashboard actually says out loud.
 * It lived inline in `KpiCards` and `ProfitInsights` until the PDF report needed the same numbers
 * — and a downloaded report that disagrees with the screen it was downloaded from is worse than
 * no report, so there is now exactly one definition of each.
 */

import type { PnlOverall, PnlResult, SkuRow } from './types';

export interface OverviewFigures {
	/** Profit after ads *and* after rent and salary — the figure that reaches the seller's pocket. */
	realProfit: number;
	/** Against settlement received, not gross sale value: settlement is the only money that moved. */
	marginPct: number | null;
	positive: boolean;
	/** Per order rather than per unit — an order is what gets packed and shipped. */
	perOrder: number;
	settlementPerOrder: number;
	/** Meesho books the return fee as a deduction, so it arrives negative; quoted as its size. */
	returnFee: number;
	/** Stock and packaging written off on returns, at the seller's own loss rates. */
	cogsWrittenOff: number;
	/** Share of the payout that survived to profit, 0–1, for the meter under the headline. */
	profitShare: number;
}

export function deriveOverview(overall: PnlOverall, overheads: number): OverviewFigures {
	const realProfit = overall.net_profit - overheads;
	return {
		realProfit,
		marginPct: overall.net_settlement !== 0 ? (realProfit / overall.net_settlement) * 100 : null,
		positive: realProfit >= 0,
		perOrder: overall.total_orders > 0 ? realProfit / overall.total_orders : 0,
		settlementPerOrder: overall.total_orders > 0 ? overall.net_settlement / overall.total_orders : 0,
		returnFee: Math.abs(overall.return_shipping_charge),
		cogsWrittenOff: overall.cogs_making_lost + overall.cogs_packaging_lost,
		profitShare: overall.net_settlement > 0 ? realProfit / overall.net_settlement : 0,
	};
}

export interface InsightFigures {
	best: SkuRow;
	worst: SkuRow;
	/** The worst SKU, but only when it actually loses money — otherwise there is nothing to name. */
	drain: SkuRow | null;
	losers: number;
	/** Everything the loss-making SKUs cost between them. Negative. */
	redTotal: number;
	rtoOrders: number;
	customerReturns: number;
	returnedOrders: number;
	returnRate: number;
	/**
	 * What came back actually cost: the item written off plus the packaging consumed. Reverse
	 * shipping is not added — Meesho deducted it before settling, so it is already inside the
	 * settlement figure and counting it here would charge it twice.
	 */
	returnCost: number;
	returnFee: number;
}

/** Null when the file produced no SKU rows at all, in which case there is nothing to say. */
export function deriveInsights(result: PnlResult): InsightFigures | null {
	const { overall, sku_rows } = result;
	if (sku_rows.length === 0) return null;

	const sorted = [...sku_rows].sort((a, b) => b.profit - a.profit);
	const best = sorted[0];
	const worst = sorted[sorted.length - 1];
	const inTheRed = sku_rows.filter((r) => r.profit < 0);
	const rtoOrders = sku_rows.reduce((sum, r) => sum + r.rto_orders, 0);
	const customerReturns = sku_rows.reduce((sum, r) => sum + r.return_orders, 0);
	const returnedOrders = rtoOrders + customerReturns;

	return {
		best,
		worst,
		drain: worst && worst.profit < 0 ? worst : null,
		losers: inTheRed.length,
		redTotal: inTheRed.reduce((sum, r) => sum + r.profit, 0),
		rtoOrders,
		customerReturns,
		returnedOrders,
		returnRate: overall.total_orders > 0 ? (returnedOrders / overall.total_orders) * 100 : 0,
		returnCost: overall.cogs_making_lost + overall.cogs_packaging_lost,
		returnFee: Math.abs(overall.return_shipping_charge),
	};
}
