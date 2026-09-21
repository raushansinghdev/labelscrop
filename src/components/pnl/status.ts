/**
 * What each order status is called, what colour it is, and which of them are worth a slice.
 *
 * Shared by the donut on screen and the one in the downloaded report, so the two can never
 * disagree about whether a stray cancelled order is named or folded into "Other".
 */

import { formatNumber } from './format';
import type { StatusRow } from './types';

export interface StatusMeta {
	label: string;
	/** SVG fill utility for the slice. Presentation attributes don't resolve `var()` reliably. */
	fill: string;
	/** The matching background utility, for the legend dot — which is an HTML element. */
	dot: string;
	/** The matching stroke utility, for the on-screen donut, which draws each slice as a ring arc. */
	stroke: string;
}

/**
 * The calculator emits Meesho's own vocabulary; "RTO" means nothing to a new seller, so each one
 * is relabelled in plain terms.
 *
 * RTO is "courier return": the parcel never reached the customer and came back to you. Naming it
 * that way puts it next to "customer return" as a matched pair — the two differ by *who* sent it
 * back, which is the whole reason they cost different amounts.
 */
export const STATUS_META: Record<string, StatusMeta> = {
	delivered: { label: 'Delivered', fill: 'fill-chart-2', dot: 'bg-chart-2', stroke: 'stroke-chart-2' },
	exchange: { label: 'Exchanged', fill: 'fill-chart-5', dot: 'bg-chart-5', stroke: 'stroke-chart-5' },
	rto: { label: 'Courier return', fill: 'fill-chart-3', dot: 'bg-chart-3', stroke: 'stroke-chart-3' },
	return: { label: 'Customer returned', fill: 'fill-chart-4', dot: 'bg-chart-4', stroke: 'stroke-chart-4' },
	cancelled: { label: 'Cancelled', fill: 'fill-muted-foreground', dot: 'bg-muted-foreground', stroke: 'stroke-muted-foreground' },
	lost: { label: 'Lost in transit', fill: 'fill-chart-1', dot: 'bg-chart-1', stroke: 'stroke-chart-1' },
	shipped: { label: 'Still shipping', fill: 'fill-chart-1', dot: 'bg-chart-1', stroke: 'stroke-chart-1' },
};

export const UNKNOWN_STATUS: StatusMeta = { label: 'Status missing', fill: 'fill-border', dot: 'bg-border', stroke: 'stroke-border' };

export interface StatusSlice {
	name: string;
	value: number;
	percentage: number;
	settlement: number;
	fill: string;
	dot: string;
	stroke: string;
	/** Set only on the rolled-up slice, so its readout can say what it swallowed. */
	parts?: string[];
}

/**
 * Below this, a slice is a hairline on a 144px donut and a legend row nobody reads. A real file
 * carries four or five of them — one cancelled order, one still shipping, one blank status — and
 * they turned a seven-row legend into mostly noise around the three lines that matter.
 */
const MIN_SLICE_PCT = 2;

export function buildStatusSlices(breakdown: StatusRow[]): { slices: StatusSlice[]; total: number } {
	const all: StatusSlice[] = breakdown
		.map((item) => {
			const meta = STATUS_META[item.status] ?? UNKNOWN_STATUS;
			return {
				name: meta.label,
				value: item.order_count,
				percentage: item.percentage,
				settlement: item.total_settlement,
				fill: meta.fill,
				dot: meta.dot,
				stroke: meta.stroke,
			};
		})
		// Largest first. The calculator emits its own order, which put 80% delivered third in the
		// legend, under two statuses worth 12% between them.
		.sort((a, b) => b.value - a.value);

	const total = all.reduce((sum, d) => sum + d.value, 0);

	const tiny = all.filter((d) => d.percentage < MIN_SLICE_PCT);
	const slices: StatusSlice[] = all.filter((d) => d.percentage >= MIN_SLICE_PCT);
	// One stray status is clearer named than hidden behind "Other"; two or more are noise.
	if (tiny.length > 1) {
		slices.push({
			name: 'Other',
			value: tiny.reduce((sum, d) => sum + d.value, 0),
			percentage: tiny.reduce((sum, d) => sum + d.percentage, 0),
			settlement: tiny.reduce((sum, d) => sum + d.settlement, 0),
			fill: 'fill-muted-foreground/40',
			dot: 'bg-muted-foreground/40',
			stroke: 'stroke-muted-foreground/40',
			parts: tiny.map((d) => `${d.name} ${formatNumber(d.value)}`),
		});
	} else {
		slices.push(...tiny);
	}

	return { slices, total };
}
