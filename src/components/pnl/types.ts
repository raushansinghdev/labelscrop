/**
 * Shapes returned by the ported calculation layer in `src/lib/pnl/`.
 *
 * That layer is still JavaScript, so these types are hand-written against what
 * `computePnl` actually returns rather than inferred. They exist so the UI gets
 * real checking; if the calculator changes, these must change with it.
 */

export interface PnlOverall {
	net_settlement: number;
	cogs: number;
	cogs_making: number;
	cogs_packaging: number;
	cogs_making_lost: number;
	cogs_packaging_lost: number;
	making_loss_rto: number;
	making_loss_return: number;
	packaging_loss_rto: number;
	packaging_loss_return: number;
	return_shipping_charge: number;
	gross_profit: number;
	ads_cost: number;
	referral_income: number;
	compensation_recovery: number;
	net_profit: number;
	payment_window_start: string;
	payment_window_end: string;
	total_orders: number;
	total_units: number;
}

export interface SkuRow {
	sku: string;
	product_name?: string;
	orders: number;
	units: number;
	delivered_orders: number;
	rto_orders: number;
	return_orders: number;
	gross_sale_amount: number;
	net_settlement: number;
	cogs: number;
	cogs_making: number;
	cogs_packaging: number;
	rto_cost: number;
	profit: number;
	/** Null when there is no settlement to divide by, not zero — don't coerce. */
	margin_pct: number | null;
	avg_sale_price: number;
	/** False when any order for this SKU had no cost recorded, so its profit is overstated. */
	cost_mapped: boolean;
}

export interface StatusRow {
	/** Normalized status (delivered, rto, return, …). Null-ish for orders with a blank status. */
	status: string;
	order_count: number;
	total_settlement: number;
	percentage: number;
}

export interface UnmappedSku {
	sku: string;
	order_count: number;
	settlement_amount: number;
}

export interface ReviewOrder {
	sub_order_no: string;
	sku: string;
	net_settlement: number;
}

export interface PendingOrders {
	total_pending: number;
	total_gross_value: number;
	by_status: { reason: string; orders: number; gross_value: number }[];
}

export interface PnlResult {
	overall: PnlOverall;
	sku_rows: SkuRow[];
	status_breakdown: StatusRow[];
	/** SKUs with no making/packaging cost recorded, so their profit is overstated. */
	unmapped_skus: UnmappedSku[];
	/** Null unless the optional Orders CSV was supplied alongside the payment file. */
	pending_orders: PendingOrders | null;
	/** Orders whose status was blank in the export and need a manual look. */
	review_orders: ReviewOrder[];
	loss_rates: LossRates;
}

/** Fractions in 0–1. Mirrors DEFAULT_LOSS_RATES in `src/lib/pnl/config.js`. */
export interface LossRates {
	rto: number;
	return_rate: number;
	lost: number;
	unresolved: number;
	/** Packaging is consumed whether or not the item comes back, so both default to 1. */
	rto_packaging_loss: number;
	return_packaging_loss: number;
}

export interface SkuCost {
	making_cost: number;
	packaging_cost: number;
}

export type SkuCostMap = Record<string, SkuCost>;
