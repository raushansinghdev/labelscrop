import { ArrowRightIcon } from 'lucide-react';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { formatCurrencyExact, formatNumber, formatPercent } from '../format';
import type { SkuRow } from '../types';
import { ChartCard, ChartTooltip } from './ChartCard';
import { AXIS_TICK, BAR_RADIUS, GRID_CLASS, MAX_BAR, compactInr, useChartMotion } from './theme';
import { niceAxis } from './waterfall';

interface SkuProfitChartProps {
	rows: SkuRow[];
	/** Opens the full SKU table. This chart shows ten SKUs at most; the table shows all of them. */
	onOpenProducts: () => void;
}

interface Datum {
	/** Truncated for the axis; the tooltip carries the full SKU. */
	label: string;
	sku: string;
	profit: number;
	orders: number;
	margin: number | null;
	costMapped: boolean;
}

/** Enough rows to spot a pattern, few enough to stay readable on a phone. */
const TOP_N = 6;
const BOTTOM_N = 4;

export function SkuProfitChart({ rows, onOpenProducts }: SkuProfitChartProps) {
	const motion = useChartMotion();
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

	// Recharts draws a vertical bar chart from the bottom up, so the array has to be reversed
	// for the most profitable SKU to appear at the top.
	const data: Datum[] = shown
		.map((row) => ({
			label: row.sku.length > 18 ? `${row.sku.slice(0, 17)}…` : row.sku,
			sku: row.sku,
			profit: row.profit,
			orders: row.orders,
			margin: row.margin_pct,
			costMapped: row.cost_mapped,
		}))
		.reverse();

	// Left to itself recharts rounded the negative end out to a tick of its own choosing, so a
	// worst SKU losing ₹137 was drawn against an axis running to −₹2,000 and a fifth of the plot
	// was empty. The shared axis helper rounds to the same 1/2/2.5/5 series the waterfall uses.
	const profits = data.map((d) => d.profit);
	const axis = niceAxis(Math.min(0, ...profits), Math.max(0, ...profits), 5);

	return (
		<ChartCard
			title="Best and worst SKUs"
			caption="Profit per SKU after its own costs. Anything below the line is losing you money on every sale."
			badge={`${formatNumber(rows.length)} SKUs`}
			/* The only link on the overview. Everything else explains itself where it stands; this
			 * card is the one that visibly withholds something — ten bars out of however many SKUs
			 * there are — so it is the one place a way through belongs. */
			action={
				<button
					type="button"
					onClick={onOpenProducts}
					className="group inline-flex items-center gap-1 rounded-md text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					See every SKU
					<ArrowRightIcon
						className="size-3.5 translate-y-px transition-transform group-hover:translate-x-0.5"
						aria-hidden="true"
					/>
				</button>
			}
		>
			{/* 34px a row: 24px of bar and 10px of air. The old 24px pitch left the bars touching,
			  * so ten SKUs read as one striped block rather than ten separate answers. */}
			<div style={{ height: Math.max(200, data.length * 34 + 34) }} className="w-full">
				<ResponsiveContainer>
					<BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
						<CartesianGrid className={GRID_CLASS} horizontal={false} strokeOpacity={0.7} />
						<XAxis
							type="number"
							domain={axis.domain}
							ticks={axis.ticks}
							tick={AXIS_TICK}
							axisLine={false}
							tickLine={false}
							tickFormatter={compactInr}
						/>
						<YAxis
							type="category"
							dataKey="label"
							tick={AXIS_TICK}
							axisLine={false}
							tickLine={false}
							width={124}
						/>
						<Tooltip content={<SkuTooltip />} cursor={{ className: 'fill-muted/40' }} />
						<ReferenceLine x={0} className="stroke-border" />
						<Bar dataKey="profit" radius={BAR_RADIUS} maxBarSize={MAX_BAR} {...motion}>
							{data.map((entry) => (
								<Cell key={entry.sku} className={entry.profit >= 0 ? 'fill-chart-2' : 'fill-chart-3'} />
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</div>
		</ChartCard>
	);
}

function SkuTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload;
	return (
		<ChartTooltip label={d.sku}>
			<p className={d.profit >= 0 ? 'font-semibold text-success' : 'font-semibold text-destructive'}>
				{formatCurrencyExact(d.profit)}
			</p>
			<p>
				{formatNumber(d.orders)} orders · {formatPercent(d.margin)} margin
			</p>
			{!d.costMapped && <p className="text-destructive">No cost recorded — this profit is overstated.</p>}
		</ChartTooltip>
	);
}
