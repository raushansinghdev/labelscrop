import { ArrowRightIcon } from 'lucide-react';
import { formatCurrencyExact, formatNumber, formatPercent } from '../format';
import type { SkuRow } from '../types';
import { useMediaQuery } from '../useMediaQuery';
import { BarRows, type BarRow } from './BarRows';
import { ChartCard } from './ChartCard';
import { signedInr } from './theme';
import { niceAxis } from './waterfall';

interface SkuProfitChartProps {
	rows: SkuRow[];
	/** Opens the full SKU table. This chart shows ten SKUs at most; the table shows all of them. */
	onOpenProducts: () => void;
}

/** Enough rows to spot a pattern, few enough to stay readable on a phone. */
const TOP_N = 6;
const BOTTOM_N = 4;

export function SkuProfitChart({ rows, onOpenProducts }: SkuProfitChartProps) {
	const narrow = useMediaQuery('(max-width: 639px)');
	if (rows.length === 0) return null;

	const sorted = [...rows].sort((a, b) => b.profit - a.profit);
	const best = sorted.slice(0, TOP_N);
	// The loss-makers are what a seller actually needs to act on, so they're picked from the
	// other end of the same sorted list rather than left to fall off a top-N cut.
	const worst = sorted.filter((r) => r.profit < 0).slice(-BOTTOM_N);

	const seen = new Set<string>();
	const shown: SkuRow[] = [];
	for (const row of [...best, ...worst]) {
		if (seen.has(row.sku)) continue;
		seen.add(row.sku);
		shown.push(row);
	}

	// Shared 1/2/2.5/5 axis, so a worst SKU losing ₹137 isn't drawn against an axis running to −₹2,000.
	const profits = shown.map((r) => r.profit);
	const axis = niceAxis(Math.min(0, ...profits), Math.max(0, ...profits), narrow ? 3 : 5);

	const data: BarRow[] = shown.map((row) => ({
		key: row.sku,
		label: row.sku,
		title: row.sku,
		from: 0,
		to: row.profit,
		value: row.profit,
		barClass: row.profit >= 0 ? 'bg-chart-2' : 'bg-chart-3',
		marker: !row.cost_mapped ? (
			<span className="size-1.5 shrink-0 rounded-full bg-chart-4" aria-label="No cost yet" />
		) : undefined,
		detail: (
			<>
				<p className={row.profit >= 0 ? 'font-semibold text-success' : 'font-semibold text-destructive'}>
					{formatCurrencyExact(row.profit)}
				</p>
				<p className="text-xs">
					{formatNumber(row.orders)} orders · {formatPercent(row.margin_pct)} margin
				</p>
				{!row.cost_mapped && <p className="text-xs text-warning">No cost recorded — this profit is overstated.</p>}
			</>
		),
	}));

	return (
		<ChartCard
			title="Best and worst SKUs"
			caption="Profit per SKU after its own costs. Anything left of the line is losing you money on every sale."
			badge={`${formatNumber(rows.length)} SKUs`}
			/* The one card that visibly withholds something — ten bars out of however many SKUs
			 * there are — so it is the one place a way through belongs. */
			action={
				<button
					type="button"
					onClick={onOpenProducts}
					className="group -my-2 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					See every SKU
					<ArrowRightIcon
						className="size-3.5 translate-y-px transition-transform group-hover:translate-x-0.5"
						aria-hidden="true"
					/>
				</button>
			}
		>
			{/* Rows re-rank with a slide when a cost edit moves a SKU up or down the list. */}
			<BarRows
				rows={data}
				domain={axis.domain}
				ticks={axis.ticks}
				labelWidth={narrow ? 100 : 136}
				valueWidth={narrow ? 46 : 56}
				format={signedInr}
				hint="Tap a SKU to see its orders and margin. An amber dot means it has no cost yet."
				reorder
				rowHeight={36}
			/>
		</ChartCard>
	);
}
